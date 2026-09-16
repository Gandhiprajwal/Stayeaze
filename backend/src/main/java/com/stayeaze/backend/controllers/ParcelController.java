package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.ParcelRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.ParcelDTO;
import com.stayeaze.backend.repository.*;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
@Transactional(readOnly = true)
public class ParcelController {

    @Autowired
    private ParcelRepository parcelRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

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
        return null;
    }

    private String getLoggedInStaffName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl u) {
            User user = userRepository.findById(u.getId()).orElse(null);
            if (user != null && user.getFirstName() != null && !user.getFirstName().isBlank()) {
                return user.getFirstName();
            }
            return u.getUsername();
        }
        return "Desk Staff";
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("Tenant ID is required");
        }
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found"));
    }

    // 1. GET ALL PARCELS
    @GetMapping("/parcels")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD', 'ACCOUNTANT', 'SUPER_ADMIN', 'ADMIN', 'TENANT', 'STAFF')")
    public ResponseEntity<?> getAllOrgParcels() {
        if (securityUtils.isSuperAdmin()) {
            return ResponseEntity.ok(parcelRepository.findAll().stream().map(ParcelDTO::fromEntity).toList());
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_TENANT"))) {
            if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
                Tenant tenant = tenantRepository.findFirstByEmail(userDetails.getEmail()).orElse(null);
                if (tenant != null) {
                    return ResponseEntity.ok(parcelRepository.findByTenant(tenant).stream().map(ParcelDTO::fromEntity).toList());
                }
            }
        }
        try {
            Organization organization = getLoggedUserOrg();
            if (organization != null && organization.getId() != null) {
                return ResponseEntity.ok(parcelRepository.findByOrganizationId(organization.getId()).stream().map(ParcelDTO::fromEntity).toList());
            }
        } catch (Exception e) {
            // fallback
        }
        return ResponseEntity.ok(Collections.emptyList());
    }

    // 2. INTAKE PARCEL DIRECT (Desk / Security / Reception / Owner)
    @PostMapping("/parcels")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD', 'SUPER_ADMIN', 'STAFF', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> receiveParcelDirect(@Valid @RequestBody ParcelRequest request) {
        if (request.getTenantId() == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: tenantId is required!"));
        }
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(request.getTenantId());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Parcel parcel = new Parcel(tenant, request.getCourierCompany());
        parcel.setTrackingNumber(request.getTrackingNumber());
        if (request.getParcelType() != null && !request.getParcelType().isBlank()) {
            parcel.setParcelType(request.getParcelType());
        }
        if (request.getLockerLocation() != null && !request.getLockerLocation().isBlank()) {
            parcel.setLockerLocation(request.getLockerLocation());
        }
        if (request.getPhotoUrl() != null && !request.getPhotoUrl().isBlank()) {
            parcel.setPhotoUrl(request.getPhotoUrl());
        }
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            parcel.setNotes(request.getNotes());
        }
        if (tenant.getOrganization() != null) {
            parcel.setOrganization(tenant.getOrganization());
        } else {
            parcel.setOrganization(getLoggedUserOrg());
        }

        Parcel saved = parcelRepository.save(parcel);

        // Record Notification Log & Send WebSocket Alert
        try {
            String recipientPhone = tenant.getMobile() != null ? tenant.getMobile() : tenant.getEmail();
            String msg = "📦 Your " + saved.getCourierCompany() + " delivery has arrived at " +
                    (saved.getLockerLocation() != null ? saved.getLockerLocation() : "Front Desk") +
                    ". Pickup OTP: " + saved.getPickupOtp();

            NotificationLog notif = new NotificationLog(saved.getOrganization(), recipientPhone, "WHATSAPP", msg);
            notif.setStatus("SENT");
            notificationLogRepository.save(notif);

            if (webSocketNotificationService != null && tenant.getEmail() != null) {
                userRepository.findByEmail(tenant.getEmail()).ifPresent(user -> {
                    webSocketNotificationService.sendUserNotification(
                            user.getId(),
                            "📦 Delivery Arrived!",
                            msg,
                            "PARCEL_ARRIVED"
                    );
                });
            }
        } catch (Exception ignored) {}

        return new ResponseEntity<>(ParcelDTO.fromEntity(saved), HttpStatus.CREATED);
    }

    // 3. VERIFY OTP HANDOVER (Desk enters 4-digit PIN)
    @PutMapping("/parcels/{id}/verify-otp")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD', 'SUPER_ADMIN', 'STAFF', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> verifyOtpHandover(
            @PathVariable UUID id,
            @RequestBody Map<String, String> payload) {
        Parcel parcel = parcelRepository.findById(id).orElse(null);
        if (parcel == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Parcel record not found."));
        }

        String inputOtp = payload.getOrDefault("otp", "").trim();
        if (inputOtp.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: OTP is required."));
        }

        if (parcel.getPickupOtp() == null || !parcel.getPickupOtp().trim().equals(inputOtp)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid Pickup OTP. Please ask the resident for their 4-digit code."));
        }

        parcel.setStatus("COLLECTED");
        parcel.setHandedOverDate(OffsetDateTime.now());
        parcel.setHandoverMethod("OTP");
        parcel.setHandedOverBy(getLoggedInStaffName());
        parcel.setRecipientSignature("OTP_VERIFIED_" + inputOtp);

        Parcel updated = parcelRepository.save(parcel);
        return ResponseEntity.ok(ParcelDTO.fromEntity(updated));
    }

    // 4. FULL HANDOVER (Digital Signature Pad / QR / Roommate Delegate)
    @PutMapping("/parcels/{id}/handover")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD', 'SUPER_ADMIN', 'STAFF', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> handoverParcelDirect(
            @PathVariable UUID id,
            @RequestParam(required = false) String signature,
            @RequestBody(required = false) Map<String, String> body) {
        Parcel parcel = parcelRepository.findById(id).orElse(null);
        if (parcel == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Parcel record not found."));
        }

        String sig = signature;
        String method = "SIGNATURE";
        String delegateName = null;
        String delegatePhone = null;

        if (body != null) {
            if (body.containsKey("signature") && !body.get("signature").isBlank()) {
                sig = body.get("signature");
            }
            if (body.containsKey("handoverMethod")) {
                method = body.get("handoverMethod");
            }
            if (body.containsKey("delegateName")) {
                delegateName = body.get("delegateName");
            }
            if (body.containsKey("delegatePhone")) {
                delegatePhone = body.get("delegatePhone");
            }
        }

        if (sig == null || sig.isBlank()) {
            sig = "VERIFIED_AT_DESK";
        }

        parcel.setStatus("COLLECTED");
        parcel.setHandedOverDate(OffsetDateTime.now());
        parcel.setHandoverMethod(method);
        parcel.setHandedOverBy(getLoggedInStaffName());
        parcel.setRecipientSignature(sig);
        if (delegateName != null) parcel.setDelegateName(delegateName);
        if (delegatePhone != null) parcel.setDelegatePhone(delegatePhone);

        Parcel updated = parcelRepository.save(parcel);
        return ResponseEntity.ok(ParcelDTO.fromEntity(updated));
    }

    // 5. RESIDENT DELEGATE PICKUP (Authorize roommate / friend)
    @PutMapping("/parcels/{id}/delegate")
    @PreAuthorize("hasAnyRole('TENANT', 'OWNER', 'PROPERTY_MANAGER', 'SUPER_ADMIN', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> delegatePickup(
            @PathVariable UUID id,
            @RequestBody Map<String, String> payload) {
        Parcel parcel = parcelRepository.findById(id).orElse(null);
        if (parcel == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Parcel not found."));
        }

        String name = payload.getOrDefault("delegateName", "").trim();
        String phone = payload.getOrDefault("delegatePhone", "").trim();

        if (name.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Roommate/Delegate name is required."));
        }

        parcel.setDelegateName(name);
        parcel.setDelegatePhone(phone);
        Parcel updated = parcelRepository.save(parcel);

        return ResponseEntity.ok(ParcelDTO.fromEntity(updated));
    }

    // 6. SEND REMINDER TO RESIDENT (WhatsApp / In-App)
    @PostMapping("/parcels/{id}/send-reminder")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD', 'SUPER_ADMIN', 'STAFF', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> sendReminder(@PathVariable UUID id) {
        Parcel parcel = parcelRepository.findById(id).orElse(null);
        if (parcel == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Parcel not found."));
        }

        Tenant tenant = parcel.getTenant();
        if (tenant == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: No tenant attached to parcel."));
        }

        parcel.setReminderCount(parcel.getReminderCount() + 1);
        parcel.setLastRemindedAt(OffsetDateTime.now());
        parcelRepository.save(parcel);

        String recipientPhone = tenant.getMobile() != null ? tenant.getMobile() : tenant.getEmail();
        String msg = "🔔 REMINDER: Your " + parcel.getCourierCompany() + " parcel is waiting at " +
                (parcel.getLockerLocation() != null ? parcel.getLockerLocation() : "Front Desk") +
                ". Pickup OTP: " + parcel.getPickupOtp();

        NotificationLog notif = new NotificationLog(parcel.getOrganization(), recipientPhone, "WHATSAPP", msg);
        notif.setStatus("SENT");
        notificationLogRepository.save(notif);

        return ResponseEntity.ok(Map.of(
            "message", "Reminder dispatched to " + tenant.getName() + " (" + recipientPhone + ")",
            "reminderCount", parcel.getReminderCount()
        ));
    }

    // 7. MARK STATUS (RETURNED / DISCARDED / RECEIVED)
    @PutMapping("/parcels/{id}/status")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD', 'SUPER_ADMIN', 'ADMIN')")
    @Transactional
    public ResponseEntity<?> updateParcelStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> payload) {
        Parcel parcel = parcelRepository.findById(id).orElse(null);
        if (parcel == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Parcel not found."));
        }

        String newStatus = payload.getOrDefault("status", "RECEIVED").toUpperCase();
        parcel.setStatus(newStatus);
        if ("RECEIVED".equals(newStatus)) {
            parcel.setHandedOverDate(null);
            parcel.setHandedOverBy(null);
            parcel.setHandoverMethod(null);
            parcel.setRecipientSignature(null);
            if (parcel.getPickupOtp() == null || parcel.getPickupOtp().isBlank()) {
                parcel.generateOtpAndToken();
            }
        }
        if (payload.containsKey("notes")) {
            parcel.setNotes(payload.get("notes"));
        }

        Parcel updated = parcelRepository.save(parcel);
        return ResponseEntity.ok(ParcelDTO.fromEntity(updated));
    }

    // 8. TENANT PORTAL SPECIFIC ENDPOINTS
    @GetMapping("/tenants/{tenantId}/parcels")
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'SUPER_ADMIN', 'TENANT', 'ADMIN')")
    public ResponseEntity<?> getTenantParcels(@PathVariable UUID tenantId) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<ParcelDTO> parcels = parcelRepository.findByTenant(tenant)
                .stream()
                .map(ParcelDTO::fromEntity)
                .toList();
        return ResponseEntity.ok(parcels);
    }

    @PostMapping("/tenants/{tenantId}/parcels")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    @Transactional
    public ResponseEntity<?> receiveParcel(@PathVariable UUID tenantId, @Valid @RequestBody ParcelRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Parcel parcel = new Parcel(tenant, request.getCourierCompany());
        parcel.setTrackingNumber(request.getTrackingNumber());
        if (request.getParcelType() != null) parcel.setParcelType(request.getParcelType());
        if (request.getLockerLocation() != null) parcel.setLockerLocation(request.getLockerLocation());
        if (tenant.getOrganization() != null) {
            parcel.setOrganization(tenant.getOrganization());
        } else {
            parcel.setOrganization(getLoggedUserOrg());
        }

        Parcel saved = parcelRepository.save(parcel);
        return new ResponseEntity<>(ParcelDTO.fromEntity(saved), HttpStatus.CREATED);
    }

    @PutMapping("/tenants/{tenantId}/parcels/{id}/handover")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    @Transactional
    public ResponseEntity<?> handoverParcel(
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @RequestParam String signature) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Parcel parcel = parcelRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (parcel == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Parcel record not found."));
        }

        parcel.setStatus("COLLECTED");
        parcel.setHandedOverDate(OffsetDateTime.now());
        parcel.setRecipientSignature(signature);

        Parcel updated = parcelRepository.save(parcel);
        return ResponseEntity.ok(ParcelDTO.fromEntity(updated));
    }
}
