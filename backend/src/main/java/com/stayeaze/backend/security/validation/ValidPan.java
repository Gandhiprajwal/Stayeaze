package com.stayeaze.backend.security.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = PanValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPan {
    String message() default "Invalid Indian PAN card format (Must be 10 characters: 5 letters, 4 digits, 1 letter, e.g. ABCDE1234F)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
