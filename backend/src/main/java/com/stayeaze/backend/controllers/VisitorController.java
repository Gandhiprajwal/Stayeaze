package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.models.Visitor;
import com.stayeaze.backend.payload.request.VisitorRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.PageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.repository.VisitorRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.services.WebSocketNotificationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class VisitorController {

    @Autowired
    private VisitorRepository visitorRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        List<Organization> orgs = organizationRepository.findAll();
        if (!orgs.isEmpty()) {
            return orgs.get(0);
        }
        throw new RuntimeException("Logged in Organization not found");
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
            if (t != null && (userOrg == null || (t.getOrganization() != null && t.getOrganization().getId().equals(userOrg.getId())))) {
                return t;
            }
        }

        List<Tenant> tenants = userOrg != null
                ? tenantRepository.findByOrganization(userOrg)
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

    private String generatePassCode() {
        int code = 100000 + new Random().nextInt(900000);
        return String.valueOf(code);
    }

    // 1. Management view: Get flat list of visitors
    @GetMapping("/visitors")
    public ResponseEntity<?> getFlatVisitors(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<Visitor> visitors = visitorRepository.findByOrganizationIdNative(organization.getId());
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            visitors = visitors.stream()
                    .filter(v -> v.getProperty() != null && assignedProps.contains(v.getProperty().getId()))
                    .collect(java.util.stream.Collectors.toList());
        }
        if (propertyId != null) {
            visitors = visitors.stream()
                    .filter(v -> v.getProperty() != null && propertyId.equals(v.getProperty().getId()))
                    .collect(java.util.stream.Collectors.toList());
        }
        if (status != null && !status.isBlank()) {
            visitors = visitors.stream()
                    .filter(v -> status.equalsIgnoreCase(v.getStatus()))
                    .collect(java.util.stream.Collectors.toList());
        }
        List<com.stayeaze.backend.payload.response.VisitorSummaryDTO> dtos = visitors.stream()
                .map(com.stayeaze.backend.payload.response.VisitorSummaryDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(PageResponse.of(dtos, page, pageSize));
    }

    // 2. Gate Walk-in: Security Guard / Receptionist / Staff logs visitor with Photo Capture
    @PostMapping("/visitors")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('SECURITY_GUARD')")
    @Transactional
    public ResponseEntity<?> logVisitor(@RequestBody Map<String, Object> body) {
        Organization organization = getLoggedUserOrg();

        String visitorName = body.containsKey("visitorName") ? (String) body.get("visitorName")
                : (body.containsKey("name") ? (String) body.get("name") : null);
        String visitorPhone = body.containsKey("visitorPhone") ? (String) body.get("visitorPhone")
                : (body.containsKey("phone") ? (String) body.get("phone")
                : (body.containsKey("mobileNumber") ? (String) body.get("mobileNumber") : null));

        if (visitorName == null || visitorName.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Visitor Name is required!"));
        }

        Visitor visitor = new Visitor();
        visitor.setOrganization(organization);
        visitor.setVisitorName(visitorName.trim());
        visitor.setMobileNumber(visitorPhone != null ? visitorPhone.trim() : "");
        visitor.setPurpose(body.get("purpose") != null ? body.get("purpose").toString() : "Meeting");
        visitor.setVehicleNumber(body.get("vehicleNumber") != null ? body.get("vehicleNumber").toString() : null);
        visitor.setPhotoUrl(body.get("photoUrl") != null ? body.get("photoUrl").toString() : null);
        visitor.setApprovedBy(body.get("approvedBy") != null ? body.get("approvedBy").toString() : null);

        // Generate unique passCode & QR code data
        String passCode = generatePassCode();
        visitor.setPassCode(passCode);
        visitor.setQrCodeData("SE-VP-" + passCode);

        // Link property if provided
        if (body.get("propertyId") != null && !body.get("propertyId").toString().isBlank()) {
            try {
                UUID propId = UUID.fromString(body.get("propertyId").toString());
                propertyRepository.findById(propId).ifPresent(visitor::setProperty);
            } catch (Exception ignored) {}
        }

        // Link tenant if provided
        Tenant tenant = null;
        if (body.get("tenantId") != null && !body.get("tenantId").toString().isBlank()) {
            try {
                UUID tId = UUID.fromString(body.get("tenantId").toString());
                tenant = tenantRepository.findById(tId).orElse(null);
            } catch (Exception ignored) {}
        }

        if (tenant != null) {
            visitor.setTenant(tenant);
            visitor.setTenantName((tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim());
            if (visitor.getProperty() == null && tenant.getPropertyId() != null) {
                visitor.setProperty(propertyRepository.findById(tenant.getPropertyId()).orElse(null));
            }
            // Walk-in visiting a resident requires tenant approval
            visitor.setStatus("WAITING_APPROVAL");
        } else {
            visitor.setTenantName(body.get("tenantName") != null ? body.get("tenantName").toString() : null);
            String status = body.get("status") != null ? body.get("status").toString().toUpperCase() : "CHECKED_IN";
            visitor.setStatus(status);
        }

        visitor.setCheckInTime(OffsetDateTime.now());
        Visitor saved = visitorRepository.save(visitor);

        // Broadcast real-time doorbell notification to the linked tenant
        if ("WAITING_APPROVAL".equalsIgnoreCase(saved.getStatus()) && tenant != null) {
            // Find the user account linked to this tenant by email
            userRepository.findByEmail(tenant.getEmail()).ifPresent(tenantUser -> {
                Map<String, Object> notifPayload = new HashMap<>();
                notifPayload.put("type", "VISITOR_APPROVAL_NEEDED");
                notifPayload.put("title", "🔔 Visitor at the Gate!");
                notifPayload.put("message", saved.getVisitorName() + " is waiting at the gate for your approval.");
                notifPayload.put("visitorId", saved.getId());
                notifPayload.put("visitorName", saved.getVisitorName());
                webSocketNotificationService.broadcastTopic("/topic/notifications/" + tenantUser.getId(), notifPayload);
                webSocketNotificationService.broadcastTopic("/topic/visitors", notifPayload);
            });
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(com.stayeaze.backend.payload.response.VisitorSummaryDTO.fromEntity(saved));
    }

    // 3. Tenant Pre-Registration: Generates Digital QR Gate Pass
    @PostMapping("/visitors/pre-register")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'ADMIN', 'PROPERTY_MANAGER')")
    @Transactional
    public ResponseEntity<?> preRegisterVisitorPass(@RequestBody Map<String, Object> body) {
        Tenant tenant = getAuthenticatedTenant();
        Organization organization = tenant != null ? tenant.getOrganization() : getLoggedUserOrg();

        String visitorName = (String) body.get("visitorName");
        String visitorPhone = (String) body.get("visitorPhone");
        if (visitorPhone == null) visitorPhone = (String) body.get("mobileNumber");

        if (visitorName == null || visitorName.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Visitor Name is required."));
        }

        Visitor visitor = new Visitor();
        visitor.setOrganization(organization);
        visitor.setTenant(tenant);
        if (tenant != null) {
            if (tenant.getPropertyId() != null) {
                visitor.setProperty(propertyRepository.findById(tenant.getPropertyId()).orElse(null));
            }
            visitor.setTenantName((tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim());
        }
        visitor.setVisitorName(visitorName.trim());
        visitor.setMobileNumber(visitorPhone != null ? visitorPhone.trim() : "");
        visitor.setPurpose(body.get("purpose") != null ? body.get("purpose").toString() : "Personal Visit");
        visitor.setVehicleNumber(body.get("vehicleNumber") != null ? body.get("vehicleNumber").toString() : null);
        visitor.setPhotoUrl(body.get("photoUrl") != null ? body.get("photoUrl").toString() : null);

        // Pre-registered by tenant is pre-approved
        visitor.setStatus("PRE_REGISTERED");

        String passCode = generatePassCode();
        visitor.setPassCode(passCode);
        visitor.setQrCodeData("SE-VP-" + passCode);

        if (body.get("expectedArrival") != null) {
            try {
                visitor.setExpectedArrival(OffsetDateTime.parse(body.get("expectedArrival").toString()));
            } catch (Exception e) {
                visitor.setExpectedArrival(OffsetDateTime.now());
            }
        } else {
            visitor.setExpectedArrival(OffsetDateTime.now());
        }

        Visitor saved = visitorRepository.save(visitor);
        return ResponseEntity.status(HttpStatus.CREATED).body(com.stayeaze.backend.payload.response.VisitorSummaryDTO.fromEntity(saved));
    }

    // 4. Tenant: Get all my visitor passes
    @GetMapping({"/visitors/my-passes", "/visitors/my-visitor-passes"})
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> getMyVisitorPasses() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<Visitor> list = visitorRepository.findByTenantOrderByTimeDesc(tenant);
        List<com.stayeaze.backend.payload.response.VisitorSummaryDTO> dtos = list.stream()
                .map(com.stayeaze.backend.payload.response.VisitorSummaryDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // 5. Tenant: Get live pending approval requests
    @GetMapping("/visitors/pending-tenant-approvals")
    @PreAuthorize("hasRole('TENANT')")
    public ResponseEntity<?> getPendingTenantApprovals() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<Visitor> pending = visitorRepository.findByTenantAndStatus(tenant, "WAITING_APPROVAL");
        List<com.stayeaze.backend.payload.response.VisitorSummaryDTO> dtos = pending.stream()
                .map(com.stayeaze.backend.payload.response.VisitorSummaryDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // 6. Approve Entry (Tenant or Staff)
    @PutMapping("/visitors/{id}/approve")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD')")
    public ResponseEntity<?> approveVisitorEntry(@PathVariable UUID id) {
        Visitor visitor = visitorRepository.findById(id).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Visitor record not found."));
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isTenant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_TENANT"));
        if (isTenant) {
            Tenant currentTenant = getAuthenticatedTenant();
            if (currentTenant == null || visitor.getTenant() == null || !currentTenant.getId().equals(visitor.getTenant().getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized: You can only approve your own visitors."));
            }
        } else if (!securityUtils.isSuperAdmin()) {
            Organization org = getLoggedUserOrg();
            if (visitor.getOrganization() != null && org != null && !visitor.getOrganization().getId().equals(org.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized: Visitor belongs to another organization."));
            }
        }

        visitor.setStatus("APPROVED");
        Visitor saved = visitorRepository.save(visitor);

        // Broadcast approval to all staff in the org (security guard, receptionist, etc.)
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "VISITOR_APPROVED");
        payload.put("title", "✅ Visitor Approved!");
        payload.put("message", (saved.getTenantName() != null ? saved.getTenantName() : "Tenant") + " approved entry for " + saved.getVisitorName() + ". Please let them in.");
        payload.put("visitorId", saved.getId());
        payload.put("visitorName", saved.getVisitorName());
        payload.put("tenantName", saved.getTenantName());
        webSocketNotificationService.broadcastTopic("/topic/visitors", payload);
        if (saved.getOrganization() != null) {
            webSocketNotificationService.broadcastTopic("/topic/visitors/org/" + saved.getOrganization().getId(), payload);
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.VisitorSummaryDTO.fromEntity(saved));
    }

    // 7. Deny / Reject Entry (Tenant or Staff)
    @PutMapping("/visitors/{id}/reject")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD')")
    public ResponseEntity<?> rejectVisitorEntry(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
        Visitor visitor = visitorRepository.findById(id).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Visitor record not found."));
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isTenant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_TENANT"));
        if (isTenant) {
            Tenant currentTenant = getAuthenticatedTenant();
            if (currentTenant == null || visitor.getTenant() == null || !currentTenant.getId().equals(visitor.getTenant().getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized: You can only reject your own visitors."));
            }
        } else if (!securityUtils.isSuperAdmin()) {
            Organization org = getLoggedUserOrg();
            if (visitor.getOrganization() != null && org != null && !visitor.getOrganization().getId().equals(org.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized: Visitor belongs to another organization."));
            }
        }

        visitor.setStatus("REJECTED");
        if (body != null && body.containsKey("reason")) {
            visitor.setRejectionReason(body.get("reason").toString());
        }
        Visitor saved = visitorRepository.save(visitor);

        // Broadcast rejection to all staff in the org
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "VISITOR_REJECTED");
        payload.put("title", "❌ Visitor Denied");
        payload.put("message", (saved.getTenantName() != null ? saved.getTenantName() : "Tenant") + " denied entry for " + saved.getVisitorName() + ".");
        payload.put("visitorId", saved.getId());
        payload.put("visitorName", saved.getVisitorName());
        payload.put("tenantName", saved.getTenantName());
        webSocketNotificationService.broadcastTopic("/topic/visitors", payload);
        if (saved.getOrganization() != null) {
            webSocketNotificationService.broadcastTopic("/topic/visitors/org/" + saved.getOrganization().getId(), payload);
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.VisitorSummaryDTO.fromEntity(saved));
    }

    // 8. Security Guard: Verify Pass via QR Scan or 6-digit PassCode
    @PostMapping("/visitors/verify-pass")
    @PreAuthorize("hasAnyRole('SECURITY_GUARD', 'RECEPTIONIST', 'PROPERTY_MANAGER', 'ADMIN', 'OWNER')")
    public ResponseEntity<?> verifyGatePass(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Pass Code or QR data is required."));
        }

        String cleanCode = code.trim().replaceAll("(?i)^SE-VP-", "");
        Optional<Visitor> vOpt = visitorRepository.findByPassCodeIgnoreCase(cleanCode);
        if (vOpt.isEmpty()) {
            vOpt = visitorRepository.findByQrCodeData(code.trim());
        }
        if (vOpt.isEmpty()) {
            try {
                UUID id = UUID.fromString(code.trim());
                vOpt = visitorRepository.findById(id);
            } catch (Exception ignored) {}
        }

        if (vOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Invalid or expired Gate Pass Code."));
        }

        Visitor visitor = vOpt.get();
        Map<String, Object> res = new HashMap<>();
        res.put("visitor", com.stayeaze.backend.payload.response.VisitorSummaryDTO.fromEntity(visitor));
        res.put("isValid", true);
        res.put("status", visitor.getStatus());
        res.put("visitorName", visitor.getVisitorName());
        res.put("visitorPhone", visitor.getMobileNumber());
        res.put("tenantName", visitor.getTenantName());
        res.put("purpose", visitor.getPurpose());
        res.put("photoUrl", visitor.getPhotoUrl());
        res.put("passCode", visitor.getPassCode());
        res.put("canCheckIn", "PRE_REGISTERED".equalsIgnoreCase(visitor.getStatus()) || "APPROVED".equalsIgnoreCase(visitor.getStatus()));

        return ResponseEntity.ok(res);
    }

    // 9. Update Visitor / Record Exit
    @PutMapping("/visitors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('SECURITY_GUARD')")
    public ResponseEntity<?> updateVisitor(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        Visitor visitor = visitorRepository.findById(id).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Visitor record not found."));
        }

        if (body.containsKey("visitorName")) visitor.setVisitorName((String) body.get("visitorName"));
        if (body.containsKey("name")) visitor.setVisitorName((String) body.get("name"));
        if (body.containsKey("visitorPhone")) visitor.setMobileNumber((String) body.get("visitorPhone"));
        if (body.containsKey("phone")) visitor.setMobileNumber((String) body.get("phone"));
        if (body.containsKey("mobileNumber")) visitor.setMobileNumber((String) body.get("mobileNumber"));
        if (body.containsKey("tenantName")) visitor.setTenantName((String) body.get("tenantName"));
        if (body.containsKey("purpose")) visitor.setPurpose((String) body.get("purpose"));
        if (body.containsKey("approvedBy")) visitor.setApprovedBy((String) body.get("approvedBy"));
        if (body.containsKey("photoUrl")) visitor.setPhotoUrl((String) body.get("photoUrl"));
        if (body.containsKey("vehicleNumber")) visitor.setVehicleNumber((String) body.get("vehicleNumber"));

        if (body.containsKey("status")) {
            String status = body.get("status").toString().toUpperCase();
            visitor.setStatus(status);
            if (("CHECKED_OUT".equalsIgnoreCase(status) || "EXITED".equalsIgnoreCase(status)) && visitor.getCheckOutTime() == null) {
                visitor.setCheckOutTime(OffsetDateTime.now());
            }
            if ("CHECKED_IN".equalsIgnoreCase(status) && visitor.getCheckInTime() == null) {
                visitor.setCheckInTime(OffsetDateTime.now());
            }
        }

        if (body.containsKey("exitTime") || body.containsKey("checkOutTime")) {
            visitor.setCheckOutTime(OffsetDateTime.now());
            visitor.setStatus("CHECKED_OUT");
        }

        Visitor saved = visitorRepository.save(visitor);
        return ResponseEntity.ok(saved);
    }

    // 10. Delete Visitor Pass
    @DeleteMapping("/visitors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteVisitor(@PathVariable UUID id) {
        visitorRepository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("Visitor record deleted successfully!"));
    }

    // Legacy tenant routes
    @PostMapping("/tenants/{tenantId}/visitors")
    public ResponseEntity<?> legacyPreRegisterVisitor(@PathVariable UUID tenantId, @Valid @RequestBody VisitorRequest request) {
        Organization org = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, org)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found"));

        Visitor visitor = new Visitor(tenant, request.getVisitorName(), request.getMobileNumber());
        visitor.setPurpose(request.getPurpose());
        String passCode = generatePassCode();
        visitor.setPassCode(passCode);
        visitor.setQrCodeData("SE-VP-" + passCode);
        visitor.setStatus("PRE_REGISTERED");
        visitor.setExpectedArrival(OffsetDateTime.now());

        Visitor saved = visitorRepository.save(visitor);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping("/tenants/{tenantId}/visitors")
    public ResponseEntity<?> legacyGetTenantVisitors(@PathVariable UUID tenantId) {
        Organization org = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, org)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found"));

        List<Visitor> visitors = visitorRepository.findByTenantOrderByTimeDesc(tenant);
        return ResponseEntity.ok(visitors);
    }

    @PutMapping("/tenants/{tenantId}/visitors/{id}/checkin")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('SECURITY_GUARD')")
    public ResponseEntity<?> checkInVisitor(@PathVariable UUID tenantId, @PathVariable UUID id) {
        Organization org = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, org)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found"));

        Visitor visitor = visitorRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Visitor record not found."));
        }

        visitor.setStatus("CHECKED_IN");
        visitor.setCheckInTime(OffsetDateTime.now());
        Visitor updated = visitorRepository.save(visitor);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/tenants/{tenantId}/visitors/{id}/checkout")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('SECURITY_GUARD')")
    public ResponseEntity<?> checkOutVisitor(@PathVariable UUID tenantId, @PathVariable UUID id) {
        Organization org = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, org)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found"));

        Visitor visitor = visitorRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Visitor record not found."));
        }

        visitor.setStatus("CHECKED_OUT");
        visitor.setCheckOutTime(OffsetDateTime.now());
        Visitor updated = visitorRepository.save(visitor);
        return ResponseEntity.ok(updated);
    }
}
