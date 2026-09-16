package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.NotificationLog;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.request.NotificationLogRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.NotificationLogDTO;
import com.stayeaze.backend.repository.NotificationLogRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/notification-logs")
@Transactional(readOnly = true)
public class NotificationLogController {

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null)
            return org;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl u) {
            var user = userRepository.findByEmail(u.getEmail() != null ? u.getEmail() : u.getUsername()).orElse(null);
            if (user != null && user.getOrganization() != null) {
                return user.getOrganization();
            }
        }
        if (securityUtils.isSuperAdmin()) {
            return organizationRepository.findAll().stream().findFirst().orElse(null);
        }
        return null;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'ADMIN', 'SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<?> sendNotification(@Valid @RequestBody NotificationLogRequest request) {
        Organization organization = getLoggedUserOrg();

        NotificationLog log = new NotificationLog(organization, request.getRecipient(), request.getType(),
                request.getMessageContent());

        // Mocking message dispatch
        if (request.getRecipient().contains("error")) {
            log.setStatus("FAILED");
        } else {
            log.setStatus("SENT");
        }

        NotificationLog saved = notificationLogRepository.save(log);
        return new ResponseEntity<>(NotificationLogDTO.fromEntity(saved), HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT')")
    public ResponseEntity<List<NotificationLogDTO>> getNotificationLogs() {
        Organization organization = getLoggedUserOrg();
        List<NotificationLog> logs = (organization != null)
                ? notificationLogRepository.findByOrganization(organization)
                : (securityUtils.isSuperAdmin() ? notificationLogRepository.findAll() : Collections.emptyList());
        List<NotificationLogDTO> dtos = logs.stream()
                .map(NotificationLogDTO::fromEntity)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/{id}/retry")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<?> retryNotification(@PathVariable UUID id) {
        NotificationLog log = notificationLogRepository.findById(id).orElse(null);
        if (log == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Notification log not found."));
        }

        if (!securityUtils.isSuperAdmin()) {
            Organization organization = getLoggedUserOrg();
            if (organization != null && log.getOrganization() != null && !log.getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new MessageResponse("Error: Unauthorized to retry this notification."));
            }
        }

        log.setStatus("SENT");
        NotificationLog updated = notificationLogRepository.save(log);
        return ResponseEntity.ok(NotificationLogDTO.fromEntity(updated));
    }

    @PostMapping("/broadcast-announcement")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> broadcastAnnouncement(@RequestBody Map<String, Object> payload) {
        String title = payload.getOrDefault("title", "").toString().trim();
        String message = payload.getOrDefault("message", "").toString().trim();
        String priority = payload.getOrDefault("priority", "HIGH").toString().trim();
        String audience = payload.getOrDefault("targetAudience", "ALL").toString().trim();

        if (title.isBlank() || message.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Title and Message are required!"));
        }

        List<Organization> targetOrgs = new ArrayList<>();
        if (securityUtils.isSuperAdmin()) {
            targetOrgs = organizationRepository.findAll().stream()
                    .filter(o -> o != null && !"system".equalsIgnoreCase(o.getSubdomain()))
                    .collect(Collectors.toList());
        } else {
            try {
                Organization currentOrg = getLoggedUserOrg();
                if (currentOrg != null) {
                    targetOrgs.add(currentOrg);
                }
            } catch (Exception e) {
                // fallback
            }
        }

        List<NotificationLog> logs = new ArrayList<>();
        for (Organization org : targetOrgs) {
            String fullMsg = "[" + priority.toUpperCase() + " NOTICE] " + title + ": " + message;
            NotificationLog log = new NotificationLog(org, audience.toUpperCase() + "_USERS", "ANNOUNCEMENT", fullMsg);
            log.setStatus("SENT");
            logs.add(log);
        }
        notificationLogRepository.saveAll(logs);

        return ResponseEntity.ok(Map.of(
            "message", "Announcement successfully broadcasted to " + targetOrgs.size() + " organization(s).",
            "targetOrgsCount", targetOrgs.size()
        ));
    }
}
