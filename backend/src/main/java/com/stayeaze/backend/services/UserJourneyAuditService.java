package com.stayeaze.backend.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.models.UserJourneyAudit;
import com.stayeaze.backend.repository.UserJourneyAuditRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class UserJourneyAuditService {

    private static final Logger logger = LoggerFactory.getLogger(UserJourneyAuditService.class);

    @Autowired
    private UserJourneyAuditRepository auditRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Parse client IP considering reverse proxy headers.
     */
    public String getClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Parse simplified device & browser string from User-Agent.
     */
    public String parseDevice(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return "Unknown Device";
        String ua = userAgent.toLowerCase();

        String browser = "Browser";
        if (ua.contains("edg")) browser = "Edge";
        else if (ua.contains("chrome") && !ua.contains("chromium")) browser = "Chrome";
        else if (ua.contains("safari") && !ua.contains("chrome")) browser = "Safari";
        else if (ua.contains("firefox")) browser = "Firefox";
        else if (ua.contains("postman")) browser = "Postman / API";

        String os = "OS";
        if (ua.contains("windows")) os = "Windows";
        else if (ua.contains("android")) os = "Android";
        else if (ua.contains("iphone") || ua.contains("ipad") || ua.contains("ios")) os = "iOS";
        else if (ua.contains("macintosh") || ua.contains("mac os")) os = "macOS";
        else if (ua.contains("linux")) os = "Linux";

        return browser + " (" + os + ")";
    }

    @Async
    public void logAuth(String email, Organization org, User user, String action, String status, Map<String, Object> detailsMap, HttpServletRequest request) {
        try {
            UserJourneyAudit audit = new UserJourneyAudit();
            audit.setCategory("AUTH");
            audit.setAction(action);
            audit.setStatus(status);
            audit.setUserEmail(email != null ? email : (user != null ? user.getEmail() : null));

            if (user != null) {
                audit.setUserId(user.getId());
                if (user.getRoles() != null && !user.getRoles().isEmpty()) {
                    audit.setUserRole(user.getRoles().iterator().next().getName());
                }
            }

            if (org != null) {
                audit.setOrganization(org);
            } else if (user != null && user.getOrganization() != null) {
                audit.setOrganization(user.getOrganization());
            }

            enrichRequestMetadata(audit, request);
            audit.setDetails(serializeDetails(detailsMap));

            auditRepository.save(audit);
        } catch (Exception e) {
            logger.warn("Failed to record auth journey audit: {}", e.getMessage());
        }
    }

    @Async
    public void logPayment(Organization org, User user, String userEmail, String category, String action, String status, String resourceId, BigDecimal amount, Map<String, Object> detailsMap, HttpServletRequest request) {
        try {
            UserJourneyAudit audit = new UserJourneyAudit();
            audit.setCategory(category != null ? category : "SAAS_BILLING");
            audit.setAction(action);
            audit.setStatus(status);
            audit.setResourceId(resourceId);
            audit.setAmount(amount);
            audit.setUserEmail(userEmail != null ? userEmail : (user != null ? user.getEmail() : null));

            if (user != null) {
                audit.setUserId(user.getId());
                if (user.getRoles() != null && !user.getRoles().isEmpty()) {
                    audit.setUserRole(user.getRoles().iterator().next().getName());
                }
            }

            if (org != null) {
                audit.setOrganization(org);
            } else if (user != null && user.getOrganization() != null) {
                audit.setOrganization(user.getOrganization());
            }

            enrichRequestMetadata(audit, request);
            audit.setDetails(serializeDetails(detailsMap));

            auditRepository.save(audit);
        } catch (Exception e) {
            logger.warn("Failed to record payment journey audit: {}", e.getMessage());
        }
    }

    @Async
    public void logOnboarding(Organization org, String email, String action, String status, Map<String, Object> detailsMap, HttpServletRequest request) {
        try {
            UserJourneyAudit audit = new UserJourneyAudit();
            audit.setCategory("ONBOARDING");
            audit.setAction(action);
            audit.setStatus(status);
            audit.setUserEmail(email);

            if (org != null) {
                audit.setOrganization(org);
            }

            enrichRequestMetadata(audit, request);
            audit.setDetails(serializeDetails(detailsMap));

            auditRepository.save(audit);
        } catch (Exception e) {
            logger.warn("Failed to record onboarding journey audit: {}", e.getMessage());
        }
    }

    @Async
    public void logAnomaly(Organization org, String email, String category, String action, String resourceId, BigDecimal amount, String errorDescription, Map<String, Object> metadata, HttpServletRequest request) {
        try {
            UserJourneyAudit audit = new UserJourneyAudit();
            audit.setCategory(category != null ? category : "SYSTEM_ERROR");
            audit.setAction(action != null ? action : "PAYMENT_DEDUCTION_ANOMALY");
            audit.setStatus("CRITICAL");
            audit.setUserEmail(email);
            audit.setResourceId(resourceId);
            audit.setAmount(amount);

            if (org != null) {
                audit.setOrganization(org);
            }

            Map<String, Object> map = metadata != null ? new HashMap<>(metadata) : new HashMap<>();
            map.put("errorDescription", errorDescription);
            map.put("anomalyFlaggedAt", OffsetDateTime.now().toString());

            enrichRequestMetadata(audit, request);
            audit.setDetails(serializeDetails(map));

            auditRepository.save(audit);
            logger.warn("🚨 [CRITICAL ANOMALY RECORDED] {} for email: {}, resource: {}", action, email, resourceId);
        } catch (Exception e) {
            logger.error("Failed to record critical anomaly audit: {}", e.getMessage());
        }
    }

    private void enrichRequestMetadata(UserJourneyAudit audit, HttpServletRequest request) {
        if (request != null) {
            String ip = getClientIp(request);
            String ua = request.getHeader("User-Agent");
            audit.setClientIp(ip);
            audit.setUserAgent(ua != null && ua.length() > 490 ? ua.substring(0, 490) : ua);
            audit.setDevice(parseDevice(ua));
        } else {
            audit.setClientIp("127.0.0.1");
            audit.setDevice("System Service / Background");
        }
    }

    private String serializeDetails(Map<String, Object> detailsMap) {
        if (detailsMap == null || detailsMap.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(detailsMap);
        } catch (Exception e) {
            return detailsMap.toString();
        }
    }
}
