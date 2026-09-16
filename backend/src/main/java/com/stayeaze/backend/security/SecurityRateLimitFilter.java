package com.stayeaze.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class SecurityRateLimitFilter extends OncePerRequestFilter {

    private static final int AUTH_MAX_ATTEMPTS_PER_MINUTE = 15;
    private final Cache<String, RateTracker> rateLimitCache = Caffeine.newBuilder()
            .maximumSize(50_000)
            .expireAfterWrite(2, TimeUnit.MINUTES)
            .build();

    public void clearRateLimits() {
        rateLimitCache.invalidateAll();
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

    public static boolean bypassForTesting = false;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (bypassForTesting) {
            filterChain.doFilter(request, response);
            return;
        }

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
        if (uri != null && (uri.contains("/auth/login") || uri.contains("/auth/signin") || uri.contains("/auth/verify-2fa"))) {
            String clientIp = request.getHeader("X-Forwarded-For");
            if (clientIp == null || clientIp.isBlank()) {
                clientIp = request.getRemoteAddr();
            } else if (clientIp.contains(",")) {
                clientIp = clientIp.split(",")[0].trim();
            }
            if (clientIp == null) clientIp = "127.0.0.1";
            final String finalIp = clientIp;
            long now = System.currentTimeMillis();

            RateTracker tracker = rateLimitCache.asMap().compute(finalIp, (key, existing) -> {
                if (existing == null || now > existing.resetTime) {
                    return new RateTracker(now + 60000); // 1 minute window
                }
                existing.count.incrementAndGet();
                return existing;
            });

            if (tracker != null && tracker.count.get() > AUTH_MAX_ATTEMPTS_PER_MINUTE) {
                long remainingSeconds = Math.max(1, (tracker.resetTime - now) / 1000);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setHeader("Retry-After", String.valueOf(remainingSeconds));
                response.setContentType("application/json");
                response.getWriter().write(String.format("""
                    {
                        "status": 429,
                        "error": "Too Many Requests",
                        "message": "Too many authentication attempts. Please wait %d seconds before trying again."
                    }
                """, remainingSeconds));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
