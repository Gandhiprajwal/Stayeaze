package com.stayeaze.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class SecurityRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_MINUTE = 100;
    private final Map<String, RateTracker> rateLimitMap = new ConcurrentHashMap<>();

    public void clearRateLimits() {
        rateLimitMap.clear();
    }

    private static class RateTracker {
        final long resetTime;
        final AtomicInteger count;

        RateTracker(long resetTime) {
            this.resetTime = resetTime;
            this.count = new AtomicInteger(1);
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository settingsRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        boolean rateLimitingEnabled = true;
        try {
            if (settingsRepository != null) {
                var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
                if (settings != null && Boolean.FALSE.equals(settings.getRateLimitingEnabled())) {
                    rateLimitingEnabled = false;
                }
            }
        } catch (Exception ignored) {}

        if (!rateLimitingEnabled) {
            filterChain.doFilter(request, response);
            return;
        }

        String uri = request.getRequestURI();
        if (uri != null && (uri.endsWith("/auth/login") || uri.endsWith("/auth/signin"))) {
            String clientIp = request.getRemoteAddr();
            long now = System.currentTimeMillis();

            rateLimitMap.compute(clientIp, (key, tracker) -> {
                if (tracker == null || now > tracker.resetTime) {
                    return new RateTracker(now + 60000); // 1 minute window
                }
                tracker.count.incrementAndGet();
                return tracker;
            });

            RateTracker tracker = rateLimitMap.get(clientIp);
            if (tracker != null && tracker.count.get() > MAX_REQUESTS_PER_MINUTE) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"error\": \"Too many login attempts. Rate limit exceeded. Please wait 1 minute.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
