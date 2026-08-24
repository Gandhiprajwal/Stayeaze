package com.stayeaze.backend.config;

import com.stayeaze.backend.services.RedisCacheService;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class RedisCacheSyncAspect {

    private static final Logger logger = LoggerFactory.getLogger(RedisCacheSyncAspect.class);

    @Autowired
    private RedisCacheService redisCacheService;

    // Pointcut for all mutating REST operations in controllers
    @Pointcut("execution(* com.stayeaze.backend.controllers..*(..)) && (" +
            "@annotation(org.springframework.web.bind.annotation.PostMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PutMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.DeleteMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PatchMapping))")
    public void controllerMutatingMethods() {}

    @AfterReturning(pointcut = "controllerMutatingMethods()", returning = "result")
    public void afterMutatingOperation(JoinPoint joinPoint, Object result) {
        String controllerName = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();

        logger.debug("REST API mutation detected: {}.{}() -> Synchronizing Redis caches...", controllerName, methodName);

        try {
            if (controllerName.contains("Tenant") || controllerName.contains("PublicTenantOnboarding")) {
                redisCacheService.evictTenantCaches();
            } else if (controllerName.contains("Property")) {
                redisCacheService.evictPropertyCaches();
                redisCacheService.evictRoomBedCaches();
            } else if (controllerName.contains("Building") || controllerName.contains("Floor") ||
                    controllerName.contains("Room") || controllerName.contains("Bed")) {
                redisCacheService.evictRoomBedCaches();
            } else if (controllerName.contains("Booking") || controllerName.contains("CheckIn") ||
                    controllerName.contains("CheckOut")) {
                redisCacheService.evictBookingCheckInCaches();
            } else if (controllerName.contains("Invoice") || controllerName.contains("Payment") ||
                    controllerName.contains("Accountant") || controllerName.contains("Razorpay")) {
                redisCacheService.evictInvoicePaymentCaches();
            } else if (controllerName.contains("Complaint") || controllerName.contains("Maintenance")) {
                redisCacheService.evictComplaintMaintenanceCaches();
            } else if (controllerName.contains("Visitor") || controllerName.contains("Parcel")) {
                redisCacheService.evictVisitorCaches();
            } else if (controllerName.contains("Organization") || controllerName.contains("System") ||
                    controllerName.contains("BillingPlan") || controllerName.contains("Subscription")) {
                redisCacheService.evictOrganizationCaches();
            } else {
                // Generic safety fallback
                redisCacheService.evictAllCaches();
            }
        } catch (Exception e) {
            logger.warn("Error synchronizing Redis caches after mutation in {}: {}", controllerName, e.getMessage());
        }
    }
}
