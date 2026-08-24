package com.stayeaze.backend.security.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory thread-safe service for blacklisting revoked JWT Access Tokens upon logout or session termination.
 */
@Service
public class TokenBlacklistService {
    private static final Logger logger = LoggerFactory.getLogger(TokenBlacklistService.class);

    // Maps token string -> expiry timestamp (epoch millis)
    private final Map<String, Long> blacklistedTokens = new ConcurrentHashMap<>();

    /**
     * Blacklist a JWT token until its natural expiration.
     */
    public void blacklistToken(String token, long expiryTimeMillis) {
        if (token == null || token.isBlank()) return;
        long now = System.currentTimeMillis();
        if (expiryTimeMillis <= now) {
            // Already expired naturally, no need to store
            return;
        }
        blacklistedTokens.put(token, expiryTimeMillis);
        logger.info("Access token blacklisted until epoch {}", expiryTimeMillis);
        cleanupExpired();
    }

    /**
     * Blacklist a JWT token with a default 24-hour TTL if expiration timestamp is unknown.
     */
    public void blacklistToken(String token) {
        long defaultExpiry = System.currentTimeMillis() + (24 * 60 * 60 * 1000L);
        blacklistToken(token, defaultExpiry);
    }

    /**
     * Check if a JWT token has been blacklisted / revoked.
     */
    public boolean isBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        Long expiry = blacklistedTokens.get(token);
        if (expiry == null) {
            return false;
        }
        if (System.currentTimeMillis() > expiry) {
            blacklistedTokens.remove(token);
            return false;
        }
        return true;
    }

    /**
     * Periodically prune expired entries to conserve memory.
     */
    public void cleanupExpired() {
        long now = System.currentTimeMillis();
        blacklistedTokens.entrySet().removeIf(entry -> entry.getValue() <= now);
    }
}
