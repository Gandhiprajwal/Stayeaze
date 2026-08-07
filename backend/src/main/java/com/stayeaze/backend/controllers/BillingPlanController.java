package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.BillingPlan;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.request.BillingPlanRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.BillingPlanRepository;
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
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/billing-plans")
public class BillingPlanController {

    @Autowired
    private BillingPlanRepository billingPlanRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createBillingPlan(@Valid @RequestBody BillingPlanRequest request) {
        Organization organization = getLoggedUserOrg();

        BillingPlan plan = new BillingPlan(organization, request.getName(), request.getBaseRent());
        if (request.getFoodCharges() != null) {
            plan.setFoodCharges(request.getFoodCharges());
        }
        if (request.getOtherCharges() != null) {
            plan.setOtherCharges(request.getOtherCharges());
        }
        if (request.getBillingCycle() != null) {
            plan.setBillingCycle(request.getBillingCycle());
        }

        BillingPlan saved = billingPlanRepository.save(plan);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<BillingPlan>> getAllBillingPlans() {
        Organization organization = getLoggedUserOrg();
        List<BillingPlan> plans = billingPlanRepository.findByOrganization(organization).stream()
                .filter(p -> "ACTIVE".equals(p.getStatus()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(plans);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<?> deleteBillingPlan(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        BillingPlan plan = billingPlanRepository.findByIdAndOrganization(id, organization)
                .orElse(null);

        if (plan == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Billing plan not found."));
        }

        plan.setStatus("ARCHIVED");
        billingPlanRepository.save(plan);

        return ResponseEntity.ok(new MessageResponse("Billing plan archived."));
    }
}
