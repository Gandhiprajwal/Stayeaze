package com.stayeaze.backend.security.services;

import com.stayeaze.backend.models.RefreshToken;
import java.util.Optional;
import java.util.UUID;

/**
 * Service contract for persistent refresh tokens, rotation, and session invalidation.
 */
public interface IRefreshTokenService {

    /**
     * Looks up a refresh token entity by its string token value.
     *
     * @param token unique token string
     * @return Optional containing RefreshToken if present
     */
    Optional<RefreshToken> findByToken(String token);

    /**
     * Issues or updates a persistent refresh token for a user.
     *
     * @param userId unique user identifier
     * @return newly generated or refreshed RefreshToken entity
     */
    RefreshToken createRefreshToken(UUID userId);

    /**
     * Verifies if the refresh token has passed its expiration date.
     * If expired, removes the record from the database and throws TokenRefreshException.
     *
     * @param token target token to check
     * @return valid RefreshToken
     */
    RefreshToken verifyExpiration(RefreshToken token);

    /**
     * Atomically rotates a refresh token: invalidates the old token and issues a new one.
     *
     * @param oldToken existing valid token
     * @return new rotated RefreshToken
     */
    RefreshToken rotateRefreshToken(RefreshToken oldToken);

    /**
     * Revokes all active refresh tokens for a user during logout or account suspension.
     *
     * @param userId target user ID
     * @return count of revoked tokens
     */
    int deleteByUserId(UUID userId);
}
