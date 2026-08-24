package com.stayeaze.backend.security;

import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

@Component
public class ApiMetricsFilter extends OncePerRequestFilter {

    private static final AtomicLong totalRequests = new AtomicLong(0);
    private static final AtomicLong activeRequests = new AtomicLong(0);
    private static final AtomicLong totalLatencyMs = new AtomicLong(0);

    private static final Map<Integer, AtomicLong> statusCounts = new ConcurrentHashMap<>();
    private static final Map<String, EndpointStat> endpointStats = new ConcurrentHashMap<>();
    private static final Map<String, AtomicLong> orgStats = new ConcurrentHashMap<>();
    private static final List<Long> recentLatencies = new ArrayList<>();
    private static final List<TimeSeriesBucket> timeSeries = new ArrayList<>();
    private static final ReentrantLock latencyLock = new ReentrantLock();
    private static final ReentrantLock timeSeriesLock = new ReentrantLock();

    public static class EndpointStat {
        public String method;
        public String uri;
        public AtomicLong count = new AtomicLong(0);
        public AtomicLong errors = new AtomicLong(0);
        public AtomicLong totalMs = new AtomicLong(0);

        public EndpointStat(String method, String uri) {
            this.method = method;
            this.uri = uri;
        }
    }

    public static class TimeSeriesBucket {
        public long timestamp;
        public long hits;
        public double avgMs;

        public TimeSeriesBucket(long timestamp, long hits, double avgMs) {
            this.timestamp = timestamp;
            this.hits = hits;
            this.avgMs = avgMs;
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (!uri.startsWith("/api/v1/") 
                || uri.startsWith("/api/v1/super-admin/api-metrics")
                || uri.endsWith("/stream")) {
            filterChain.doFilter(request, response);
            return;
        }

        activeRequests.incrementAndGet();
        long startTime = System.currentTimeMillis();

        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            activeRequests.decrementAndGet();
            totalRequests.incrementAndGet();
            totalLatencyMs.addAndGet(duration);

            int status = response.getStatus();
            statusCounts.computeIfAbsent(status, k -> new AtomicLong(0)).incrementAndGet();

            // Normalize endpoint path (strip UUIDs/IDs for grouping)
            String normalizedUri = uri.replaceAll("/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "/{id}")
                                      .replaceAll("/[0-9]+", "/{id}");
            String key = request.getMethod() + " " + normalizedUri;
            EndpointStat stat = endpointStats.computeIfAbsent(key, k -> new EndpointStat(request.getMethod(), normalizedUri));
            stat.count.incrementAndGet();
            stat.totalMs.addAndGet(duration);
            if (status >= 400) {
                stat.errors.incrementAndGet();
            }

            // Track Organization Usage
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
                if (userDetails.getOrgId() != null) {
                    orgStats.computeIfAbsent(userDetails.getOrgId().toString(), k -> new AtomicLong(0)).incrementAndGet();
                }
            }

            // Latency Ring Buffer (keep last 100) with Virtual-Thread-safe ReentrantLock
            latencyLock.lock();
            try {
                recentLatencies.add(duration);
                if (recentLatencies.size() > 100) {
                    recentLatencies.remove(0);
                }
            } finally {
                latencyLock.unlock();
            }

            // Time series minute bucket with Virtual-Thread-safe ReentrantLock
            long minuteBucket = (System.currentTimeMillis() / 60000) * 60000;
            timeSeriesLock.lock();
            try {
                TimeSeriesBucket bucket = timeSeries.stream()
                        .filter(b -> b.timestamp == minuteBucket)
                        .findFirst()
                        .orElse(null);
                if (bucket == null) {
                    bucket = new TimeSeriesBucket(minuteBucket, 0, 0);
                    timeSeries.add(bucket);
                    if (timeSeries.size() > 30) {
                        timeSeries.remove(0);
                    }
                }
                bucket.hits++;
                bucket.avgMs = (bucket.avgMs * (bucket.hits - 1) + duration) / bucket.hits;
            } finally {
                timeSeriesLock.unlock();
            }
        }
    }

    public static Map<String, Object> getMetricsSnapshot() {
        Map<String, Object> metrics = new HashMap<>();

        long total = totalRequests.get();
        long active = activeRequests.get();
        long sumMs = totalLatencyMs.get();
        double avgLatency = total > 0 ? (double) sumMs / (double) total : 0.0;

        metrics.put("totalRequests", total);
        metrics.put("activeRequests", active);
        metrics.put("avgLatencyMs", Math.round(avgLatency * 100.0) / 100.0);

        // Status code counts
        Map<String, Long> statusMap = new HashMap<>();
        long totalErrors = 0;
        for (Map.Entry<Integer, AtomicLong> e : statusCounts.entrySet()) {
            statusMap.put(String.valueOf(e.getKey()), e.getValue().get());
            if (e.getKey() >= 400) {
                totalErrors += e.getValue().get();
            }
        }
        metrics.put("statusCounts", statusMap);

        double errorRate = total > 0 ? ((double) totalErrors / (double) total) * 100.0 : 0.0;
        metrics.put("errorRatePercent", Math.round(errorRate * 100.0) / 100.0);

        // Requests Per Minute (RPM) over last 1 min
        long currentMin = (System.currentTimeMillis() / 60000) * 60000;
        long currentRpm = timeSeries.stream()
                .filter(b -> b.timestamp == currentMin)
                .mapToLong(b -> b.hits)
                .findFirst().orElse(0L);
        metrics.put("requestsPerMinute", currentRpm);

        // Top Endpoints
        List<Map<String, Object>> endpoints = new ArrayList<>();
        for (EndpointStat es : endpointStats.values()) {
            Map<String, Object> em = new HashMap<>();
            em.put("method", es.method);
            em.put("uri", es.uri);
            em.put("count", es.count.get());
            em.put("errors", es.errors.get());
            double eAvg = es.count.get() > 0 ? (double) es.totalMs.get() / (double) es.count.get() : 0.0;
            em.put("avgMs", Math.round(eAvg * 100.0) / 100.0);
            double eErrRate = es.count.get() > 0 ? ((double) es.errors.get() / (double) es.count.get()) * 100.0 : 0.0;
            em.put("errorRatePercent", Math.round(eErrRate * 100.0) / 100.0);
            endpoints.add(em);
        }
        endpoints.sort((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")));
        metrics.put("topEndpoints", endpoints);

        // Top Organization Traffic Leaderboard
        List<Map<String, Object>> orgList = new ArrayList<>();
        for (Map.Entry<String, AtomicLong> entry : orgStats.entrySet()) {
            Map<String, Object> om = new HashMap<>();
            om.put("orgId", entry.getKey());
            om.put("hits", entry.getValue().get());
            orgList.add(om);
        }
        orgList.sort((a, b) -> Long.compare((Long) b.get("hits"), (Long) a.get("hits")));
        metrics.put("orgLeaderboard", orgList);

        // Time Series
        metrics.put("timeSeries", new ArrayList<>(timeSeries));

        return metrics;
    }

    public static void resetMetrics() {
        totalRequests.set(0);
        activeRequests.set(0);
        totalLatencyMs.set(0);
        statusCounts.clear();
        endpointStats.clear();
        orgStats.clear();
        recentLatencies.clear();
        timeSeries.clear();
    }
}
