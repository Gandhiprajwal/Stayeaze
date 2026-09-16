package com.stayeaze.backend.services.interfaces;

/**
 * Service contract for secure credential and password generation.
 */
public interface ICredentialService {

    /**
     * Generates a cryptographically secure random password of specified length.
     * Guarantees at least 1 uppercase, 1 lowercase, 1 digit, and 1 special symbol.
     *
     * @param length total character length (minimum 8)
     * @return secure randomized password string
     */
    String generateSecurePassword(int length);

    /**
     * Generates a standard 12-character cryptographically secure password.
     *
     * @return 12-character secure password string
     */
    String generateSecurePassword();
}
