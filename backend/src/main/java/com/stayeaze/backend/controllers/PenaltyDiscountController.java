package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.PenaltyDiscount;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.payload.request.PenaltyDiscountRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PenaltyDiscountRepository;
import com.stayeaze.backend.repository.TenantRepository;
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
@RequestMapping("/api/v1/tenants/{tenantId}/penalties-discounts")
public class PenaltyDiscountController {

    @Autowired
    private PenaltyDiscountRepository penaltyDiscountRepository;

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

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> applyAdjustment(@PathVariable UUID tenantId, @Valid @RequestBody PenaltyDiscountRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        if (!"PENALTY".equals(request.getType()) && !"DISCOUNT".equals(request.getType())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Type must be PENALTY or DISCOUNT."));
        }

        PenaltyDiscount adjustment = new PenaltyDiscount(tenant, request.getType(), request.getAmount(), request.getDescription());
        PenaltyDiscount saved = penaltyDiscountRepository.save(adjustment);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<?> getAdjustments(@PathVariable UUID tenantId) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<PenaltyDiscount> adjustments = penaltyDiscountRepository.findByTenant(tenant);
        return ResponseEntity.ok(adjustments);
    }

    @PutMapping("/{id}/reverse")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> reverseAdjustment(@PathVariable UUID tenantId, @PathVariable UUID id) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        PenaltyDiscount adjustment = penaltyDiscountRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (adjustment == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Adjustment record not found."));
        }

        adjustment.setStatus("REVERSED");
        PenaltyDiscount updated = penaltyDiscountRepository.save(adjustment);
        return ResponseEntity.ok(updated);
    }
}
