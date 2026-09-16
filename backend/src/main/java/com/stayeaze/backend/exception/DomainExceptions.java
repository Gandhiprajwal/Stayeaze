package com.stayeaze.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

public class DomainExceptions {

    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class ResourceNotFoundException extends RuntimeException {
        public ResourceNotFoundException(String resourceName, String fieldName, Object fieldValue) {
            super(String.format("%s not found with %s: '%s'", resourceName, fieldName, fieldValue));
        }

        public ResourceNotFoundException(String message) {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.CONFLICT)
    public static class BedAlreadyOccupiedException extends RuntimeException {
        public BedAlreadyOccupiedException(String bedNumber, String currentTenant) {
            super(String.format("Bed [%s] is already occupied%s. Please choose an available bed.", 
                    bedNumber, currentTenant != null ? " by " + currentTenant : ""));
        }

        public BedAlreadyOccupiedException(String message) {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.CONFLICT)
    public static class DuplicateResourceException extends RuntimeException {
        public DuplicateResourceException(String message) {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public static class PaymentProcessingException extends RuntimeException {
        public PaymentProcessingException(String message) {
            super(message);
        }

        public PaymentProcessingException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    @ResponseStatus(HttpStatus.FORBIDDEN)
    public static class SubscriptionLimitExceededException extends RuntimeException {
        public SubscriptionLimitExceededException(String message) {
            super(message);
        }
    }
}
