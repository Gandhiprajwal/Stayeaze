package com.stayeaze.backend.security.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class GstinValidator implements ConstraintValidator<ValidGstin, String> {

    private static final Pattern GSTIN_PATTERN = Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.trim().isEmpty() || "NONE".equalsIgnoreCase(value.trim()) || "NA".equalsIgnoreCase(value.trim()) || "NOT_APPLICABLE".equalsIgnoreCase(value.trim())) {
            return true; // Optional field: accept null or empty/NA values
        }

        String cleanGstin = value.trim().toUpperCase();
        if (cleanGstin.length() != 15) {
            return false;
        }

        return GSTIN_PATTERN.matcher(cleanGstin).matches();
    }
}
