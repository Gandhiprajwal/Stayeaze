package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.ComplaintFeedbackRequest;
import com.stayeaze.backend.payload.request.ComplaintRequest;
import com.stayeaze.backend.payload.response.ComplaintDTO;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.ComplaintRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class ComplaintController {

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.repository.PropertyRepository propertyRepository;

    @Autowired
    private com.stayeaze.backend.services.WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        Organization organization = null;
        try {
            organization = getLoggedUserOrg();
        } catch (Exception ignored) {}

        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant != null) {
            if (organization == null) return tenant;
            if (tenant.getOrganization() == null || organization.getId().equals(tenant.getOrganization().getId()) || (tenant.getOrgId() != null && organization.getId().equals(tenant.getOrgId()))) {
                return tenant;
            }
        }
        return tenantRepository.findByIdAndOrganization(tenantId, organization)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found or unauthorized"));
    }

    @PostMapping("/tenants/{tenantId}/complaints")
    public ResponseEntity<?> raiseComplaint(@PathVariable UUID tenantId, @Valid @RequestBody ComplaintRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Complaint complaint = new Complaint(tenant, request.getCategory(), request.getDescription());
        if (request.getRoomId() != null) {
            Room room = roomRepository.findById(request.getRoomId()).orElse(null);
            complaint.setRoom(room);
        }

        Complaint saved = complaintRepository.save(complaint);
        broadcastComplaintCreated(saved);

        try {
            if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                String pName = "StayEaze Residency";
                if (tenant.getPropertyId() != null) {
                    Property p = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
                    if (p != null) pName = p.getName();
                }
                emailService.sendComplaintFiledEmail(
                        tenant.getEmail(),
                        tenant.getName(),
                        "TKT-" + (saved.getId().toString().substring(0, 6)).toUpperCase(),
                        saved.getCategory(),
                        saved.getDescription(),
                        pName
                );
            }
        } catch (Exception ignored) {}

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping("/tenants/{tenantId}/complaints")
    public ResponseEntity<?> getTenantComplaints(@PathVariable UUID tenantId) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<Complaint> complaints = complaintRepository.findByTenant(tenant);
        List<ComplaintDTO> dtos = complaints.stream()
                .map(ComplaintDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping({"/complaints/stats", "/tenant-portal/complaints/stats"})
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getComplaintStats(@RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<Complaint> complaints = (organization != null)
                ? complaintRepository.findByOrganizationIdAndOptionalPropertyId(organization.getId(), propertyId)
                : java.util.Collections.emptyList();

        long openCount = 0;
        long inProgressCount = 0;
        long resolvedCount = 0;
        long closedCount = 0;

        for (Complaint c : complaints) {
            String status = c.getStatus() != null ? c.getStatus().toUpperCase() : "OPEN";
            if ("OPEN".equals(status)) {
                openCount++;
            } else if ("IN_PROGRESS".equals(status)) {
                inProgressCount++;
            } else if ("RESOLVED".equals(status)) {
                resolvedCount++;
            } else if ("CLOSED".equals(status)) {
                closedCount++;
            }
        }

        java.util.Map<String, Object> stats = new java.util.HashMap<>();
        stats.put("totalComplaints", complaints.size());
        stats.put("openComplaints", openCount);
        stats.put("inProgressComplaints", inProgressCount);
        stats.put("resolvedComplaints", resolvedCount);
        stats.put("closedComplaints", closedCount);

        return ResponseEntity.ok(stats);
    }

    private Tenant getAuthenticatedTenant() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetailsImpl userDetails)) {
            return null;
        }
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null) return null;

        Organization userOrg = user.getOrganization();
        if (user.getTenantId() != null) {
            Tenant t = tenantRepository.findByIdSuperAdmin(user.getTenantId()).orElse(null);
            if (t != null) return t;
        }

        List<Tenant> tenants = userOrg != null
                ? tenantRepository.findByOrganizationIdNative(userOrg.getId())
                : tenantRepository.findAllSuperAdmin();

        for (Tenant t : tenants) {
            if ("CHECKED_OUT".equalsIgnoreCase(t.getStatus()) || "ARCHIVED".equalsIgnoreCase(t.getStatus())) {
                continue;
            }
            if (t.getEmail() != null && user.getEmail() != null && t.getEmail().trim().equalsIgnoreCase(user.getEmail().trim())) {
                return t;
            }
            if (t.getMobile() != null && user.getMobile() != null && t.getMobile().trim().equals(user.getMobile().trim())) {
                return t;
            }
        }
        return null;
    }

    @GetMapping("/complaints")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('STAFF') or hasRole('TENANT')")
    public ResponseEntity<?> getFlatComplaints(@RequestParam(required = false) UUID propertyId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        UserDetailsImpl userDetails = (principal instanceof UserDetailsImpl) ? (UserDetailsImpl) principal : null;

        boolean isTenant = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equalsIgnoreCase("ROLE_TENANT") || auth.getAuthority().equalsIgnoreCase("TENANT"));

        if (isTenant && userDetails != null) {
            Tenant tenant = getAuthenticatedTenant();
            if (tenant != null) {
                List<Complaint> tenantComplaints = complaintRepository.findByTenant(tenant);
                List<ComplaintDTO> dtos = tenantComplaints.stream()
                        .map(ComplaintDTO::fromEntity)
                        .collect(Collectors.toList());
                return ResponseEntity.ok(dtos);
            }
        }

        Organization organization = getLoggedUserOrg();
        List<Complaint> complaints = complaintRepository.findByOrganizationIdNative(organization.getId());
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            complaints = complaints.stream()
                    .filter(c -> {
                        try {
                            return c.getTenant() != null && c.getTenant().getPropertyId() != null
                                    && assignedProps.contains(c.getTenant().getPropertyId());
                        } catch (Exception ignored) {
                            return false;
                        }
                    })
                    .collect(java.util.stream.Collectors.toList());
        }

        if (propertyId != null) {
            complaints = complaints.stream()
                    .filter(c -> {
                        try {
                            return c.getTenant() != null && propertyId.equals(c.getTenant().getPropertyId());
                        } catch (Exception ignored) {
                            return false;
                        }
                    })
                    .collect(java.util.stream.Collectors.toList());
        }

        List<ComplaintDTO> dtos = complaints.stream()
                .map(com.stayeaze.backend.payload.response.ComplaintDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/tenants/{tenantId}/complaints/{id}/status")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateComplaintStatus(
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @RequestParam String status,
            @RequestParam(required = false) String staff) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Complaint complaint = complaintRepository.findByIdAndTenant(id, tenant)
                .orElseGet(() -> complaintRepository.findById(id).filter(c -> c.getTenant() != null && c.getTenant().getId().equals(tenantId)).orElse(null));
        if (complaint == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Complaint record not found."));
        }

        complaint.setStatus(status);
        if (staff != null) {
            complaint.setAssignedStaff(staff);
        }
        if ("RESOLVED".equals(status)) {
            complaint.setResolvedAt(OffsetDateTime.now());

            try {
                if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                    String pName = "StayEaze Residency";
                    if (tenant.getPropertyId() != null) {
                        Property p = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
                        if (p != null) pName = p.getName();
                    }
                    emailService.sendComplaintResolvedEmail(
                            tenant.getEmail(),
                            tenant.getName(),
                            "TKT-" + (complaint.getId().toString().substring(0, 6)).toUpperCase(),
                            complaint.getCategory(),
                            pName
                    );
                }
            } catch (Exception ignored) {}
        }

        Complaint updated = complaintRepository.save(complaint);
        broadcastComplaintUpdated(updated);
        return ResponseEntity.ok(ComplaintDTO.fromEntity(updated));
    }

    @PutMapping("/tenants/{tenantId}/complaints/{id}/feedback")
    public ResponseEntity<?> submitFeedback(
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @Valid @RequestBody ComplaintFeedbackRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Complaint complaint = complaintRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (complaint == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Complaint record not found."));
        }

        if (!"RESOLVED".equals(complaint.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Feedback can only be submitted on RESOLVED complaints."));
        }

        complaint.setFeedbackRating(request.getFeedbackRating());
        complaint.setFeedbackNotes(request.getFeedbackNotes());

        Complaint updated = complaintRepository.save(complaint);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/complaints")
    public ResponseEntity<?> createComplaintAdmin(@RequestBody java.util.Map<String, Object> body) {
        Organization organization = getLoggedUserOrg();
        String category = body.get("category") != null ? body.get("category").toString() : "OTHER";
        String description = body.get("description") != null ? body.get("description").toString() : "";
        String tenantName = body.get("tenantName") != null ? body.get("tenantName").toString() : null;
        String status = body.get("status") != null ? body.get("status").toString().toUpperCase() : "OPEN";
        String priority = body.get("priority") != null ? body.get("priority").toString().toUpperCase() : "MEDIUM";
        String assignedStaff = body.get("assignedTo") != null ? body.get("assignedTo").toString() : null;

        Tenant tenant = null;
        List<Tenant> tenants = tenantRepository.findByOrganization(organization);
        if (tenantName != null && !tenantName.isBlank()) {
            tenant = tenants.stream()
                    .filter(t -> (t.getFirstName() + " " + t.getLastName()).equalsIgnoreCase(tenantName.trim()))
                    .findFirst().orElse(null);
        }
        if (tenant == null && !tenants.isEmpty()) {
            tenant = tenants.get(0);
        }

        if (tenant == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: No tenant profile found to link complaint."));
        }

        Complaint complaint = new Complaint(tenant, category, description);
        complaint.setStatus(status);
        complaint.setPriority(priority);
        if (assignedStaff != null) complaint.setAssignedStaff(assignedStaff);
        Complaint saved = complaintRepository.save(complaint);
        broadcastComplaintCreated(saved);
        return new ResponseEntity<>(ComplaintDTO.fromEntity(saved), HttpStatus.CREATED);
    }

    @PutMapping("/complaints/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('STAFF')")
    public ResponseEntity<?> updateComplaintAdmin(@PathVariable UUID id, @RequestBody java.util.Map<String, Object> body) {
        Complaint complaint = complaintRepository.findById(id).orElse(null);
        if (complaint == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Complaint record not found."));
        }

        if (body.containsKey("category") && body.get("category") != null) {
            complaint.setCategory(body.get("category").toString());
        }
        if (body.containsKey("description") && body.get("description") != null) {
            complaint.setDescription(body.get("description").toString());
        }
        if (body.containsKey("status") && body.get("status") != null) {
            complaint.setStatus(body.get("status").toString().toUpperCase());
        }
        if (body.containsKey("priority") && body.get("priority") != null) {
            complaint.setPriority(body.get("priority").toString().toUpperCase());
        }
        if (body.containsKey("assignedTo") && body.get("assignedTo") != null) {
            complaint.setAssignedStaff(body.get("assignedTo").toString());
        }

        Complaint updated = complaintRepository.save(complaint);
        broadcastComplaintUpdated(updated);
        return ResponseEntity.ok(ComplaintDTO.fromEntity(updated));
    }

    @DeleteMapping("/complaints/{id}")
    public ResponseEntity<?> deleteComplaintAdmin(@PathVariable UUID id) {
        if (!complaintRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Complaint record not found."));
        }
        complaintRepository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("Complaint deleted successfully."));
    }

    @DeleteMapping("/complaints/bulk")
    public ResponseEntity<?> bulkDeleteComplaints(@RequestBody List<UUID> ids) {
        if (ids != null && !ids.isEmpty()) {
            complaintRepository.deleteAllById(ids);
        }
        return ResponseEntity.ok(new MessageResponse("Complaints deleted successfully."));
    }

    private void broadcastComplaintCreated(Complaint saved) {
        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "COMPLAINT_CREATED");
            payload.put("title", "🛠️ New Complaint Ticket!");
            payload.put("message", (saved.getTicketNumber() != null ? saved.getTicketNumber() : "TKT") + ": " + (saved.getDescription() != null ? saved.getDescription() : "New complaint logged"));
            payload.put("complaintId", saved.getId());
            payload.put("ticketNumber", saved.getTicketNumber());
            payload.put("status", saved.getStatus());
            payload.put("category", saved.getCategory());

            webSocketNotificationService.broadcastTopic("/topic/complaints", payload);
            if (saved.getTenant() != null && saved.getTenant().getEmail() != null) {
                userRepository.findByEmail(saved.getTenant().getEmail()).ifPresent(tu -> {
                    webSocketNotificationService.broadcastTopic("/topic/notifications/" + tu.getId(), payload);
                });
            }
        } catch (Exception ignored) {}
    }

    private void broadcastComplaintUpdated(Complaint saved) {
        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "COMPLAINT_UPDATED");
            payload.put("title", "📋 Complaint Status Updated!");
            payload.put("message", (saved.getTicketNumber() != null ? saved.getTicketNumber() : "Complaint") + " status is now " + saved.getStatus());
            payload.put("complaintId", saved.getId());
            payload.put("ticketNumber", saved.getTicketNumber());
            payload.put("status", saved.getStatus());
            payload.put("category", saved.getCategory());

            webSocketNotificationService.broadcastTopic("/topic/complaints", payload);
            webSocketNotificationService.broadcastTopic("/topic/complaints/" + saved.getId(), payload);
            if (saved.getTenant() != null && saved.getTenant().getEmail() != null) {
                userRepository.findByEmail(saved.getTenant().getEmail()).ifPresent(tu -> {
                    webSocketNotificationService.broadcastTopic("/topic/notifications/" + tu.getId(), payload);
                });
            }
        } catch (Exception ignored) {}
    }
}
