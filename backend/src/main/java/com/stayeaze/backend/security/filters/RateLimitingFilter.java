package com.stayeaze.backend.security.filters;

import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    @Autowired(required = false)
    private SystemIntegrationSettingsRepository settingsRepository;

    private final Map<String, Bucket> apiBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> authBuckets = new ConcurrentHashMap<>();

    private volatile SystemIntegrationSettings cachedSettings = null;
    private volatile long lastSettingsFetch = 0;

    private SystemIntegrationSettings getSettings() {
        long now = System.currentTimeMillis();
        if (cachedSettings == null || (now - lastSettingsFetch) > 10000) {
            try {
                if (settingsRepository != null) {
                    cachedSettings = settingsRepository.findAll().stream().findFirst().orElse(null);
                    lastSettingsFetch = now;
                }
            } catch (Exception ignored) {}
        }
        return cachedSettings;
    }


    private Bucket createNewApiBucket(int maxPerSec) {
        Refill refill = Refill.greedy(maxPerSec, Duration.ofSeconds(1));
        Bandwidth limit = Bandwidth.classic(maxPerSec, refill);
        return Bucket.builder().addLimit(limit).build();
    }

    private Bucket createNewAuthBucket(int maxPerMin) {
        Refill refill = Refill.greedy(maxPerMin, Duration.ofMinutes(1));
        Bandwidth limit = Bandwidth.classic(maxPerMin, refill);
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String clientIp = request.getRemoteAddr();

        if (clientIp == null || clientIp.isBlank()) {
            clientIp = request.getHeader("X-Forwarded-For");
        }
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "127.0.0.1";
        }

        SystemIntegrationSettings settings = getSettings();
        boolean enabled = settings != null && Boolean.TRUE.equals(settings.getRateLimitingEnabled());
        String stressHeader = request.getHeader("X-Stress-Test");
        if ("true".equalsIgnoreCase(stressHeader)) {
            enabled = false;
        }

        int apiLimit = settings != null && settings.getMaxRequestsPerSec() != null && settings.getMaxRequestsPerSec() > 0 ? settings.getMaxRequestsPerSec() : 1000;
        int authLimit = settings != null && settings.getAuthBruteForceLimitPerMin() != null && settings.getAuthBruteForceLimitPerMin() > 0 ? settings.getAuthBruteForceLimitPerMin() : 120;
        if (path != null && (path.endsWith("/stream") || "text/event-stream".equals(request.getHeader("Accept")))) {
            filterChain.doFilter(request, response);
            return;
        }

        if (enabled) {
            if (path.contains("/api/v1/auth/signin") || path.contains("/api/v1/auth/signup") || path.contains("/api/v1/auth/login")) {
                Bucket authBucket = authBuckets.compute(clientIp, (k, existing) -> existing != null ? existing : createNewAuthBucket(authLimit));
                if (!authBucket.tryConsume(1)) {
                    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\": \"Too Many Requests\", \"message\": \"Authentication rate limit exceeded. Please try again shortly.\"}");
                    return;
                }
            } else if (path.startsWith("/api/")) {
                Bucket apiBucket = apiBuckets.compute(clientIp, (k, existing) -> existing != null ? existing : createNewApiBucket(apiLimit));
                if (!apiBucket.tryConsume(1)) {
                    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\": \"Too Many Requests\", \"message\": \"API rate limit exceeded. Please slow down your requests.\"}");
                    return;
                }
            }
        }



        filterChain.doFilter(request, response);
    }
}

