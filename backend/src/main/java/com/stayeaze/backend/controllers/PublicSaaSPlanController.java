package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/saas")
public class PublicSaaSPlanController {

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @GetMapping("/plans")
    @Cacheable(value = "saas_plans", key = "'public_plans'")
    public ResponseEntity<?> getPublicSaaSPlans() {
        List<SaaSPlan> plans = saasPlanRepository.findAll();
        if (plans.isEmpty()) {
            SaaSPlan starter = new SaaSPlan("Starter PG Plan", "STARTER", new BigDecimal("1499.00"), new BigDecimal("14390.00"), 1, 35, 2, false, false, "Ideal for Single-Building Standalone PGs (Up to 15 Rooms / 35 Beds in 2 & 3 sharing, 2 Staff logins).");
            starter.setAllowRazorpayOnline(true);
            SaaSPlan pro = new SaaSPlan("Growth Hostel & PG", "PROFESSIONAL", new BigDecimal("3499.00"), new BigDecimal("33590.00"), 2, 120, 6, true, false, "For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements).");
            pro.setAllowRazorpayOnline(true);
            SaaSPlan enterprise = new SaaSPlan("Enterprise Living Chain", "ENTERPRISE", new BigDecimal("7999.00"), new BigDecimal("76790.00"), 10, 500, 25, true, true, "For Multi-City Co-Living Chains (Unlimited Buildings, 500+ Beds, Bulk Rent Runs, Custom Subdomain & Priority SLA).");
            enterprise.setAllowRazorpayOnline(true);
            plans = new ArrayList<>(List.of(starter, pro, enterprise));
        }
        return ResponseEntity.ok(plans);
    }
}
