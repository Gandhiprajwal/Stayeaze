package com.stayeaze.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Intercepts POST/PUT requests on sensitive financial and booking routes.
 * Uses X-Idempotency-Key header to prevent duplicate debits, payments, or bookings
 * during client network retries or accidental double-clicks.
 */
@Component
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(IdempotencyFilter.class);

    // Thread-safe TTL cache for in-flight and recently completed idempotency keys
    private static final Map<String, Long> keyTimestampMap = new ConcurrentHashMap<>();
    private static final long EXPIRATION_WINDOW_MS = 120_000L; // 2 minutes

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String method = request.getMethod();
        String uri = request.getRequestURI();

        // Only enforce on state-mutating requests to sensitive routes
        if (("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)) && isSensitiveRoute(uri)) {
            String idempotencyKey = request.getHeader("X-Idempotency-Key");
            if (idempotencyKey == null || idempotencyKey.isBlank()) {
                idempotencyKey = request.getHeader("Idempotency-Key");
            }

            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                String cleanKey = uri + ":" + idempotencyKey.trim();
                long now = System.currentTimeMillis();

                // Clean up expired keys periodically
                if (keyTimestampMap.size() > 5000) {
                    keyTimestampMap.entrySet().removeIf(entry -> (now - entry.getValue()) > EXPIRATION_WINDOW_MS);
                }

                Long previousTimestamp = keyTimestampMap.putIfAbsent(cleanKey, now);
                if (previousTimestamp != null) {
                    long elapsed = now - previousTimestamp;
                    if (elapsed < EXPIRATION_WINDOW_MS) {
                        logger.warn("Duplicate request rejected by IdempotencyFilter: [{}] for key [{}]", uri, cleanKey);
                        response.setStatus(HttpStatus.CONFLICT.value());
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        response.getWriter().write("""
                            {
                                "status": 409,
                                "error": "Conflict",
                                "message": "Duplicate transaction detected with the same Idempotency-Key. Please wait or refresh the page."
                            }
                        """);
                        return;
                    } else {
                        // Key expired; refresh timestamp
                        keyTimestampMap.put(cleanKey, now);
                    }
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isSensitiveRoute(String uri) {
        if (uri == null) return false;
        return uri.contains("/api/v1/payments")
                || uri.contains("/api/v1/bookings")
                || uri.contains("/api/v1/invoices")
                || uri.contains("/api/v1/saas/subscribe")
                || uri.contains("/api/v1/public/onboarding");
    }
}
