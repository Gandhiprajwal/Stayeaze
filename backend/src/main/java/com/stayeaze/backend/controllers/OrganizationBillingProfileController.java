package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import org.springframework.cache.annotation.CacheEvict;

@RestController
@RequestMapping("/api/v1/organization-billing-profile")
public class OrganizationBillingProfileController {
    private final OrganizationBillingProfileRepository profileRepository;
    private final OrganizationRepository organizationRepository;
    private final com.stayeaze.backend.repository.PropertyRepository propertyRepository;

    public OrganizationBillingProfileController(OrganizationBillingProfileRepository profileRepository,
                                                OrganizationRepository organizationRepository,
                                                com.stayeaze.backend.repository.PropertyRepository propertyRepository) {
        this.profileRepository = profileRepository;
        this.organizationRepository = organizationRepository;
        this.propertyRepository = propertyRepository;
    }

    private Organization getLoggedUserOrg() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetailsImpl userDetails) || userDetails.getOrgId() == null) {
            throw new IllegalStateException("A signed-in organization user is required");
        }
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new IllegalStateException("Organization not found"));
    }

    private OrganizationBillingProfile getOrCreateProfile() {
        Organization organization = getLoggedUserOrg();
        OrganizationBillingProfile bp = profileRepository.findByOrganization(organization).orElse(null);
        if (bp == null) {
            try {
                bp = profileRepository.save(new OrganizationBillingProfile(organization));
            } catch (Exception e) {
                bp = new OrganizationBillingProfile(organization);
            }
        }

        try {
            boolean updated = false;
            if ((bp.getPan() == null || bp.getPan().isBlank()) || (bp.getRegistrationNumber() == null || bp.getRegistrationNumber().isBlank())) {
                java.util.List<com.stayeaze.backend.models.Property> props = propertyRepository.findByOrganizationId(organization.getId());
                for (com.stayeaze.backend.models.Property p : props) {
                    if ((bp.getPan() == null || bp.getPan().isBlank()) && p.getLandlordPan() != null && !p.getLandlordPan().isBlank()) {
                        String panVal = p.getLandlordPan().trim().toUpperCase();
                        if (panVal.length() == 10 && panVal.matches("[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}")) {
                            bp.setPan(panVal);
                            updated = true;
                        }
                    }
                    if ((bp.getRegistrationNumber() == null || bp.getRegistrationNumber().isBlank()) && p.getPgLicenseNo() != null && !p.getPgLicenseNo().isBlank()) {
                        bp.setRegistrationNumber(p.getPgLicenseNo().trim());
                        updated = true;
                    }
                    if ((bp.getGstin() == null || bp.getGstin().isBlank()) && p.getGstin() != null && !p.getGstin().isBlank()) {
                        String gstinVal = p.getGstin().trim().toUpperCase();
                        if (gstinVal.length() == 15) {
                            bp.setGstin(gstinVal);
                            updated = true;
                        }
                    }
                }
                if (updated) {
                    bp = profileRepository.save(bp);
                }
            }
        } catch (Exception ignored) {}
        return bp;
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<OrganizationBillingProfile> getProfile() {
        return ResponseEntity.ok(getOrCreateProfile());
    }

    @GetMapping("/default-deposit")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN') or hasRole('TENANT')")
    public ResponseEntity<?> getDefaultSecurityDeposit() {
        OrganizationBillingProfile bp = getOrCreateProfile();
        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("defaultSecurityDeposit", bp.getDefaultSecurityDeposit());
        return ResponseEntity.ok(res);
    }

    @PutMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<OrganizationBillingProfile> updateProfile(@RequestBody OrganizationBillingProfile request) {
        OrganizationBillingProfile profile = getOrCreateProfile();
        profile.setLegalName(request.getLegalName());
        profile.setBillingAddress(request.getBillingAddress());
        profile.setCity(request.getCity());
        profile.setState(request.getState());
        profile.setPincode(request.getPincode());
        profile.setSupportEmail(request.getSupportEmail());
        profile.setSupportPhone(request.getSupportPhone());
        profile.setGstin(request.getGstin());
        profile.setPan(request.getPan());
        profile.setRegistrationNumber(request.getRegistrationNumber());
        profile.setInvoicePrefix(request.getInvoicePrefix() == null || request.getInvoicePrefix().isBlank() ? "INV" : request.getInvoicePrefix().trim().toUpperCase());
        profile.setPaymentDueDays(request.getPaymentDueDays() == null || request.getPaymentDueDays() < 0 ? 7 : request.getPaymentDueDays());
        profile.setDefaultSecurityDeposit(request.getDefaultSecurityDeposit() != null && request.getDefaultSecurityDeposit().compareTo(java.math.BigDecimal.ZERO) >= 0 ? request.getDefaultSecurityDeposit() : java.math.BigDecimal.ZERO);
        profile.setLateFeeNote(request.getLateFeeNote());
        profile.setBankAccountName(request.getBankAccountName());
        profile.setBankName(request.getBankName());
        profile.setBankAccountNumber(request.getBankAccountNumber());
        profile.setBankIfsc(request.getBankIfsc());
        profile.setUpiVpa(request.getUpiVpa());
        profile.setAuthorizedSignatory(request.getAuthorizedSignatory());
        if (request.getRazorpayKeyId() != null) {
            profile.setRazorpayKeyId(request.getRazorpayKeyId().trim());
        }
        if (request.getRazorpayKeySecret() != null && !request.getRazorpayKeySecret().isBlank() && !request.getRazorpayKeySecret().contains("•")) {
            profile.setRazorpayKeySecret(request.getRazorpayKeySecret().trim());
        }
        profile.setInvoiceTerms(request.getInvoiceTerms());
        profile.setUpdatedAt(java.time.OffsetDateTime.now());
        return ResponseEntity.ok(profileRepository.save(profile));
    }

    @PostMapping("/upgrade-plan")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> upgradeSubscriptionPlan(
            @RequestParam String planName,
            @RequestParam java.math.BigDecimal planPrice,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle) {
        OrganizationBillingProfile profile = getOrCreateProfile();
        profile.setSubscriptionPlanName(planName);
        profile.setSubscriptionPlanPrice(planPrice);
        profile.setSubscriptionBillingCycle(billingCycle.toUpperCase());
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionStartDate(java.time.OffsetDateTime.now());
        profile.setSubscriptionEndDate("ANNUAL".equalsIgnoreCase(billingCycle) ? java.time.OffsetDateTime.now().plusYears(1) : java.time.OffsetDateTime.now().plusMonths(1));
        profile.setSubscriptionPaymentId("pay_upgrade_" + java.util.UUID.randomUUID().toString().substring(0, 8));
        profile.setUpdatedAt(java.time.OffsetDateTime.now());
        OrganizationBillingProfile saved = profileRepository.save(profile);

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("message", "Subscription plan successfully upgraded to " + planName + " (" + billingCycle.toUpperCase() + ")!");
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/cancel-subscription")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    @CacheEvict(value = "my-subscription", allEntries = true)
    public ResponseEntity<?> cancelSubscription() {
        OrganizationBillingProfile profile = getOrCreateProfile();
        profile.setSubscriptionStatus("CANCELLED_AT_PERIOD_END");
        profile.setUpdatedAt(java.time.OffsetDateTime.now());
        OrganizationBillingProfile saved = profileRepository.save(profile);

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("message", "Subscription auto-debit cancelled. Access remains active until " + (saved.getSubscriptionEndDate() != null ? saved.getSubscriptionEndDate().toLocalDate() : "end of billing cycle") + ".");
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/pause-subscription")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    @CacheEvict(value = "my-subscription", allEntries = true)
    public ResponseEntity<?> pauseSubscription(@RequestParam(defaultValue = "1") int pauseMonths) {
        OrganizationBillingProfile profile = getOrCreateProfile();
        profile.setSubscriptionStatus("PAUSED");
        profile.setUpdatedAt(java.time.OffsetDateTime.now());
        OrganizationBillingProfile saved = profileRepository.save(profile);

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("message", "Subscription auto-debit mandate paused.");
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/resume-subscription")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    @CacheEvict(value = "my-subscription", allEntries = true)
    public ResponseEntity<?> resumeSubscription() {
        OrganizationBillingProfile profile = getOrCreateProfile();
        profile.setSubscriptionStatus("ACTIVE");
        profile.setUpdatedAt(java.time.OffsetDateTime.now());
        OrganizationBillingProfile saved = profileRepository.save(profile);

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("message", "Subscription & auto-debit mandate resumed successfully.");
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }
}
