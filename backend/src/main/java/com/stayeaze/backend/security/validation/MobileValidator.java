package com.stayeaze.backend.security.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

public class MobileValidator implements ConstraintValidator<ValidMobile, String> {

    private static final Pattern MOBILE_PATTERN = Pattern.compile("^[6-9]\\d{9}$");
    private static final Pattern REPETITIVE_PATTERN = Pattern.compile("^(\\d)\\1{9}$");
    private static final List<String> DUMMY_SEQUENCES = Arrays.asList(
        "1234567890", "9876543210", "0123456789", "9876501234"
    );

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true; // Use @NotBlank separately if mandatory
        }

        String cleanNumber = value.replaceAll("[\\s\\-\\(\\)\\+]", "");
        if (cleanNumber.startsWith("91") && cleanNumber.length() == 12) {
            cleanNumber = cleanNumber.substring(2);
        } else if (cleanNumber.startsWith("0") && cleanNumber.length() == 11) {
            cleanNumber = cleanNumber.substring(1);
        }

        if (!MOBILE_PATTERN.matcher(cleanNumber).matches()) {
            return false;
        }

        if (REPETITIVE_PATTERN.matcher(cleanNumber).matches()) {
            return false;
        }

        if (DUMMY_SEQUENCES.contains(cleanNumber)) {
            return false;
        }

        return true;
    }
}
