package com.stayeaze.backend.security.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

public class PanValidator implements ConstraintValidator<ValidPan, String> {

    private static final Pattern PAN_PATTERN = Pattern.compile("^[A-Z]{5}[0-9]{4}[A-Z]{1}$");
    private static final List<Character> VALID_ENTITY_CODES = Arrays.asList('P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G');

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true; // Use @NotBlank separately if field is mandatory
        }

        String cleanPan = value.trim().toUpperCase();
        if (cleanPan.length() != 10) {
            return false;
        }

        if (!PAN_PATTERN.matcher(cleanPan).matches()) {
            return false;
        }

        // 4th character entity type check
        char entityCode = cleanPan.charAt(3);
        return VALID_ENTITY_CODES.contains(entityCode);
    }
}
