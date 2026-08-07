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

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getAuditLogs() {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        List<AuditLog> logs;
        if (isSuperAdmin) {
            logs = auditLogRepository.findAll();
        } else {
            Organization organization = getLoggedUserOrg();
            logs = auditLogRepository.findByOrganization(organization);
        }

        List<Map<String, Object>> response = logs.stream().map(log -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", log.getId());
            map.put("timestamp", log.getTimestamp());
            map.put("user", log.getUsername());
            map.put("ipAddress", log.getClientIp() != null ? log.getClientIp() : "127.0.0.1");

            String rawAction = log.getAction();
            String action = "UPDATE";
            String module = "system";
            String details = rawAction;

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
            map.put("entityId", log.getId().toString().substring(0, 8));
            map.put("details", details);

            String userRole = "ADMIN";
            if (log.getUsername().contains("admin@stayeaze.com")) {
                userRole = "SUPER_ADMIN";
            } else if (log.getUsername().contains("owner") || log.getUsername().contains("rahul")) {
                userRole = "ADMIN";
            } else if (log.getUsername().contains("manager")) {
                userRole = "PROPERTY_MANAGER";
            } else if (log.getUsername().contains("tenant")) {
                userRole = "TENANT";
            }
            map.put("userRole", userRole);

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<?> writeCustomAudit(@RequestParam String action, HttpServletRequest request) {
        Organization organization = getLoggedUserOrg();
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        
        String ip = request.getRemoteAddr();
        AuditLog log = new AuditLog(organization, userDetails.getUsername(), action, ip);
        AuditLog saved = auditLogRepository.save(log);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }
}
