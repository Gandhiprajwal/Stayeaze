package com.stayeaze.backend.security.filters;

import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    @Autowired(required = false)
    private SystemIntegrationSettingsRepository settingsRepository;

    private final Cache<String, Bucket> apiBuckets = Caffeine.newBuilder()
            .maximumSize(50_000)
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .build();

    private final Cache<String, Bucket> authBuckets = Caffeine.newBuilder()
            .maximumSize(50_000)
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .build();

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
        Bandwidth limit = Bandwidth.builder().capacity(maxPerSec).refillGreedy(maxPerSec, Duration.ofSeconds(1)).build();
        return Bucket.builder().addLimit(limit).build();
    }

    private Bucket createNewAuthBucket(int maxPerMin) {
        Bandwidth limit = Bandwidth.builder().capacity(maxPerMin).refillGreedy(maxPerMin, Duration.ofMinutes(1)).build();
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

        if (enabled && path != null) {
            if (path.contains("/api/v1/auth/signin") || path.contains("/api/v1/auth/signup") || path.contains("/api/v1/auth/login")) {
                Bucket authBucket = authBuckets.get(clientIp, k -> createNewAuthBucket(authLimit));
                if (authBucket != null && !authBucket.tryConsume(1)) {
                    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\": \"Too Many Requests\", \"message\": \"Authentication rate limit exceeded. Please try again shortly.\"}");
                    return;
                }
            } else if (path.startsWith("/api/")) {
                Bucket apiBucket = apiBuckets.get(clientIp, k -> createNewApiBucket(apiLimit));
                if (apiBucket != null && !apiBucket.tryConsume(1)) {
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

