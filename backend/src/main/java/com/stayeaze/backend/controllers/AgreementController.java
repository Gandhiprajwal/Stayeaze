package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Agreement;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.payload.request.AgreementRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.AgreementRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.TenantRepository;
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
@RequestMapping("/api/v1/tenants/{tenantId}/agreements")
public class AgreementController {

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("Tenant ID is required");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found"));

        if (securityUtils.isSuperAdmin()) {
            return tenant;
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
            boolean isTenant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_TENANT"));
            if (isTenant) {
                if (userDetails.getEmail() == null || tenant.getEmail() == null || !tenant.getEmail().equalsIgnoreCase(userDetails.getEmail())) {
                    throw new IllegalArgumentException("Unauthorized access to tenant agreement");
                }
                return tenant;
            }
        }

        Organization organization = getLoggedUserOrg();
        if (organization != null && tenant.getOrganization() != null && !organization.getId().equals(tenant.getOrganization().getId())) {
            throw new IllegalArgumentException("Tenant profile belongs to another organization");
        }
        return tenant;
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> draftAgreement(@PathVariable UUID tenantId, @Valid @RequestBody AgreementRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Agreement agreement = new Agreement(tenant, request.getTerms(), request.getStartDate(), request.getEndDate());
        if (request.getStatus() != null) {
            agreement.setStatus(request.getStatus());
        }

        Agreement saved = agreementRepository.save(agreement);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'SUPER_ADMIN', 'TENANT', 'ADMIN')")
    public ResponseEntity<?> getAllAgreements(@PathVariable UUID tenantId) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<Agreement> agreements = agreementRepository.findByTenant(tenant);
        return ResponseEntity.ok(agreements);
    }

    @PutMapping("/{id}/sign")
    @PreAuthorize("hasRole('TENANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> signAgreement(
            @PathVariable UUID tenantId,
            @PathVariable UUID id,
            @RequestParam(required = false, defaultValue = "CHECKBOX_TERMS_ACCEPTED") String signatureUrl) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Agreement agreement = agreementRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (agreement == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Agreement document not found."));
        }

        if ("SIGNED".equalsIgnoreCase(agreement.getStatus()) || agreement.getSignedAt() != null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Agreement document is already signed and legally immutable."));
        }

        OffsetDateTime now = OffsetDateTime.now();
        agreement.setStatus("SIGNED");
        agreement.setSignatureUrl(signatureUrl != null && !signatureUrl.isBlank() ? signatureUrl : "CHECKBOX_TERMS_ACCEPTED");
        agreement.setSignedAt(now);

        Agreement updated = agreementRepository.save(agreement);

        if (tenant != null) {
            tenant.setIsAgreementAccepted(true);
            tenant.setAgreementAcceptedAt(now);
            tenantRepository.save(tenant);
        }

        return ResponseEntity.ok(updated);
    }
}
