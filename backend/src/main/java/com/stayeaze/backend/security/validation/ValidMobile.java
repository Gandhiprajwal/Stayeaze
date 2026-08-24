package com.stayeaze.backend.security.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = MobileValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidMobile {
    String message() default "Invalid mobile number. Must be 10 digits, start with 6-9, and not be a dummy sequence";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
