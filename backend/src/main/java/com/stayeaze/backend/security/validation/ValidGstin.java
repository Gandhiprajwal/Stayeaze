package com.stayeaze.backend.security.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = GstinValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidGstin {
    String message() default "Invalid Indian GSTIN format (Must be 15 characters, e.g. 22AAAAA0000A1Z5)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
