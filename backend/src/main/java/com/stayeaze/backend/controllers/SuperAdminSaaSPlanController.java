package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/plans")
public class SuperAdminSaaSPlanController {

    private static final Pattern PLAN_KEY_PATTERN = Pattern.compile("^[A-Z0-9_]{3,30}$");

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @GetMapping
    public ResponseEntity<?> getAllPlans() {
        List<SaaSPlan> plans = saasPlanRepository.findAll();
        if (plans.isEmpty()) {
            SaaSPlan starter = new SaaSPlan("Starter Plan", "STARTER", new BigDecimal("1499"), new BigDecimal("14990"), 1, 25, 2, false, false, "Ideal for single building PGs with up to 25 beds.");
            SaaSPlan pro = new SaaSPlan("Professional Plan", "PROFESSIONAL", new BigDecimal("2999"), new BigDecimal("29990"), 3, 150, 10, true, false, "Perfect for growing hostel businesses with up to 150 beds & WhatsApp alerts.");
            SaaSPlan enterprise = new SaaSPlan("Enterprise Plan", "ENTERPRISE", new BigDecimal("5999"), new BigDecimal("59990"), 10, 1000, 50, true, true, "Full power multi-property enterprise suite with unlimited automation.");
            
            saasPlanRepository.save(starter);
            saasPlanRepository.save(pro);
            saasPlanRepository.save(enterprise);

            plans = saasPlanRepository.findAll();
        }
        return ResponseEntity.ok(plans);
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createPlan(@RequestBody SaaSPlan plan) {
        if (plan == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Plan payload cannot be empty."));
        }
        if (plan.getName() == null || plan.getName().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Plan Name is required!"));
        }

        // Validate or generate plan key
        String planKey = plan.getPlanKey();
        if (planKey == null || planKey.isBlank()) {
            planKey = plan.getName().replaceAll("[^a-zA-Z0-9]", "_").toUpperCase();
        } else {
            planKey = planKey.trim().toUpperCase();
        }

        if (!PLAN_KEY_PATTERN.matcher(planKey).matches()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Plan Key must be 3-30 uppercase alphanumeric characters or underscores (e.g. STARTER, PRO_TIER)."));
        }
        plan.setPlanKey(planKey);

        // Check for duplicate plan key
        if (saasPlanRepository.findByPlanKey(planKey).isPresent()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: A plan with key '" + planKey + "' already exists."));
        }

        // Validate Prices
        if (plan.getMonthlyPrice() != null && plan.getMonthlyPrice().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Monthly price cannot be negative."));
        }
        if (plan.getAnnualPrice() != null && plan.getAnnualPrice().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Annual price cannot be negative."));
        }

        if (plan.getMonthlyPrice() == null) plan.setMonthlyPrice(new BigDecimal("1499"));
        if (plan.getAnnualPrice() == null) plan.setAnnualPrice(plan.getMonthlyPrice().multiply(new BigDecimal("10")));

        // Validate Quotas
        if (plan.getMaxProperties() != null && plan.getMaxProperties() < 1) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Max properties quota must be at least 1."));
        }
        if (plan.getMaxBeds() != null && plan.getMaxBeds() < 1) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Max beds quota must be at least 1."));
        }
        if (plan.getMaxStaffUsers() != null && plan.getMaxStaffUsers() < 1) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Max staff users quota must be at least 1."));
        }

        SaaSPlan saved = saasPlanRepository.save(plan);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updatePlan(@PathVariable UUID id, @RequestBody SaaSPlan request) {
        SaaSPlan plan = saasPlanRepository.findById(id).orElse(null);
        if (plan == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Plan not found."));
        }

        if (request.getMonthlyPrice() != null && request.getMonthlyPrice().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Monthly price cannot be negative."));
        }
        if (request.getAnnualPrice() != null && request.getAnnualPrice().compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Annual price cannot be negative."));
        }
        if (request.getMaxProperties() != null && request.getMaxProperties() < 1) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Max properties quota must be at least 1."));
        }
        if (request.getMaxBeds() != null && request.getMaxBeds() < 1) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Max beds quota must be at least 1."));
        }
        if (request.getMaxStaffUsers() != null && request.getMaxStaffUsers() < 1) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Max staff users quota must be at least 1."));
        }

        if (request.getName() != null && !request.getName().isBlank()) plan.setName(request.getName());
        if (request.getMonthlyPrice() != null) plan.setMonthlyPrice(request.getMonthlyPrice());
        if (request.getAnnualPrice() != null) plan.setAnnualPrice(request.getAnnualPrice());
        if (request.getMaxProperties() != null) plan.setMaxProperties(request.getMaxProperties());
        if (request.getMaxBeds() != null) plan.setMaxBeds(request.getMaxBeds());
        if (request.getMaxStaffUsers() != null) plan.setMaxStaffUsers(request.getMaxStaffUsers());
        if (request.getAllowWhatsApp() != null) plan.setAllowWhatsApp(request.getAllowWhatsApp());
        if (request.getAllowRazorpayOnline() != null) plan.setAllowRazorpayOnline(request.getAllowRazorpayOnline());
        if (request.getAllowCustomBranding() != null) plan.setAllowCustomBranding(request.getAllowCustomBranding());
        if (request.getIsActive() != null) plan.setIsActive(request.getIsActive());
        if (request.getDescription() != null) plan.setDescription(request.getDescription());

        SaaSPlan updated = saasPlanRepository.save(plan);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deletePlan(@PathVariable UUID id) {
        SaaSPlan plan = saasPlanRepository.findById(id).orElse(null);
        if (plan != null) {
            plan.setIsActive(false);
            saasPlanRepository.save(plan);
        }
        return ResponseEntity.ok(new MessageResponse("Plan deactivated successfully."));
    }
}
