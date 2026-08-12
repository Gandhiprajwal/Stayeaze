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

@RestController
@RequestMapping("/api/v1/organization-billing-profile")
public class OrganizationBillingProfileController {
    private final OrganizationBillingProfileRepository profileRepository;
    private final OrganizationRepository organizationRepository;

    public OrganizationBillingProfileController(OrganizationBillingProfileRepository profileRepository,
                                                OrganizationRepository organizationRepository) {
        this.profileRepository = profileRepository;
        this.organizationRepository = organizationRepository;
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
        return profileRepository.findByOrganization(organization)
                .orElseGet(() -> profileRepository.save(new OrganizationBillingProfile(organization)));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<OrganizationBillingProfile> getProfile() {
        return ResponseEntity.ok(getOrCreateProfile());
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
}
