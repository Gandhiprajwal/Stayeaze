package com.stayeaze.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Access denied. Insufficient permissions to perform this action.");
        problem.setTitle("Access Denied");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Validation failed for one or more fields.");
        problem.setTitle("Validation Error");

        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(err -> fieldErrors.put(err.getField(), err.getDefaultMessage()));
        problem.setProperty("invalidFields", fieldErrors);
        problem.setProperty("timestamp", Instant.now());

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> handleIllegalArgument(IllegalArgumentException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("Invalid Argument");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(TokenRefreshException.class)
    public ResponseEntity<ProblemDetail> handleTokenRefreshException(TokenRefreshException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
        problem.setTitle("Token Refresh Error");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
    }

    @ExceptionHandler(DomainExceptions.ResourceNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleResourceNotFound(DomainExceptions.ResourceNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Resource Not Found");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
    }

    @ExceptionHandler(DomainExceptions.BedAlreadyOccupiedException.class)
    public ResponseEntity<ProblemDetail> handleBedOccupied(DomainExceptions.BedAlreadyOccupiedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Bed Already Occupied");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(DomainExceptions.DuplicateResourceException.class)
    public ResponseEntity<ProblemDetail> handleDuplicateResource(DomainExceptions.DuplicateResourceException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Duplicate Resource");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(DomainExceptions.PaymentProcessingException.class)
    public ResponseEntity<ProblemDetail> handlePaymentProcessing(DomainExceptions.PaymentProcessingException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
        problem.setTitle("Payment Processing Error");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(problem);
    }

    @ExceptionHandler(DomainExceptions.SubscriptionLimitExceededException.class)
    public ResponseEntity<ProblemDetail> handleSubscriptionLimit(DomainExceptions.SubscriptionLimitExceededException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.getMessage());
        problem.setTitle("Subscription Plan Limit Exceeded");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler({
        org.springframework.web.context.request.async.AsyncRequestTimeoutException.class,
        org.springframework.web.context.request.async.AsyncRequestNotUsableException.class
    })
    public ResponseEntity<Void> handleAsyncDisconnect(Exception ex) {
        logger.debug("Client closed or timed out async SSE stream: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @ExceptionHandler(java.io.IOException.class)
    public ResponseEntity<Void> handleIOException(java.io.IOException ex) {
        if (ex.getClass().getName().contains("ClientAbortException") || 
            (ex.getMessage() != null && (ex.getMessage().contains("Broken pipe") || ex.getMessage().contains("connection was aborted")))) {
            logger.debug("Client aborted SSE stream: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
        }
        logger.error("IO Exception during API request", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
    }

    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLockingFailure(org.springframework.orm.ObjectOptimisticLockingFailureException ex) {
        logger.warn("Optimistic locking conflict detected: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "This record was updated concurrently by another user or operation. Please refresh the page and try again."
        );
        problem.setTitle("Conflict Detected");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ProblemDetail> handleMaxUploadSize(org.springframework.web.multipart.MaxUploadSizeExceededException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "File size exceeds the allowed limit (max 3MB). Please compress the image or document and try again."
        );
        problem.setTitle("File Size Too Large");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(problem);
    }

    @ExceptionHandler({
        org.springframework.web.multipart.support.MissingServletRequestPartException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class
    })
    public ResponseEntity<ProblemDetail> handleMissingRequestPart(Exception ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "Required request parameter or file part is missing: " + ex.getMessage()
        );
        problem.setTitle("Missing Request Part");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(org.springframework.web.multipart.MultipartException.class)
    public ResponseEntity<ProblemDetail> handleMultipartException(org.springframework.web.multipart.MultipartException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "Failed to parse multipart file upload: " + ex.getMessage()
        );
        problem.setTitle("Multipart Upload Error");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGenericException(Exception ex) {
        String correlationId = java.util.UUID.randomUUID().toString().substring(0, 8);
        logger.error("Unhandled Exception in API request [CorrelationRef: {}]", correlationId, ex);

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected internal error occurred. Please quote reference ID: " + correlationId
        );
        problem.setTitle("Internal Server Error");
        problem.setProperty("correlationId", correlationId);
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }
}
