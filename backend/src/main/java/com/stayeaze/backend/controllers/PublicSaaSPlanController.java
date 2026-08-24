package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
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
    public ResponseEntity<?> getPublicSaaSPlans() {
        List<SaaSPlan> plans = saasPlanRepository.findAll();
        if (plans.isEmpty()) {
            SaaSPlan starter = new SaaSPlan("Starter PG", "STARTER", new BigDecimal("1499"), new BigDecimal("14390"), 1, 30, 2, false, false, "Ideal for single building PGs");
            SaaSPlan pro = new SaaSPlan("Professional PG", "PROFESSIONAL", new BigDecimal("2999"), new BigDecimal("28790"), 3, 100, 10, true, false, "Perfect for growing hostel businesses");
            SaaSPlan enterprise = new SaaSPlan("Enterprise PG", "ENTERPRISE", new BigDecimal("5999"), new BigDecimal("57590"), 10, 1000, 50, true, true, "Full power multi-property suite");
            plans = new ArrayList<>(List.of(starter, pro, enterprise));
        }
        return ResponseEntity.ok(plans);
    }
}
