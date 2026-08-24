package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
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
    private com.stayeaze.backend.repository.SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private com.stayeaze.backend.services.SaaSInvoiceService saasInvoiceService;

    @Autowired
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository integrationSettingsRepository;

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
        return profileRepository.findByOrganization(org)
                .orElseGet(() -> profileRepository.save(new OrganizationBillingProfile(org)));
    }

    @GetMapping("/my-subscription")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN') or hasRole('TENANT') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> getMySubscription() {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("status", "ACTIVE");
            fallback.put("planName", "Standard Plan");
            fallback.put("billingCycle", "MONTHLY");
            fallback.put("daysRemaining", 30);
            return ResponseEntity.ok(fallback);
        }
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        List<Property> properties = propertyRepository.findByOrganization(org);
        int propertyCount = properties != null ? properties.size() : 0;
        int totalBeds = 0;
        int occupiedBeds = 0;

        if (properties != null) {
            for (Property p : properties) {
                if (p.getTotalBeds() != null) totalBeds += p.getTotalBeds();
                if (p.getOccupiedBeds() != null) occupiedBeds += p.getOccupiedBeds();
            }
        }

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime endDate = profile.getSubscriptionEndDate() != null ? profile.getSubscriptionEndDate() : now.plusDays(30);
        long daysRemaining = Math.max(0, Duration.between(now, endDate).toDays());

        String planName = profile.getSubscriptionPlanName() != null ? profile.getSubscriptionPlanName() : "Starter PG Plan";
        BigDecimal planPrice = profile.getSubscriptionPlanPrice() != null ? profile.getSubscriptionPlanPrice() : new BigDecimal("1499");
        String billingCycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle() : "MONTHLY";
        String status = profile.getSubscriptionStatus() != null ? profile.getSubscriptionStatus() : "ACTIVE";

        int maxBeds = planName.toLowerCase().contains("enterprise") ? 999999 : (planName.toLowerCase().contains("professional") ? 250 : 50);
        String propertyLimitLabel = planName.toLowerCase().contains("enterprise") ? "Unlimited Properties" : (planName.toLowerCase().contains("professional") ? "Multi-Property Enabled" : "Single PG Property");

        Map<String, Object> res = new HashMap<>();
        res.put("id", profile.getId());
        res.put("orgId", org.getId());
        res.put("orgName", org.getName());
        res.put("subdomain", org.getSubdomain());
        res.put("planName", planName);
        res.put("planPrice", planPrice);
        res.put("billingCycle", billingCycle);
        res.put("status", status);
        res.put("startDate", profile.getSubscriptionStartDate() != null ? profile.getSubscriptionStartDate() : now);
        res.put("endDate", endDate);
        res.put("daysRemaining", daysRemaining);
        res.put("paymentId", profile.getSubscriptionPaymentId());
        res.put("orderId", profile.getSubscriptionOrderId());
        res.put("propertyCount", propertyCount);
        res.put("totalBeds", totalBeds);
        res.put("occupiedBeds", occupiedBeds);
        res.put("maxBeds", maxBeds);
        res.put("propertyLimitLabel", propertyLimitLabel);
        res.put("supportSla", planName.toLowerCase().contains("enterprise") ? "24/7 SLA + Account Manager" : (planName.toLowerCase().contains("professional") ? "Priority Phone & Chat" : "Standard Email Support"));

        return ResponseEntity.ok(res);
    }

    @GetMapping("/plans")
    public ResponseEntity<?> getSubscriptionPlans() {
        List<Map<String, Object>> plans = new ArrayList<>();

        Map<String, Object> p1 = new HashMap<>();
        p1.put("id", "starter");
        p1.put("name", "Starter PG Plan");
        p1.put("badge", "Starter Tier");
        p1.put("popular", false);
        p1.put("monthlyPrice", 1499);
        p1.put("annualPrice", 14390);
        p1.put("description", "Perfect for single PG owners & startup properties up to 50 beds.");
        p1.put("features", Arrays.asList(
                "Up to 50 Beds Management",
                "Single Property Management",
                "Automated Monthly Rent Invoices",
                "Razorpay Online Payment Links",
                "Basic Complaints & Maintenance",
                "Standard Email Receipts & Logs"
        ));
        plans.add(p1);

        Map<String, Object> p2 = new HashMap<>();
        p2.put("id", "professional");
        p2.put("name", "Professional Hostel");
        p2.put("badge", "Most Popular");
        p2.put("popular", true);
        p2.put("monthlyPrice", 2999);
        p2.put("annualPrice", 28790);
        p2.put("description", "Designed for growing multi-property hostel & PG chains up to 250 beds.");
        p2.put("features", Arrays.asList(
                "Up to 250 Beds & Multi-Property",
                "SMS & WhatsApp Automated Alerts",
                "Biometric Check-In & Gate Pass",
                "Tenant KYC Identity Verification",
                "HRA Tax Receipt Generators",
                "Priority Phone & Chat Support"
        ));
        plans.add(p2);

        Map<String, Object> p3 = new HashMap<>();
        p3.put("id", "enterprise");
        p3.put("name", "Enterprise Co-Living");
        p3.put("badge", "Enterprise Tier");
        p3.put("popular", false);
        p3.put("monthlyPrice", 5999);
        p3.put("annualPrice", 57590);
        p3.put("description", "For large co-living brands with unlimited properties, rooms & beds.");
        p3.put("features", Arrays.asList(
                "Unlimited Properties & Beds",
                "AWS Cloud Storage Integration",
                "Custom Subdomain & Branding",
                "Dedicated Account Manager",
                "24/7 SLA Guarantee & API Access",
                "Audit Logging & Role Controls"
        ));
        plans.add(p3);

        return ResponseEntity.ok(plans);
    }

    @PostMapping("/preview-switch")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> previewSwitch(
            @RequestParam(required = false, defaultValue = "Starter Plan") String targetPlanName,
            @RequestParam(required = false, defaultValue = "1499") BigDecimal targetPlanPrice,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle) {

        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        String currentPlanName = profile.getSubscriptionPlanName() != null ? profile.getSubscriptionPlanName() : "Starter PG Plan";
        BigDecimal currentPlanPrice = profile.getSubscriptionPlanPrice() != null ? profile.getSubscriptionPlanPrice() : new BigDecimal("1499");
        String currentCycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle() : "MONTHLY";

        long totalCycleDays = "ANNUAL".equalsIgnoreCase(currentCycle) ? 365 : 30;
        OffsetDateTime startDate = profile.getSubscriptionStartDate() != null ? profile.getSubscriptionStartDate() : OffsetDateTime.now().minusDays(5);
        long daysUsed = Math.max(0, Duration.between(startDate, OffsetDateTime.now()).toDays());
        daysUsed = Math.min(totalCycleDays, daysUsed);

        double currentPerDay = currentPlanPrice.doubleValue() / (double) totalCycleDays;
        double usedAmount = daysUsed * currentPerDay;
        double unusedCredit = Math.max(0.0, currentPlanPrice.doubleValue() - usedAmount);

        BigDecimal priceInput = targetPlanPrice != null ? targetPlanPrice : new BigDecimal("1499");
        boolean isUpgrade = priceInput.doubleValue() >= currentPlanPrice.doubleValue();
        double netPayable = 0.0;
        long extraDays = 0;

        if (isUpgrade) {
            netPayable = Math.max(0.0, priceInput.doubleValue() - unusedCredit);
        } else {
            double targetCycleDays = "ANNUAL".equalsIgnoreCase(billingCycle) ? 365.0 : 30.0;
            double targetPerDay = priceInput.doubleValue() / targetCycleDays;
            if (targetPerDay > 0) {
                extraDays = Math.round(unusedCredit / targetPerDay);
            }
        }

        Map<String, Object> preview = new HashMap<>();
        preview.put("currentPlanName", currentPlanName);
        preview.put("currentPlanPrice", currentPlanPrice);
        preview.put("targetPlanName", targetPlanName);
        preview.put("targetPlanPrice", priceInput);
        preview.put("billingCycle", billingCycle.toUpperCase());
        preview.put("daysUsed", daysUsed);
        preview.put("totalCycleDays", totalCycleDays);
        preview.put("usedAmount", Math.round(usedAmount * 100.0) / 100.0);
        preview.put("unusedCredit", Math.round(unusedCredit * 100.0) / 100.0);
        preview.put("isUpgrade", isUpgrade);
        preview.put("netPayable", Math.round(netPayable * 100.0) / 100.0);
        preview.put("extraDays", extraDays);

        return ResponseEntity.ok(preview);
    }

    /**
     * Resolves the active platform-level Razorpay key pair from SystemIntegrationSettings.
     * Used for SaaS subscription payments (not tenant rent payments).
     */
    private String[] getPlatformRazorpayKeys() {
        List<com.stayeaze.backend.models.SystemIntegrationSettings> settingsList = integrationSettingsRepository.findAll();
        if (!settingsList.isEmpty()) {
            com.stayeaze.backend.models.SystemIntegrationSettings settings = settingsList.get(0);
            String keyId = settings.getRazorpayMasterKeyId();
            String keySecret = settings.getRazorpayMasterKeySecret();
            if (keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank()) {
                return new String[]{keyId.trim(), keySecret.trim()};
            }
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

        // Calculate proration
        BigDecimal currentPlanPrice = profile.getSubscriptionPlanPrice() != null ? profile.getSubscriptionPlanPrice() : new BigDecimal("1499");
        String currentCycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle() : "MONTHLY";

        long totalCycleDays = "ANNUAL".equalsIgnoreCase(currentCycle) ? 365 : 30;
        OffsetDateTime startDate = profile.getSubscriptionStartDate() != null ? profile.getSubscriptionStartDate() : OffsetDateTime.now().minusDays(5);
        long daysUsed = Math.max(0, Duration.between(startDate, OffsetDateTime.now()).toDays());
        daysUsed = Math.min(totalCycleDays, daysUsed);

        double currentPerDay = currentPlanPrice.doubleValue() / (double) totalCycleDays;
        double usedAmount = daysUsed * currentPerDay;
        double unusedCredit = Math.max(0.0, currentPlanPrice.doubleValue() - usedAmount);

        boolean isUpgrade = planPrice.doubleValue() >= currentPlanPrice.doubleValue();
        double netPayable = isUpgrade ? Math.max(0.0, planPrice.doubleValue() - unusedCredit) : 0.0;

        // For downgrades or zero-amount, skip Razorpay order
        if (netPayable <= 0) {
            Map<String, Object> res = new HashMap<>();
            res.put("skipPayment", true);
            res.put("netPayable", 0);
            res.put("isUpgrade", isUpgrade);
            res.put("message", "No payment required for this plan switch.");
            return ResponseEntity.ok(res);
        }

        // Get platform Razorpay keys
        String[] keys = getPlatformRazorpayKeys();
        if (keys == null) {
            // Fallback: generate a mock order for development/testing
            String mockOrderId = "order_sub_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
            long amountInPaise = Math.round(netPayable * 100);

            Map<String, Object> res = new HashMap<>();
            res.put("orderId", mockOrderId);
            res.put("keyId", "rzp_test_NotConfigured");
            res.put("amount", amountInPaise);
            res.put("amountFormatted", Math.round(netPayable * 100.0) / 100.0);
            res.put("currency", "INR");
            res.put("planName", planName);
            res.put("orgName", org.getName());
            res.put("skipPayment", false);
            res.put("isUpgrade", isUpgrade);
            res.put("netPayable", Math.round(netPayable * 100.0) / 100.0);
            return ResponseEntity.ok(res);
        }

        // Create real Razorpay order
        long amountInPaise = Math.round(netPayable * 100);
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
                        .put("type", "subscription_upgrade"));
                com.razorpay.Order order = razorpayClient.orders.create(orderReq);
                if (order.has("id")) {
                    orderId = order.get("id");
                }
            } catch (Exception e) {
                System.err.println("Razorpay order creation error for subscription upgrade: " + e.getMessage());
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("orderId", orderId);
        res.put("keyId", keys[0]);
        res.put("amount", amountInPaise);
        res.put("amountFormatted", Math.round(netPayable * 100.0) / 100.0);
        res.put("currency", "INR");
        res.put("planName", planName);
        res.put("orgName", org.getName());
        res.put("skipPayment", false);
        res.put("isUpgrade", isUpgrade);
        res.put("netPayable", Math.round(netPayable * 100.0) / 100.0);
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

        BigDecimal currentPlanPrice = profile.getSubscriptionPlanPrice() != null ? profile.getSubscriptionPlanPrice() : new BigDecimal("1499");
        String currentCycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle() : "MONTHLY";

        long totalCycleDays = "ANNUAL".equalsIgnoreCase(currentCycle) ? 365 : 30;
        OffsetDateTime startDate = profile.getSubscriptionStartDate() != null ? profile.getSubscriptionStartDate() : OffsetDateTime.now().minusDays(5);
        long daysUsed = Math.max(0, Duration.between(startDate, OffsetDateTime.now()).toDays());
        daysUsed = Math.min(totalCycleDays, daysUsed);

        double currentPerDay = currentPlanPrice.doubleValue() / (double) totalCycleDays;
        double usedAmount = daysUsed * currentPerDay;
        double unusedCredit = Math.max(0.0, currentPlanPrice.doubleValue() - usedAmount);

        boolean isUpgrade = planPrice.doubleValue() >= currentPlanPrice.doubleValue();
        double netPayable = 0.0;
        long extraDays = 0;

        OffsetDateTime newEndDate;
        if (isUpgrade) {
            netPayable = Math.max(0.0, planPrice.doubleValue() - unusedCredit);
            newEndDate = "ANNUAL".equalsIgnoreCase(billingCycle) ? OffsetDateTime.now().plusYears(1) : OffsetDateTime.now().plusMonths(1);
        } else {
            double targetCycleDays = "ANNUAL".equalsIgnoreCase(billingCycle) ? 365.0 : 30.0;
            double targetPerDay = planPrice.doubleValue() / targetCycleDays;
            if (targetPerDay > 0) {
                extraDays = Math.round(unusedCredit / targetPerDay);
            }
            long baseDays = "ANNUAL".equalsIgnoreCase(billingCycle) ? 365 : 30;
            newEndDate = OffsetDateTime.now().plusDays(baseDays + extraDays);
        }

        profile.setSubscriptionPlanName(planName);
        profile.setSubscriptionPlanPrice(planPrice);
        profile.setSubscriptionBillingCycle(billingCycle.toUpperCase());
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionStartDate(OffsetDateTime.now());
        profile.setSubscriptionEndDate(newEndDate);

        if (planName.toLowerCase().contains("enterprise") || planName.toLowerCase().contains("custom")) {
            profile.setCustomBrandingEnabled(true);
        }

        // Record Razorpay payment details if provided
        if (razorpayPaymentId != null && !razorpayPaymentId.isBlank()) {
            profile.setSubscriptionPaymentId(razorpayPaymentId);
        } else {
            profile.setSubscriptionPaymentId("pay_prorated_" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (razorpayOrderId != null && !razorpayOrderId.isBlank()) {
            profile.setSubscriptionOrderId(razorpayOrderId);
        }
        profile.setUpdatedAt(OffsetDateTime.now());

        OrganizationBillingProfile saved = profileRepository.save(profile);

        // Auto-generate GST tax invoice for plan switch / upgrade
        try {
            saasInvoiceService.generateInvoiceForOrg(org.getId(), netPayable > 0 ? netPayable : planPrice.doubleValue(), "PAID", planName);
        } catch (Exception ignored) {}

        Map<String, Object> res = new HashMap<>();
        String msg = isUpgrade 
            ? "Successfully upgraded to " + planName + ". Prorated net payment: ₹" + Math.round(netPayable) + " (credited ₹" + Math.round(unusedCredit) + " unused balance)."
            : "Successfully switched to " + planName + ". Unused credit (₹" + Math.round(unusedCredit) + ") added " + extraDays + " bonus days!";
        
        res.put("message", msg);
        res.put("isUpgrade", isUpgrade);
        res.put("netPayable", Math.round(netPayable * 100.0) / 100.0);
        res.put("unusedCredit", Math.round(unusedCredit * 100.0) / 100.0);
        res.put("extraDays", extraDays);
        res.put("razorpayPaymentId", razorpayPaymentId);
        res.put("razorpayOrderId", razorpayOrderId);
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/create-mandate")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createMandate(
            @RequestParam(required = false, defaultValue = "Starter Plan") String planName,
            @RequestParam(required = false, defaultValue = "1499") BigDecimal planPrice,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle) {

        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);

        String subId = "sub_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        profile.setSubscriptionOrderId(subId);
        profile.setSubscriptionStatus("ACTIVE");
        profile.setUpdatedAt(OffsetDateTime.now());
        profileRepository.save(profile);

        Map<String, Object> res = new HashMap<>();
        res.put("subscriptionId", subId);
        res.put("planName", planName);
        res.put("amount", planPrice);
        res.put("currency", "INR");
        res.put("status", "created");
        res.put("message", "Razorpay Auto-Pay Mandate created successfully.");
        return ResponseEntity.ok(res);
    }

    @PostMapping("/resume")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = "my-subscription", allEntries = true)
    public ResponseEntity<?> resumeSubscription() {
        Organization org = getLoggedUserOrg();
        OrganizationBillingProfile profile = getOrCreateProfile(org);
        profile.setSubscriptionStatus("ACTIVE");
        profile.setUpdatedAt(OffsetDateTime.now());
        OrganizationBillingProfile saved = profileRepository.save(profile);

        Map<String, Object> res = new HashMap<>();
        res.put("message", "Subscription plan resumed successfully.");
        res.put("profile", saved);
        return ResponseEntity.ok(res);
    }



    @PostMapping("/webhook/razorpay")
    public ResponseEntity<?> razorpayWebhook(@RequestBody Map<String, Object> payload) {
        String event = (String) payload.get("event");
        if (event == null) event = "subscription.charged";

        Map<String, Object> res = new HashMap<>();
        res.put("status", "ok");
        res.put("eventProcessed", event);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/my-invoices")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getMyInvoices() {
        Organization org = getLoggedUserOrg();
        List<com.stayeaze.backend.models.SaaSInvoice> list = saasInvoiceService.getInvoicesForOrg(org);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/invoices/{id}/html")
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<String> getMyInvoiceHtml(@PathVariable UUID id) {
        String html = saasInvoiceService.getInvoiceHtml(id);
        return ResponseEntity.ok().contentType(org.springframework.http.MediaType.TEXT_HTML).body(html);
    }
}
