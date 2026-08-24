package com.stayeaze.backend.utils;

import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.UUID;

/**
 * Sequential UUID v7 Generator.
 * Combines Unix millisecond timestamp in the high bits with cryptographically
 * secure random bytes in the low bits to guarantee B-Tree index sequential insertion locality.
 */
public class UuidV7Generator {

    private static final SecureRandom random = new SecureRandom();

    public static UUID generate() {
        long timestamp = System.currentTimeMillis();
        byte[] value = new byte[16];
        random.nextBytes(value);

        // Pack 48-bit timestamp into high bits
        value[0] = (byte) (timestamp >> 40);
        value[1] = (byte) (timestamp >> 32);
        value[2] = (byte) (timestamp >> 24);
        value[3] = (byte) (timestamp >> 16);
        value[4] = (byte) (timestamp >> 8);
        value[5] = (byte) timestamp;

        // Version 7: set 4 bits of version field (bits 48..51) to 0111
        value[6] = (byte) ((value[6] & 0x0F) | 0x70);

        // Variant 1: set 2 bits of variant field (bits 64..65) to 10
        value[8] = (byte) ((value[8] & 0x3F) | 0x80);

        ByteBuffer buffer = ByteBuffer.wrap(value);
        return new UUID(buffer.getLong(0), buffer.getLong(8));
    }
}
