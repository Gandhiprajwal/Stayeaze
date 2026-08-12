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
import java.util.UUID;

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

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        Organization organization = getLoggedUserOrg();
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

    @GetMapping("/complaints")
    public ResponseEntity<?> getFlatComplaints() {
        Organization organization = getLoggedUserOrg();
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        List<Complaint> complaints = complaintRepository.findByOrganizationId(organization.getId());
        if (!isSuperAdmin) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                List<UUID> assignedProps = user.getPropertyIds();
                complaints = complaints.stream()
                        .filter(c -> c.getTenant() != null && c.getTenant().getPropertyId() != null
                                && assignedProps.contains(c.getTenant().getPropertyId()))
                        .collect(java.util.stream.Collectors.toList());
            }
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

        Complaint complaint = complaintRepository.findByIdAndTenant(id, tenant).orElse(null);
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
        }

        Complaint updated = complaintRepository.save(complaint);
        return ResponseEntity.ok(updated);
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
        return new ResponseEntity<>(ComplaintDTO.fromEntity(saved), HttpStatus.CREATED);
    }

    @PutMapping("/complaints/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
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
}
