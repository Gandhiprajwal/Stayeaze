package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.JwtResponse;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.jwt.JwtUtils;
import com.stayeaze.backend.security.services.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/subscribers")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminSubscriberController {

    @Autowired
    OrganizationRepository organizationRepository;

    @Autowired
    OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PropertyRepository propertyRepository;

    @Autowired
    BedRepository bedRepository;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    RefreshTokenService refreshTokenService;

    @GetMapping
    public ResponseEntity<?> getAllSubscribers() {
        List<Organization> orgs = organizationRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Organization org : orgs) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", org.getId());
            item.put("name", org.getName());
            item.put("subdomain", org.getSubdomain());
            item.put("createdAt", org.getCreatedAt());

            // Owner User Details
            List<User> users = userRepository.findByOrganizationId(org.getId());
            User owner = users.stream()
                    .filter(u -> u.getRoles().stream().anyMatch(r -> r.getName().contains("OWNER")))
                    .findFirst()
                    .orElse(users.isEmpty() ? null : users.get(0));

            if (owner != null) {
                item.put("ownerName", owner.getFirstName() != null && !owner.getFirstName().isBlank() ? owner.getFirstName() : owner.getEmail());
                item.put("ownerEmail", owner.getEmail());
                item.put("ownerMobile", owner.getMobile());
            } else {
                item.put("ownerName", "N/A");
                item.put("ownerEmail", "N/A");
                item.put("ownerMobile", "N/A");
            }

            // Property & Capacity Metrics
            List<Property> properties = propertyRepository.findByOrganization(org);
            item.put("propertyCount", properties.size());
            
            int totalBeds = properties.stream().mapToInt(Property::getTotalBeds).sum();
            int occupiedBeds = properties.stream().mapToInt(Property::getOccupiedBeds).sum();
            item.put("totalBeds", totalBeds);
            item.put("occupiedBeds", occupiedBeds);

            // Subscription Details
            Optional<OrganizationBillingProfile> bpOpt = organizationBillingProfileRepository.findByOrganization(org);
            if (bpOpt.isPresent()) {
                OrganizationBillingProfile bp = bpOpt.get();
                item.put("planName", bp.getSubscriptionPlanName() != null ? bp.getSubscriptionPlanName() : "Starter PG Plan");
                item.put("planPrice", bp.getSubscriptionPlanPrice() != null ? bp.getSubscriptionPlanPrice() : 1499);
                item.put("billingCycle", bp.getSubscriptionBillingCycle() != null ? bp.getSubscriptionBillingCycle() : "MONTHLY");
                item.put("startDate", bp.getSubscriptionStartDate() != null ? bp.getSubscriptionStartDate() : org.getCreatedAt());
                item.put("endDate", bp.getSubscriptionEndDate() != null ? bp.getSubscriptionEndDate() : org.getCreatedAt().plusDays(30));
                
                String status = bp.getSubscriptionStatus() != null ? bp.getSubscriptionStatus() : "ACTIVE";
                if (bp.getSubscriptionEndDate() != null && bp.getSubscriptionEndDate().isBefore(OffsetDateTime.now())) {
                    status = "EXPIRED";
                }
                item.put("status", status);
                item.put("paymentId", bp.getSubscriptionPaymentId());
                item.put("orderId", bp.getSubscriptionOrderId());
                item.put("gstin", bp.getGstin());
            } else {
                item.put("planName", "Starter PG Plan");
                item.put("planPrice", 1499);
                item.put("billingCycle", "MONTHLY");
                item.put("startDate", org.getCreatedAt());
                item.put("endDate", org.getCreatedAt().plusDays(30));
                item.put("status", "ACTIVE");
            }

            result.add(item);
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{orgId}/extend")
    public ResponseEntity<?> extendSubscription(@PathVariable UUID orgId, @RequestParam(defaultValue = "30") int days) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Organization not found"));

        OrganizationBillingProfile bp = organizationBillingProfileRepository.findByOrganization(org)
                .orElseGet(() -> new OrganizationBillingProfile(org));

        OffsetDateTime currentEnd = bp.getSubscriptionEndDate() != null && bp.getSubscriptionEndDate().isAfter(OffsetDateTime.now()) 
                ? bp.getSubscriptionEndDate() 
                : OffsetDateTime.now();

        OffsetDateTime newEnd = currentEnd.plusDays(days);
        bp.setSubscriptionEndDate(newEnd);
        bp.setSubscriptionStatus("ACTIVE");
        organizationBillingProfileRepository.save(bp);

        Map<String, Object> res = new HashMap<>();
        res.put("message", "Subscription validity extended by " + days + " days successfully.");
        res.put("newEndDate", newEnd);
        res.put("status", "ACTIVE");
        return ResponseEntity.ok(res);
    }

    @PostMapping("/{orgId}/impersonate")
    public ResponseEntity<?> impersonateSubscriber(@PathVariable UUID orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new RuntimeException("Organization not found"));

        List<User> users = userRepository.findByOrganizationId(org.getId());
        User owner = users.stream()
                .filter(u -> u.getRoles().stream().anyMatch(r -> r.getName().contains("OWNER")))
                .findFirst()
                .orElse(users.isEmpty() ? null : users.get(0));

        if (owner == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("No owner account found for this subscriber organization"));
        }

        String jwt = jwtUtils.generateTokenFromUsername(owner.getEmail());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(owner.getId());

        List<String> roles = new ArrayList<>();
        owner.getRoles().forEach(r -> roles.add(r.getName()));

        return ResponseEntity.ok(new JwtResponse(jwt,
                refreshToken.getToken(),
                owner.getId(),
                owner.getEmail(),
                org.getId(),
                roles));
    }
}
