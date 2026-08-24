package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.AuditLog;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.repository.AuditLogRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private com.stayeaze.backend.repository.UserRepository userRepository;

    private Organization getLoggedUserOrg() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return null;
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetailsImpl userDetails) {
            if (userDetails.getOrgId() != null) {
                return organizationRepository.findById(userDetails.getOrgId()).orElse(null);
            }
        }
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        if (username != null) {
            com.stayeaze.backend.models.User user = userRepository.findByEmail(username).orElseGet(() ->
                    userRepository.findByMobile(username).orElse(null));
            if (user != null && user.getOrganization() != null) {
                return user.getOrganization();
            }
        }
        return organizationRepository.findAll().stream().findFirst().orElse(null);
    }

    private boolean isSuperAdminUser() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return false;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities() != null) {
            boolean hasSuperAdminRole = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") || a.getAuthority().equalsIgnoreCase("SUPER_ADMIN"));
            if (hasSuperAdminRole) return true;
        }
        if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
            com.stayeaze.backend.models.User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getRoles() != null) {
                return user.getRoles().stream().anyMatch(r -> r.getName() != null && (r.getName().equalsIgnoreCase("SUPER_ADMIN") || r.getName().equalsIgnoreCase("ROLE_SUPER_ADMIN")));
            }
        }
        return false;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getAuditLogs(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        boolean isSuperAdmin = isSuperAdminUser();

        int validatedPage = Math.max(0, page - 1);
        int validatedSize = Math.max(1, Math.min(100, pageSize));
        org.springframework.data.domain.Pageable pageable = 
                org.springframework.data.domain.PageRequest.of(validatedPage, validatedSize, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "timestamp"));

        org.springframework.data.domain.Page<AuditLog> logPage;
        try {
            if (isSuperAdmin) {
                logPage = auditLogRepository.findAllByOrderByTimestampDesc(pageable);
            } else {
                Organization organization = getLoggedUserOrg();
                if (organization != null) {
                    logPage = auditLogRepository.findByOrganizationOrderByTimestampDesc(organization, pageable);
                } else {
                    logPage = auditLogRepository.findAllByOrderByTimestampDesc(pageable);
                }
            }
        } catch (Exception e) {
            logPage = auditLogRepository.findAll(pageable);
        }

        if (logPage == null) {
            Map<String, Object> emptyResponse = new HashMap<>();
            emptyResponse.put("data", Collections.emptyList());
            emptyResponse.put("currentPage", page);
            emptyResponse.put("totalPages", 0);
            emptyResponse.put("totalItems", 0);
            emptyResponse.put("pageSize", validatedSize);
            return ResponseEntity.ok(emptyResponse);
        }

        // Collect usernames from this page only to batch resolve roles without N+1 queries
        Set<String> pageUsernames = logPage.getContent().stream()
                .map(AuditLog::getUsername)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, String> userRoleMap = new HashMap<>();
        for (String uname : pageUsernames) {
            userRepository.findByEmail(uname).ifPresent(u -> {
                if (u.getRoles() != null && !u.getRoles().isEmpty()) {
                    String roleName = u.getRoles().iterator().next().getName();
                    if (roleName != null) {
                        String cleanRole = roleName.replace("ROLE_", "");
                        userRoleMap.put(uname, cleanRole);
                    }
                }
            });
        }

        List<Map<String, Object>> response = logPage.getContent().stream().map(log -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", log.getId());
            map.put("timestamp", log.getTimestamp());
            map.put("user", log.getUsername() != null ? log.getUsername() : "system");
            map.put("ipAddress", log.getClientIp() != null ? log.getClientIp() : "127.0.0.1");

            String rawAction = log.getAction();
            String action = "UPDATE";
            String module = "system";
            String details = rawAction != null ? rawAction : "System operation";

            if (rawAction != null) {
                String upper = rawAction.toUpperCase();
                if (upper.contains("LOGIN") || upper.contains("LOGGED IN")) {
                    action = "LOGIN";
                    module = "auth";
                } else if (upper.contains("CREATE") || upper.contains("ADD")) {
                    action = "CREATE";
                } else if (upper.contains("DELETE") || upper.contains("REMOVE")) {
                    action = "DELETE";
                }

                if (upper.contains("PROPERTY")) module = "property";
                else if (upper.contains("TENANT")) module = "tenant";
                else if (upper.contains("BUILDING")) module = "property";
                else if (upper.contains("INVOICE") || upper.contains("BILL")) module = "billing";
                else if (upper.contains("PAYMENT")) module = "payment";
                else if (upper.contains("COMPLAINT")) module = "complaint";
                else if (upper.contains("USER")) module = "user";
                else if (upper.contains("ROLE")) module = "role";
            }

            map.put("action", action);
            map.put("module", module);
            map.put("entity", module);
            map.put("entityId", log.getId() != null ? log.getId().toString().substring(0, 8) : "");
            map.put("details", details);
            map.put("userRole", userRoleMap.getOrDefault(log.getUsername(), "ADMIN"));
            return map;
        }).collect(Collectors.toList());

        Map<String, Object> pageResponse = new HashMap<>();
        pageResponse.put("data", response);
        pageResponse.put("currentPage", page);
        pageResponse.put("totalPages", logPage.getTotalPages());
        pageResponse.put("totalItems", logPage.getTotalElements());
        pageResponse.put("pageSize", validatedSize);
        return ResponseEntity.ok(pageResponse);
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> writeCustomAudit(@RequestParam String action, HttpServletRequest request) {
        Organization organization = getLoggedUserOrg();
        if (organization == null) {
            organization = organizationRepository.findAll().stream().findFirst().orElse(null);
        }
        
        String username = "system";
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            username = SecurityContextHolder.getContext().getAuthentication().getName();
        }

        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        AuditLog log = new AuditLog(organization, username, action, ip);
        AuditLog saved = auditLogRepository.save(log);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }
}
