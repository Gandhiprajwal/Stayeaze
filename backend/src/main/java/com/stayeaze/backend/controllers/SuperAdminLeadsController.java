package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.OnboardingLead;
import com.stayeaze.backend.payload.response.PageResponse;
import com.stayeaze.backend.repository.OnboardingLeadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/leads")
@PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('SUPPORT')")
public class SuperAdminLeadsController {

    @Autowired
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.repository.PropertyRepository propertyRepository;

    @GetMapping("/stats")
    public ResponseEntity<?> getLeadStats() {
        long total = leadRepository.count();
        long newLeads = leadRepository.countByStatusIgnoreCase("NEW") + leadRepository.countByStatusIgnoreCase("PENDING");
        long demoRequested = leadRepository.countByStatusIgnoreCase("DEMO_REQUESTED");
        long contacted = leadRepository.countByStatusIgnoreCase("CONTACTED");
        long converted = leadRepository.countByStatusIgnoreCase("CONVERTED") + leadRepository.countByPaymentStatusIgnoreCase("COMPLETED");
        long pendingPayment = leadRepository.countByPaymentStatusIgnoreCase("UNPAID") + leadRepository.countByStatusIgnoreCase("PENDING_PAYMENT");
        long failedOnboarding = leadRepository.countByStatusIgnoreCase("FAILED_ONBOARDING");
        long disqualified = leadRepository.countByStatusIgnoreCase("DISQUALIFIED");

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalLeads", total);
        stats.put("newLeads", newLeads);
        stats.put("demoRequestedLeads", demoRequested);
        stats.put("contactedLeads", contacted);
        stats.put("convertedLeads", converted);
        stats.put("pendingPaymentLeads", pendingPayment);
        stats.put("failedOnboardingLeads", failedOnboarding);
        stats.put("disqualifiedLeads", disqualified);

        return ResponseEntity.ok(stats);
    }

    @GetMapping
    public ResponseEntity<?> getOnboardingLeads(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        int validatedPage = Math.max(1, page);
        int validatedSize = Math.min(100, Math.max(1, pageSize));

        PageRequest pageRequest = PageRequest.of(validatedPage - 1, validatedSize);
        Page<OnboardingLead> leadsPage = leadRepository.searchLeads(search, status, pageRequest);
        Page<com.stayeaze.backend.payload.response.LeadSummaryDTO> dtoPage = leadsPage.map(com.stayeaze.backend.payload.response.LeadSummaryDTO::fromEntity);
        return ResponseEntity.ok(PageResponse.ofPage(dtoPage));
    }

    /**
     * Manually sync leads from existing Property records.
     * Moved out of GET to remove the DB write side-effect from a read endpoint.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/sync-from-properties")
    public ResponseEntity<?> syncLeadsFromProperties() {
        List<OnboardingLead> leads = leadRepository.findAllByOrderByCreatedAtDesc();
        List<com.stayeaze.backend.models.Property> properties = propertyRepository.findAll();

        Set<String> existingCodes = new HashSet<>();
        for (OnboardingLead l : leads) {
            if (l.getPropertyCode() != null) existingCodes.add(l.getPropertyCode());
        }

        int added = 0;
        for (com.stayeaze.backend.models.Property p : properties) {
            if (p.getCode() != null && !existingCodes.contains(p.getCode())) {
                String ownerEmail = p.getEmail() != null && !p.getEmail().isBlank() ? p.getEmail() : "owner@" + p.getCode().toLowerCase() + ".com";
                String ownerName = p.getAuthorizedSignatory() != null && !p.getAuthorizedSignatory().isBlank() ? p.getAuthorizedSignatory() : p.getName() + " Owner";
                OnboardingLead autoLead = new OnboardingLead(
                        ownerName, ownerEmail,
                        p.getPhone() != null ? p.getPhone() : "N/A",
                        p.getName(), p.getCode(),
                        "PENDING_PAYMENT", "UNPAID", null);
                leadRepository.save(autoLead);
                added++;
            }
        }
        return ResponseEntity.ok(Map.of("synced", added, "message", "Synced " + added + " new leads from properties."));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateLeadStatus(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        OnboardingLead lead = leadRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Onboarding lead not found"));

        if (body.get("status") != null) {
            lead.setStatus(body.get("status").toString());
        }
        if (body.get("paymentStatus") != null) {
            lead.setPaymentStatus(body.get("paymentStatus").toString());
        }

        OnboardingLead updated = leadRepository.save(lead);
        return ResponseEntity.ok(updated);
    }

    // 1. One-Click Resend Onboarding Invoice Email (SUPER_ADMIN only)
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/{id}/resend-invoice")
    public ResponseEntity<?> resendOnboardingInvoice(@PathVariable UUID id) {
        OnboardingLead lead = leadRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Onboarding lead not found"));

        String invoiceNum = "INV-PROP-" + (lead.getPropertyCode() != null ? lead.getPropertyCode() : "ONBOARDING");
        String checkoutPaymentUrl = "http://localhost:5173/subscription?leadId=" + lead.getId();

        emailService.sendPropertyOwnerRegistrationInvoice(
                lead.getOwnerEmail(),
                lead.getOwnerName(),
                lead.getPropertyName(),
                lead.getPropertyCode(),
                invoiceNum,
                lead.getOnboardingFee(),
                checkoutPaymentUrl
        );

        lead.setLastContactedAt(java.time.OffsetDateTime.now());
        leadRepository.save(lead);

        Map<String, Object> resp = new HashMap<>();
        resp.put("message", "Onboarding tax invoice email resent successfully to " + lead.getOwnerEmail());
        return ResponseEntity.ok(resp);
    }

    // 2. Log Sales Call Note
    @PostMapping("/{id}/notes")
    public ResponseEntity<?> addSalesNote(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        OnboardingLead lead = leadRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Onboarding lead not found"));

        String note = body.get("note") != null ? body.get("note").toString() : "";
        if (note.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Note cannot be empty"));
        }

        String existing = lead.getSalesNotes() != null ? lead.getSalesNotes() : "";
        String timestampStr = java.time.LocalDate.now() + ": ";
        String newNotes = timestampStr + note + (existing.isBlank() ? "" : "\n---\n" + existing);

        lead.setSalesNotes(newNotes);
        lead.setLastContactedAt(java.time.OffsetDateTime.now());

        OnboardingLead updated = leadRepository.save(lead);
        return ResponseEntity.ok(updated);
    }

    @Autowired
    private com.stayeaze.backend.repository.OrganizationRepository organizationRepository;

    @Autowired
    private com.stayeaze.backend.repository.UserRepository userRepository;

    @Autowired
    private com.stayeaze.backend.repository.RoleRepository roleRepository;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder encoder;

    @Autowired
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository settingsRepository;

    // 3. Send VIP Invite Code Email (SUPER_ADMIN only)
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/{id}/send-vip-invite")
    public ResponseEntity<?> sendVipInvite(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
        OnboardingLead lead = leadRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Onboarding lead not found"));

        String inviteCode = "STAYVIP";
        if (body != null && body.containsKey("inviteCode") && body.get("inviteCode") != null) {
            inviteCode = body.get("inviteCode").toString().trim().toUpperCase();
        } else {
            var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
            if (settings != null && settings.getVipInviteCodes() != null && !settings.getVipInviteCodes().isBlank()) {
                inviteCode = settings.getVipInviteCodes().split(",")[0].trim();
            }
        }

        String registrationUrl = "http://localhost:5173/signup?inviteCode=" + inviteCode + "&email=" + lead.getOwnerEmail();
        String subject = "🎟️ Your Exclusive StayEaze VIP Invite Pass - " + inviteCode;
        String content = "<h3>Congratulations " + lead.getOwnerName() + "!</h3>" +
                "<p>Your application for <strong>" + lead.getPropertyName() + "</strong> has been granted a VIP Access Pass.</p>" +
                "<p>Use invite code: <strong>" + inviteCode + "</strong> to fast-track your registration.</p>" +
                "<p><a href='" + registrationUrl + "'>Complete VIP Registration Now &rarr;</a></p>";

        emailService.dispatchEmail(lead.getOwnerEmail(), subject, content, true);

        lead.setStatus("INVITE_SENT");
        lead.setLastContactedAt(java.time.OffsetDateTime.now());
        leadRepository.save(lead);

        return ResponseEntity.ok(Map.of("message", "VIP Invite code '" + inviteCode + "' sent to " + lead.getOwnerEmail()));
    }

    @Autowired
    private com.stayeaze.backend.repository.OrganizationBillingProfileRepository organizationBillingProfileRepository;

    // 4. One-Click Convert Lead into Active Subscriber (SUPER_ADMIN only)
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/{id}/convert-to-subscriber")
    public ResponseEntity<?> convertLeadToSubscriber(@PathVariable UUID id) {
        try {
            OnboardingLead lead = leadRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Onboarding lead not found"));

            if (userRepository.existsByEmail(lead.getOwnerEmail())) {
                lead.setStatus("CONVERTED");
                leadRepository.save(lead);
                return ResponseEntity.ok(Map.of("message", "User with email " + lead.getOwnerEmail() + " already exists. Lead marked as CONVERTED."));
            }

            String subdomain = lead.getPropertyName() != null
                    ? lead.getPropertyName().toLowerCase().replaceAll("[^a-z0-9]", "") : "";
            if (subdomain.isEmpty()) subdomain = "lead" + System.currentTimeMillis();
            String originalSubdomain = subdomain;
            int count = 1;
            while (organizationRepository.existsBySubdomain(subdomain)) {
                subdomain = originalSubdomain + count;
                count++;
            }

            com.stayeaze.backend.models.Organization org = new com.stayeaze.backend.models.Organization(lead.getPropertyName(), subdomain);
            org.setStatus("ACTIVE");
            org = organizationRepository.save(org);

            // Generate a unique mobile - use lead phone if available, else generate unique
            String mobile = lead.getOwnerPhone() != null && lead.getOwnerPhone().matches("\\d{10}")
                    ? lead.getOwnerPhone()
                    : "9" + String.format("%09d", System.currentTimeMillis() % 1_000_000_000L);

            String passwordHash = lead.getPasswordHash();
            String tempPasswordPlain = null;
            if (passwordHash == null || passwordHash.isBlank()) {
                tempPasswordPlain = "Pass@" + (int)(Math.random() * 90000 + 10000);
                passwordHash = encoder.encode(tempPasswordPlain);
            }

            com.stayeaze.backend.models.User user = new com.stayeaze.backend.models.User(
                    org,
                    lead.getOwnerEmail(),
                    passwordHash,
                    mobile
            );
            user.setFirstName(lead.getOwnerName() != null ? lead.getOwnerName() : "Owner");
            user.setStatus("ACTIVE");

            com.stayeaze.backend.models.Role ownerRole = roleRepository.findByName(com.stayeaze.backend.models.ERole.OWNER)
                    .orElseGet(() -> roleRepository.save(new com.stayeaze.backend.models.Role(com.stayeaze.backend.models.ERole.OWNER, "[\"ALL\"]")));
            user.setRoles(new HashSet<>(Set.of(ownerRole)));
            userRepository.save(user);

            // Create Initial Property Master Record for workspace
            String propCode = lead.getPropertyCode() != null && !lead.getPropertyCode().isBlank()
                    ? lead.getPropertyCode()
                    : "PROP-" + (subdomain.length() > 6 ? subdomain.substring(0, 6).toUpperCase() : subdomain.toUpperCase());
            com.stayeaze.backend.models.Property prop = new com.stayeaze.backend.models.Property(
                    org,
                    lead.getPropertyName(),
                    "Primary Address"
            );
            prop.setCode(propCode);
            prop.setType("PG");
            prop.setCity("Bengaluru");
            prop.setState("Karnataka");
            prop.setPincode("560001");
            prop.setManager(lead.getOwnerName() != null ? lead.getOwnerName() : "Manager");
            prop.setPhone(mobile);
            prop.setEmail(lead.getOwnerEmail());
            prop.setStatus("ACTIVE");
            propertyRepository.save(prop);

            // Initialize Active SaaS Billing Profile
            com.stayeaze.backend.models.OrganizationBillingProfile bp = new com.stayeaze.backend.models.OrganizationBillingProfile(org);
            bp.setSubscriptionPlanName("Starter PG Plan");
            bp.setSubscriptionPlanPrice(lead.getOnboardingFee() != null ? lead.getOnboardingFee() : new java.math.BigDecimal("1499"));
            bp.setSubscriptionBillingCycle("MONTHLY");
            bp.setSubscriptionStartDate(java.time.OffsetDateTime.now());
            bp.setSubscriptionEndDate(java.time.OffsetDateTime.now().plusDays(30));
            bp.setSubscriptionStatus("ACTIVE");
            bp.setSubscriptionPaymentId("lead_conv_" + System.currentTimeMillis());
            organizationBillingProfileRepository.save(bp);

            lead.setStatus("CONVERTED");
            lead.setPaymentStatus("COMPLETED");
            leadRepository.save(lead);

            try {
                emailService.sendOrganizationApprovalEmail(
                        user.getEmail(),
                        user.getFirstName(),
                        org.getName(),
                        org.getSubdomain()
                );
            } catch (Exception ignored) {}

            return ResponseEntity.ok(Map.of(
                    "message", "Lead successfully converted to Active Subscriber!",
                    "organizationId", org.getId(),
                    "subdomain", subdomain,
                    "email", user.getEmail()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Conversion failed: " + e.getMessage()
            ));
        }
    }
}
