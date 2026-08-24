package com.stayeaze.backend.services;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
public class CredentialService {

    private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijkmnpqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String SPECIAL = "!@#$%^&*";
    private static final String ALL_CHARS = UPPER + LOWER + DIGITS + SPECIAL;

    private final SecureRandom random = new SecureRandom();

    /**
     * Generates a cryptographically secure random password of specified length (minimum 8, default 12).
     * Guarantees at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character.
     */
    public String generateSecurePassword(int length) {
        int targetLength = Math.max(length, 8);
        StringBuilder sb = new StringBuilder(targetLength);

        // Ensure at least one character from each required set
        sb.append(UPPER.charAt(random.nextInt(UPPER.length())));
        sb.append(LOWER.charAt(random.nextInt(LOWER.length())));
        sb.append(DIGITS.charAt(random.nextInt(DIGITS.length())));
        sb.append(SPECIAL.charAt(random.nextInt(SPECIAL.length())));

        // Fill remaining length
        for (int i = 4; i < targetLength; i++) {
            sb.append(ALL_CHARS.charAt(random.nextInt(ALL_CHARS.length())));
        }

        // Fisher-Yates shuffle
        char[] chars = sb.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }

        return new String(chars);
    }

    public String generateSecurePassword() {
        return generateSecurePassword(12);
    }
}
