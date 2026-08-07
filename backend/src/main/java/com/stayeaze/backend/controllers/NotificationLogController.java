package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.NotificationLog;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.request.NotificationLogRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.NotificationLogRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/notification-logs")
public class NotificationLogController {

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> sendNotification(@Valid @RequestBody NotificationLogRequest request) {
        Organization organization = getLoggedUserOrg();

        NotificationLog log = new NotificationLog(organization, request.getRecipient(), request.getType(), request.getMessageContent());
        
        // Mocking message dispatch
        if (request.getRecipient().contains("error")) {
            log.setStatus("FAILED");
        } else {
            log.setStatus("SENT");
        }

        NotificationLog saved = notificationLogRepository.save(log);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<NotificationLog>> getNotificationLogs() {
        Organization organization = getLoggedUserOrg();
        List<NotificationLog> logs = notificationLogRepository.findByOrganization(organization);
        return ResponseEntity.ok(logs);
    }

    @PutMapping("/{id}/retry")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> retryNotification(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        NotificationLog log = notificationLogRepository.findById(id).orElse(null);

        if (log == null || !log.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Notification log not found."));
        }

        log.setStatus("SENT");
        NotificationLog updated = notificationLogRepository.save(log);
        return ResponseEntity.ok(updated);
    }
}
