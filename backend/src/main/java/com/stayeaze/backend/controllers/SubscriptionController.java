package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/subscription")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SubscriptionController {

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private com.stayeaze.backend.services.SaaSInvoiceService saasInvoiceService;

    @Autowired
    private SystemIntegrationSettingsRepository integrationSettingsRepository;

    private Organization getLoggedUserOrg() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetailsImpl userDetails) {
            if (userDetails.getOrgId() != null) {
                Optional<Organization> org = organizationRepository.findById(userDetails.getOrgId());
                if (org.isPresent()) return org.get();
            }
        }
        List<Organization> orgs = organizationRepository.findAll();
        if (!orgs.isEmpty()) {
            return orgs.get(0);
        }
        Organization defaultOrg = new Organization("StayEaze PG Group", "stayeaze");
        return organizationRepository.save(defaultOrg);
    }

    private OrganizationBillingProfile getOrCreateProfile(Organization org) {
        return profileRepository.findByOrganization(org).orElseGet(() -> {
            OrganizationBillingProfile bp = new OrganizationBillingProfile(org);
            bp.setBrandName(org.getName());
            return profileRepository.save(bp);
        });
    }

    private int getPlanRank(String planName) {
        if (planName == null) return 1;
        String s = planName.toUpperCase();
        if (s.contains("ENTERPRISE") || s.contains("CUSTOM")) return 3;
        if (s.contains("PROFESSIONAL") || s.contains("PRO")) return 2;
        return 1; // STARTER
    }

    private boolean isDowngradeTransition(String currentPlanName, String currentCycle, String targetPlanName, String targetCycle) {
        String curC = currentCycle != null ? currentCycle.toUpperCase() : "MONTHLY";
        String tgtC = targetCycle != null ? targetCycle.toUpperCase() : "MONTHLY";

        // Monthly to Annual is ALWAYS a paid annual commitment upgrade (never a 0-rupee downgrade)
        if ("MONTHLY".equals(curC) && "ANNUAL".equals(tgtC)) {
            return false;
        }

        // Annual to Monthly is ALWAYS a downgrade (large unused annual credit converted to monthly days)
        if ("ANNUAL".equals(curC) && "MONTHLY".equals(tgtC)) {
            return true;
        }

        // Same billing cycle: Compare plan tier ranks
        int currentRank = getPlanRank(currentPlanName);
        int targetRank = getPlanRank(targetPlanName);
        return targetRank < currentRank;
    }

    public static class ProrationDetails {
        public double currentPlanPrice;
        public double targetPlanPrice;
        public String currentCycle;
        public String targetCycle;
        public double currentPerDay;
        public double targetPerDay;
        public long totalCycleDays;
        public long targetCycleDays;
        public long daysRemaining;
        public long daysUsed;
        public double usedAmount;
        public double unusedCredit;
        public double netPayable;
        public long extraDays;
        public boolean isDowngrade;
        public boolean isSamePlanAndCycle;
        public boolean isExpiredOrLocked;
        public boolean skipPayment;
        public OffsetDateTime newEndDate;
    }

    private ProrationDetails calculateProration(OrganizationBillingProfile profile, String targetPlanName, BigDecimal targetPlanPrice, String targetCycle) {
        ProrationDetails p = new ProrationDetails();
        OffsetDateTime now = OffsetDateTime.now();

        p.currentCycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle().toUpperCase() : "MONTHLY";
        p.targetCycle = targetCycle != null ? targetCycle.toUpperCase() : "MONTHLY";

        p.currentPlanPrice = profile.getSubscriptionPlanPrice() != null ? profile.getSubscriptionPlanPrice().doubleValue() : ("ANNUAL".equals(p.currentCycle) ? 14990.0 : 1499.0);
        p.targetPlanPrice = targetPlanPrice != null ? targetPlanPrice.doubleValue() : ("ANNUAL".equals(p.targetCycle) ? 14990.0 : 1499.0);

        p.totalCycleDays = "ANNUAL".equals(p.currentCycle) ? 365L : 30L;
        p.targetCycleDays = "ANNUAL".equals(p.targetCycle) ? 365L : 30L;

        p.currentPerDay = p.currentPlanPrice / (double) p.totalCycleDays;
        p.targetPerDay = p.targetPlanPrice / (double) p.targetCycleDays;

        OffsetDateTime startDate = profile.getSubscriptionStartDate() != null ? profile.getSubscriptionStartDate() : now.minusDays(5);
        OffsetDateTime endDate = profile.getSubscriptionEndDate() != null ? profile.getSubscriptionEndDate() : startDate.plusDays(p.totalCycleDays);

        p.isExpiredOrLocked = "EXPIRED".equalsIgnoreCase(profile.getSubscriptionStatus()) 
                || "PAYMENT_LOCKED".equalsIgnoreCase(profile.getSubscriptionStatus())
                || "SUSPENDED".equalsIgnoreCase(profile.getSubscriptionStatus())
                || endDate.isBefore(now);

        p.daysRemaining = p.isExpiredOrLocked ? 0L : Math.min(p.totalCycleDays, Math.max(0L, Duration.between(now, endDate).toDays()));
        p.daysUsed = p.isExpiredOrLocked ? p.totalCycleDays : Math.max(0L, p.totalCycleDays - p.daysRemaining);

        p.unusedCredit = p.isExpiredOrLocked ? 0.0 : Math.round((p.daysRemaining * p.currentPerDay) * 100.0) / 100.0;
        p.usedAmount = Math.max(0.0, Math.round((p.currentPlanPrice - p.unusedCredit) * 100.0) / 100.0);

        p.isDowngrade = isDowngradeTransition(profile.getSubscriptionPlanName(), p.currentCycle, targetPlanName, p.targetCycle);
        p.isSamePlanAndCycle = profile.getSubscriptionPlanName() != null 
                && profile.getSubscriptionPlanName().equalsIgnoreCase(targetPlanName) 
                && p.currentCycle.equalsIgnoreCase(p.targetCycle);

        if (p.isExpiredOrLocked) {
            p.netPayable = Math.round(p.targetPlanPrice * 100.0) / 100.0;
            p.unusedCredit = 0.0;
            p.extraDays = 0L;
            p.skipPayment = false;
            p.newEndDate = now.plusDays(p.targetCycleDays);
        } else if (p.isSamePlanAndCycle) {
            p.netPayable = Math.round(p.targetPlanPrice * 100.0) / 100.0;
            p.unusedCredit = 0.0;
            p.extraDays = 0L;
            p.skipPayment = false;
            p.newEndDate = (endDate.isAfter(now) ? endDate : now).plusDays(p.targetCycleDays);
        } else if (p.isDowngrade) {
            p.netPayable = 0.0;
            p.skipPayment = true;
            p.extraDays = p.targetPerDay > 0 ? Math.round(p.unusedCredit / p.targetPerDay) : 0L;
            p.newEndDate = now.plusDays(p.extraDays > 0 ? p.extraDays : p.targetCycleDays);
        } else {
            p.netPayable = Math.round(Math.max(0.0, p.targetPlanPrice - p.unusedCredit) * 100.0) / 100.0;
            p.extraDays = 0L;
            p.skipPayment = (p.netPayable <= 0.0);
            p.newEndDate = now.plusDays(p.targetCycleDays);
        }

        return p;
    }

    @GetMapping("/my-subscription")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> getMySubscriptionDetails() {
        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        List<Property> properties = propertyRepository.findByOrganization(org);
        List<Bed> allBeds = bedRepository.findByOrganizationId(org.getId());
        
        int totalBeds = 0;
        int occupiedBeds = 0;
        if (!allBeds.isEmpty()) {
            totalBeds = allBeds.size();
            occupiedBeds = (int) allBeds.stream().filter(b -> b.getStatus() != null && 
                    ("OCCUPIED".equalsIgnoreCase(b.getStatus()) || "BOOKED".equalsIgnoreCase(b.getStatus()))).count();
        } else {
            totalBeds = properties.stream().mapToInt(Property::getTotalBeds).sum();
            occupiedBeds = properties.stream().mapToInt(Property::getOccupiedBeds).sum();
        }

        String planName = profile.getSubscriptionPlanName() != null ? profile.getSubscriptionPlanName() : "Starter PG Plan";
        BigDecimal planPrice = profile.getSubscriptionPlanPrice() != null ? profile.getSubscriptionPlanPrice() : new BigDecimal("1499");
        String billingCycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle() : "MONTHLY";
        String status = profile.getSubscriptionStatus() != null ? profile.getSubscriptionStatus() : "ACTIVE";

        int maxProperties = 1;
        int maxBeds = 30;
        Optional<SaaSPlan> activePlanOpt = saasPlanRepository.findByNameIgnoreCase(planName);
        if (activePlanOpt.isEmpty()) {
            String pKey = planName.toLowerCase().contains("enterprise") ? "ENTERPRISE" : planName.toLowerCase().contains("pro") ? "PROFESSIONAL" : "STARTER";
            activePlanOpt = saasPlanRepository.findByPlanKey(pKey);
        }
        if (activePlanOpt.isPresent()) {
            maxProperties = activePlanOpt.get().getMaxProperties() != null ? activePlanOpt.get().getMaxProperties() : 1;
            maxBeds = activePlanOpt.get().getMaxBeds() != null ? activePlanOpt.get().getMaxBeds() : 30;
        } else {
            if (planName.toLowerCase().contains("pro")) {
                maxProperties = 3;
                maxBeds = 100;
            } else if (planName.toLowerCase().contains("enterprise") || planName.toLowerCase().contains("custom")) {
                maxProperties = 10;
                maxBeds = 500;
            }
        }

        long totalCycleDays = "ANNUAL".equalsIgnoreCase(billingCycle) ? 365 : 30;
        OffsetDateTime startDate = profile.getSubscriptionStartDate() != null ? profile.getSubscriptionStartDate() : OffsetDateTime.now().minusDays(5);
        OffsetDateTime endDate = profile.getSubscriptionEndDate() != null ? profile.getSubscriptionEndDate() : startDate.plusDays(totalCycleDays);
        long daysRemaining = Math.max(0, Duration.between(OffsetDateTime.now(), endDate).toDays());

        Map<String, Object> res = new HashMap<>();
        res.put("orgId", org.getId());
        res.put("orgName", org.getName());
        res.put("subdomain", org.getSubdomain());
        res.put("planName", planName);
        res.put("planPrice", planPrice);
        res.put("billingCycle", billingCycle);
        res.put("status", status);
        res.put("startDate", startDate);
        res.put("endDate", endDate);
        res.put("daysRemaining", daysRemaining);
        res.put("lastDowngradedAt", profile.getLastDowngradedAt());
        res.put("totalBeds", totalBeds);
        res.put("occupiedBeds", occupiedBeds);
        res.put("maxBeds", maxBeds);
        res.put("propertyCount", properties.size());
        res.put("maxProperties", maxProperties);

        boolean downgradeCooldownActive = profile.getLastDowngradedAt() != null 
                && profile.getLastDowngradedAt().plusDays(90).isAfter(OffsetDateTime.now());
        res.put("downgradeCooldownActive", downgradeCooldownActive);
        if (profile.getLastDowngradedAt() != null) {
            res.put("downgradeEligibleAfter", profile.getLastDowngradedAt().plusDays(90));
        }

        Map<String, Object> usage = new HashMap<>();
        usage.put("currentProperties", properties.size());
        usage.put("maxProperties", maxProperties);
        usage.put("currentBeds", totalBeds);
        usage.put("totalBeds", totalBeds);
        usage.put("maxBeds", maxBeds);
        usage.put("occupiedBeds", occupiedBeds);
        res.put("usage", usage);

        return ResponseEntity.ok(res);
    }

    @GetMapping("/check-downgrade-eligibility")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> checkDowngradeEligibility(
            @RequestParam String targetPlanName,
            @RequestParam(required = false, defaultValue = "MONTHLY") String billingCycle) {
        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);
        
        boolean isDowngrade = isDowngradeTransition(profile.getSubscriptionPlanName(), profile.getSubscriptionBillingCycle(), targetPlanName, billingCycle);

        Map<String, Object> res = new HashMap<>();
        res.put("isDowngrade", isDowngrade);
        res.put("currentPlanName", profile.getSubscriptionPlanName());
        res.put("targetPlanName", targetPlanName);

        if (!isDowngrade) {
            res.put("canDowngrade", true);
            res.put("eligible", true);
            return ResponseEntity.ok(res);
        }

        // Check 90-day lock-in period
        boolean cooldownLocked = profile.getLastDowngradedAt() != null 
                && profile.getLastDowngradedAt().plusDays(90).isAfter(OffsetDateTime.now());
        res.put("cooldownLocked", cooldownLocked);
        if (profile.getLastDowngradedAt() != null) {
            res.put("lastDowngradedAt", profile.getLastDowngradedAt().toString());
            res.put("nextEligibleAt", profile.getLastDowngradedAt().plusDays(90).toString());
        }

        if (cooldownLocked) {
            res.put("canDowngrade", false);
            res.put("eligible", false);
            res.put("message", "Plan Downgrade Restricted: SaaS plan downgrades are locked to once every 3 months (90 days). Your last downgrade was on " 
                    + profile.getLastDowngradedAt().toLocalDate() + ". You are eligible to downgrade again after " 
                    + profile.getLastDowngradedAt().plusDays(90).toLocalDate() + ".");
            return ResponseEntity.ok(res);
        }

        int targetRank = getPlanRank(targetPlanName);
        SaaSPlan targetPlan = saasPlanRepository.findByNameIgnoreCase(targetPlanName)
                .orElse(saasPlanRepository.findByPlanKey(targetRank == 2 ? "PROFESSIONAL" : "STARTER").orElse(null));

        int maxProps = targetPlan != null ? targetPlan.getMaxProperties() : (targetRank == 2 ? 5 : 1);
        int maxBeds = targetPlan != null ? targetPlan.getMaxBeds() : (targetRank == 2 ? 150 : 30);

        List<Property> allProps = propertyRepository.findAllByOrgId(org.getId());
        List<Property> activeProps = allProps.stream().filter(p -> p.getStatus() == null || !"INACTIVE".equalsIgnoreCase(p.getStatus())).toList();

        int activePropsCount = activeProps.size();
        int activeBedsCount = activeProps.stream().mapToInt(Property::getTotalBeds).sum();

        boolean quotaExceeded = activePropsCount > maxProps || activeBedsCount > maxBeds;

        res.put("targetMaxProperties", maxProps);
        res.put("targetMaxBeds", maxBeds);
        res.put("currentActiveProperties", activePropsCount);
        res.put("currentActiveBeds", activeBedsCount);
        res.put("quotaExceeded", quotaExceeded);
        res.put("canDowngrade", !quotaExceeded);
        res.put("eligible", !quotaExceeded);

        List<Map<String, Object>> propList = allProps.stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("totalBeds", p.getTotalBeds());
            m.put("status", p.getStatus() != null ? p.getStatus() : "ACTIVE");
            return m;
        }).toList();
        res.put("properties", propList);

        if (quotaExceeded) {
            res.put("message", "Subscription Quota Exceeded: Your organization currently has " + activePropsCount + " active properties and " 
                    + activeBedsCount + " active beds, but " + targetPlanName + " allows a maximum of " 
                    + maxProps + " property(s) and " + maxBeds + " beds.");
        }

        return ResponseEntity.ok(res);
    }

    @PostMapping("/deactivate-properties")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deactivateProperties(@RequestBody Map<String, Object> request) {
        Organization org = getLoggedUserOrg();
        Object rawIds = request.get("propertyIds");
        if (rawIds == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("No property IDs provided."));
        }
        List<UUID> propertyIds = new ArrayList<>();
        if (rawIds instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) {
                    try {
                        propertyIds.add(UUID.fromString(item.toString().trim()));
                    } catch (Exception ignored) {}
                }
            }
        }
        if (propertyIds.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("No valid property IDs provided."));
        }
        int count = 0;
        for (UUID pid : propertyIds) {
            Optional<Property> pOpt = propertyRepository.findById(pid);
            if (pOpt.isPresent()) {
                Property p = pOpt.get();
                p.setStatus("INACTIVE");
                propertyRepository.save(p);
                count++;
            }
        }
        return ResponseEntity.ok(Map.of(
            "success", true,
            "deactivatedCount", count,
            "message", count + " property(s) successfully marked INACTIVE."
        ));
    }

    @org.springframework.beans.factory.annotation.Value("${razorpay.key.id:}")
    private String envRazorpayKeyId;

    @org.springframework.beans.factory.annotation.Value("${razorpay.key.secret:}")
    private String envRazorpayKeySecret;

    private String[] getPlatformRazorpayKeys() {
        // 1. Primary: Check database (Super Admin System Integration Settings)
        List<SystemIntegrationSettings> settingsList = integrationSettingsRepository.findAll();
        if (!settingsList.isEmpty()) {
            SystemIntegrationSettings settings = settingsList.get(0);
            String keyId = settings.getRazorpayMasterKeyId();
            String keySecret = settings.getRazorpayMasterKeySecret();
            if (keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank()) {
                return new String[]{keyId.trim(), keySecret.trim()};
            }
        }
        // 2. Secondary fallback: Check application.yml / environment variables
        if (envRazorpayKeyId != null && !envRazorpayKeyId.isBlank() && envRazorpayKeySecret != null && !envRazorpayKeySecret.isBlank()) {
            return new String[]{envRazorpayKeyId.trim(), envRazorpayKeySecret.trim()};
        }
        return null;
    }

    @PostMapping("/create-upgrade-order")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createUpgradeOrder(
            @RequestParam(required = false, defaultValue = "Starter Plan") String planName,
            @RequestParam(required = false, defaultValue = "1499") BigDecimal planPrice,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle) {

        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        ProrationDetails proration = calculateProration(profile, planName, planPrice, billingCycle);

        // 1. 90-Day Lock-in Check for Downgrades
        if (proration.isDowngrade) {
            if (profile.getLastDowngradedAt() != null && profile.getLastDowngradedAt().plusDays(90).isAfter(OffsetDateTime.now())) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                    "Plan Downgrade Restricted: SaaS plan downgrades are locked to once every 3 months (90 days). Your last downgrade was on " 
                    + profile.getLastDowngradedAt().toLocalDate() + ". You are eligible to downgrade again after " 
                    + profile.getLastDowngradedAt().plusDays(90).toLocalDate() + "."
                ));
            }

            int targetRank = getPlanRank(planName);
            SaaSPlan targetPlan = saasPlanRepository.findByNameIgnoreCase(planName)
                    .orElse(saasPlanRepository.findByPlanKey(targetRank == 2 ? "PROFESSIONAL" : "STARTER").orElse(null));

            int maxProps = targetPlan != null ? targetPlan.getMaxProperties() : (targetRank == 2 ? 5 : 1);
            int maxBeds = targetPlan != null ? targetPlan.getMaxBeds() : (targetRank == 2 ? 150 : 30);

            List<Property> orgProps = propertyRepository.findAllByOrgId(org.getId());
            List<Property> activeProps = orgProps.stream()
                    .filter(p -> p.getStatus() == null || !"INACTIVE".equalsIgnoreCase(p.getStatus()))
                    .toList();
            int activePropsCount = activeProps.size();
            int activeBedsCount = activeProps.stream().mapToInt(Property::getTotalBeds).sum();

            if (activePropsCount > maxProps || activeBedsCount > maxBeds) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                    "Subscription Quota Exceeded: Your organization has " + activePropsCount + " active properties and " 
                    + activeBedsCount + " active beds, but " + planName + " allows up to " 
                    + maxProps + " property(s) and " + maxBeds + " beds. Please deactivate or delete excess properties before downgrading."
                ));
            }
        }

        // Get platform Razorpay keys
        String[] keys = getPlatformRazorpayKeys();
        if (keys == null || proration.skipPayment) {
            String mockOrderId = "order_sub_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
            long amountInPaise = Math.round(proration.netPayable * 100);

            Map<String, Object> res = new HashMap<>();
            res.put("orderId", mockOrderId);
            res.put("keyId", keys != null ? keys[0] : "rzp_test_NotConfigured");
            res.put("amount", amountInPaise);
            res.put("amountFormatted", proration.netPayable);
            res.put("currency", "INR");
            res.put("planName", planName);
            res.put("orgName", org.getName());
            res.put("skipPayment", proration.skipPayment);
            res.put("isUpgrade", !proration.isDowngrade);
            res.put("isDowngrade", proration.isDowngrade);
            res.put("netPayable", proration.netPayable);
            return ResponseEntity.ok(res);
        }

        long amountInPaise = Math.round(proration.netPayable * 100);
        String orderId = "order_sub_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);

        if (keys[0].startsWith("rzp_") && !keys[0].contains("MockKey")) {
            try {
                com.razorpay.RazorpayClient razorpayClient = new com.razorpay.RazorpayClient(keys[0], keys[1]);
                org.json.JSONObject orderReq = new org.json.JSONObject();
                orderReq.put("amount", amountInPaise);
                orderReq.put("currency", "INR");
                orderReq.put("receipt", "SUB-UPG-" + (System.currentTimeMillis() % 1000000L));
                orderReq.put("notes", new org.json.JSONObject()
                        .put("orgId", org.getId().toString())
                        .put("planName", planName)
                        .put("billingCycle", billingCycle)
                        .put("type", proration.isDowngrade ? "subscription_downgrade" : "subscription_upgrade"));
                com.razorpay.Order order = razorpayClient.orders.create(orderReq);
                if (order.has("id")) {
                    orderId = order.get("id");
                }
            } catch (Exception e) {
                System.err.println("Razorpay order creation error for subscription: " + e.getMessage());
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("orderId", orderId);
        res.put("keyId", keys[0]);
        res.put("amount", amountInPaise);
        res.put("amountFormatted", proration.netPayable);
        res.put("currency", "INR");
        res.put("planName", planName);
        res.put("orgName", org.getName());
        res.put("skipPayment", false);
        res.put("isUpgrade", !proration.isDowngrade);
        res.put("isDowngrade", proration.isDowngrade);
        res.put("netPayable", proration.netPayable);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/preview-switch")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> previewPlanSwitch(
            @RequestParam String targetPlanName,
            @RequestParam BigDecimal targetPlanPrice,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle) {

        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        ProrationDetails p = calculateProration(profile, targetPlanName, targetPlanPrice, billingCycle);

        Map<String, Object> res = new HashMap<>();
        res.put("currentPlanName", profile.getSubscriptionPlanName() != null ? profile.getSubscriptionPlanName() : "Starter PG Plan");
        res.put("currentPlanPrice", p.currentPlanPrice);
        res.put("targetPlanName", targetPlanName);
        res.put("targetPlanPrice", p.targetPlanPrice);
        res.put("billingCycle", billingCycle);
        res.put("daysUsed", p.daysUsed);
        res.put("daysRemaining", p.daysRemaining);
        res.put("totalCycleDays", p.totalCycleDays);
        res.put("usedAmount", p.usedAmount);
        res.put("unusedCredit", p.unusedCredit);
        res.put("isUpgrade", !p.isDowngrade);
        res.put("isDowngrade", p.isDowngrade);
        res.put("netPayable", p.netPayable);
        res.put("extraDays", p.extraDays);
        res.put("newEndDate", p.newEndDate);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/upgrade")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = "my-subscription", allEntries = true)
    public ResponseEntity<?> upgradeSubscription(
            @RequestParam(required = false, defaultValue = "Starter Plan") String planName,
            @RequestParam(required = false, defaultValue = "1499") BigDecimal planPrice,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle,
            @RequestParam(required = false) String razorpayPaymentId,
            @RequestParam(required = false) String razorpayOrderId,
            @RequestParam(required = false) String razorpaySignature) {

        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        ProrationDetails p = calculateProration(profile, planName, planPrice, billingCycle);

        // Check 90-Day Lock-in for Downgrades
        if (p.isDowngrade) {
            if (profile.getLastDowngradedAt() != null && profile.getLastDowngradedAt().plusDays(90).isAfter(OffsetDateTime.now())) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                    "Plan Downgrade Restricted: SaaS plan downgrades are locked to once every 3 months (90 days). Your last downgrade was on " 
                    + profile.getLastDowngradedAt().toLocalDate() + ". You are eligible to downgrade again after " 
                    + profile.getLastDowngradedAt().plusDays(90).toLocalDate() + "."
                ));
            }

            int targetRank = getPlanRank(planName);
            SaaSPlan targetPlan = saasPlanRepository.findByNameIgnoreCase(planName)
                    .orElse(saasPlanRepository.findByPlanKey(targetRank == 2 ? "PROFESSIONAL" : "STARTER").orElse(null));

            int maxProps = targetPlan != null ? targetPlan.getMaxProperties() : (targetRank == 2 ? 5 : 1);
            int maxBeds = targetPlan != null ? targetPlan.getMaxBeds() : (targetRank == 2 ? 150 : 30);

            List<Property> orgProps = propertyRepository.findAllByOrgId(org.getId());
            List<Property> activeProps = orgProps.stream()
                    .filter(p1 -> p1.getStatus() == null || !"INACTIVE".equalsIgnoreCase(p1.getStatus()))
                    .toList();
            int activePropsCount = activeProps.size();
            int activeBedsCount = activeProps.stream().mapToInt(Property::getTotalBeds).sum();

            if (activePropsCount > maxProps || activeBedsCount > maxBeds) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                    "Subscription Quota Exceeded: Your organization has " + activePropsCount + " active properties and " 
                    + activeBedsCount + " active beds, but " + planName + " allows up to " 
                    + maxProps + " property(s) and " + maxBeds + " beds. Please deactivate or delete excess properties before downgrading."
                ));
            }

            profile.setLastDowngradedAt(OffsetDateTime.now());
        }

        // Validate payment reference for paid upgrades when live platform keys are configured
        if (!p.isDowngrade && !p.skipPayment && p.netPayable > 0) {
            String[] keys = getPlatformRazorpayKeys();
            if (keys != null && keys[0].startsWith("rzp_") && !keys[0].contains("MockKey") && !keys[0].contains("NotConfigured")) {
                if (razorpayPaymentId == null || razorpayPaymentId.isBlank() || razorpayPaymentId.startsWith("pay_sim_") || razorpayPaymentId.startsWith("pay_sandbox_")) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Payment Required: Valid Razorpay payment reference is required to complete this upgrade."));
                }
                if (razorpayOrderId != null && razorpaySignature != null && !razorpaySignature.isBlank()) {
                    try {
                        String payload = razorpayOrderId + "|" + razorpayPaymentId;
                        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
                        mac.init(new javax.crypto.spec.SecretKeySpec(keys[1].getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
                        byte[] hash = mac.doFinal(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        StringBuilder hex = new StringBuilder();
                        for (byte b : hash) {
                            hex.append(String.format("%02x", b));
                        }
                        if (!hex.toString().equals(razorpaySignature)) {
                            return ResponseEntity.badRequest().body(new MessageResponse("Payment Verification Failed: Invalid payment signature."));
                        }
                    } catch (Exception sigEx) {
                        System.err.println("Signature verification warning: " + sigEx.getMessage());
                    }
                }
            }
        }

        profile.setSubscriptionPlanName(planName);
        profile.setSubscriptionPlanPrice(planPrice);
        profile.setSubscriptionBillingCycle(billingCycle.toUpperCase());
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionStartDate(OffsetDateTime.now());
        profile.setSubscriptionEndDate(p.newEndDate);

        boolean isEnterprisePlan = planName.toLowerCase().contains("enterprise") || planName.toLowerCase().contains("custom");
        Optional<SaaSPlan> newPlanOpt = saasPlanRepository.findByNameIgnoreCase(planName);
        if (newPlanOpt.isPresent() && Boolean.TRUE.equals(newPlanOpt.get().getAllowCustomBranding())) {
            isEnterprisePlan = true;
        }

        if (isEnterprisePlan) {
            profile.setCustomBrandingEnabled(true);
        } else {
            profile.setCustomBrandingEnabled(false);
            profile.setHideStayEazeBranding(false);
        }

        if (razorpayPaymentId != null && !razorpayPaymentId.isBlank()) {
            profile.setSubscriptionPaymentId(razorpayPaymentId);
        } else {
            profile.setSubscriptionPaymentId(p.isDowngrade ? "downgrade_proration" : ("pay_rzp_" + UUID.randomUUID().toString().substring(0, 8)));
        }
        if (razorpayOrderId != null && !razorpayOrderId.isBlank()) {
            profile.setSubscriptionOrderId(razorpayOrderId);
        }
        profile.setUpdatedAt(OffsetDateTime.now());

        OrganizationBillingProfile saved = profileRepository.save(profile);

        // Auto-generate GST tax invoice for plan switch / upgrade if payment occurred
        if (!p.isDowngrade && p.netPayable > 0) {
            try {
                String effectiveTxnId = (razorpayPaymentId != null && !razorpayPaymentId.isBlank()) ? razorpayPaymentId : profile.getSubscriptionPaymentId();
                saasInvoiceService.generateInvoiceForOrg(org.getId(), p.netPayable, "PAID", planName, billingCycle, true, "Subscription Upgrade / Renewal", effectiveTxnId);
            } catch (Exception ignored) {}
        }

        Map<String, Object> res = new HashMap<>();
        String msg = p.isDowngrade
            ? "Successfully downgraded to " + planName + ". Unused credit converted to plan validity until " + p.newEndDate.toLocalDate() + "!"
            : (p.isSamePlanAndCycle ? "Successfully renewed " + planName + " until " + p.newEndDate.toLocalDate() + "!" : "Successfully activated " + planName + "!");
        
        res.put("message", msg);
        res.put("isUpgrade", !p.isDowngrade);
        res.put("isDowngrade", p.isDowngrade);
        res.put("netPayable", p.netPayable);
        res.put("subscriptionEndDate", p.newEndDate);
        res.put("razorpayPaymentId", razorpayPaymentId);
        res.put("razorpayOrderId", razorpayOrderId);
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/my-invoices")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> getMyInvoices() {
        Organization org = getLoggedUserOrg();
        List<SaaSInvoice> invoices = saasInvoiceService.getInvoicesForOrg(org);
        return ResponseEntity.ok(invoices);
    }

    @GetMapping("/invoices/{id}/html")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<String> getInvoiceHtml(@PathVariable UUID id) {
        String html = saasInvoiceService.getInvoiceHtml(id);
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.TEXT_HTML)
                .body(html);
    }
}
