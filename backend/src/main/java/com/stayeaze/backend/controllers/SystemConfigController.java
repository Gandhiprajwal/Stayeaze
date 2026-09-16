package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SystemConfig;
import com.stayeaze.backend.payload.request.SystemConfigRequest;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SystemConfigRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/system-configs")
public class SystemConfigController {

    @Autowired
    private SystemConfigRepository systemConfigRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getOrCreateSystemOrg() {
        return organizationRepository.findBySubdomain("system")
                .orElseGet(() -> {
                    Organization sysOrg = new Organization();
                    sysOrg.setName("System Organization");
                    sysOrg.setSubdomain("system");
                    sysOrg.setStatus("ACTIVE");
                    return organizationRepository.save(sysOrg);
                });
    }

    @GetMapping
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    @org.springframework.cache.annotation.Cacheable(value = "system_config", key = "'global'")
    public ResponseEntity<SystemConfig> getSystemConfig() {
        try {
            Organization organization = getOrCreateSystemOrg();
            SystemConfig config = systemConfigRepository.findByOrganization(organization)
                    .orElseGet(() -> systemConfigRepository.findAll().stream().findFirst()
                    .orElseGet(() -> systemConfigRepository.save(new SystemConfig(organization))));
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            SystemConfig fallbackConf = new SystemConfig();
            fallbackConf.setSmsProvider("Twilio");
            fallbackConf.setEmailProvider("SMTP");
            fallbackConf.setAllowSelfRegistration(true);
            fallbackConf.setMaintenanceMode(false);
            return ResponseEntity.ok(fallbackConf);
        }
    }

    @Autowired
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository systemIntegrationSettingsRepository;

    @PutMapping
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = "system_config", allEntries = true)
    public ResponseEntity<SystemConfig> updateSystemConfig(@Valid @RequestBody SystemConfigRequest request) {
        Organization organization = getOrCreateSystemOrg();

        SystemConfig config = systemConfigRepository.findByOrganization(organization)
                .orElseGet(() -> systemConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> new SystemConfig(organization)));

        config.setOrganization(organization);
        config.setSmsProvider(request.getSmsProvider());
        config.setEmailProvider(request.getEmailProvider());
        config.setAllowSelfRegistration(request.getAllowSelfRegistration());
        config.setMaintenanceMode(request.getMaintenanceMode());

        config.setTwilioSid(request.getTwilioSid());
        config.setTwilioAuthToken(request.getTwilioAuthToken());
        config.setSmtpHost(request.getSmtpHost());
        config.setSmtpPort(request.getSmtpPort());
        config.setSmtpUsername(request.getSmtpUsername());
        config.setSmtpPassword(request.getSmtpPassword());
        config.setRazorpayKeyId(request.getRazorpayKeyId());
        config.setRazorpayKeySecret(request.getRazorpayKeySecret());
        if (request.getDefaultSecurityDeposit() != null) {
            config.setDefaultSecurityDeposit(request.getDefaultSecurityDeposit());
        }

        SystemConfig saved = systemConfigRepository.save(config);

        // Also synchronize to primary SystemIntegrationSettings
        try {
            var settings = systemIntegrationSettingsRepository.findAll().stream().findFirst()
                    .orElseGet(com.stayeaze.backend.models.SystemIntegrationSettings::new);
            if (request.getSmtpHost() != null) settings.setSmtpHost(request.getSmtpHost());
            if (request.getSmtpPort() != null) settings.setSmtpPort(request.getSmtpPort());
            if (request.getSmtpUsername() != null) settings.setSmtpUsername(request.getSmtpUsername());
            if (request.getSmtpPassword() != null) settings.setSmtpPassword(request.getSmtpPassword());
            if (request.getRazorpayKeyId() != null) settings.setRazorpayMasterKeyId(request.getRazorpayKeyId());
            if (request.getRazorpayKeySecret() != null) settings.setRazorpayMasterKeySecret(request.getRazorpayKeySecret());
            if (request.getMaintenanceMode() != null) settings.setMaintenanceModeEnabled(request.getMaintenanceMode());
            systemIntegrationSettingsRepository.save(settings);
        } catch (Exception ignored) {}

        return ResponseEntity.ok(saved);
    }

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @PostMapping("/test-email")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> sendTestEmail(@RequestBody java.util.Map<String, String> req) {
        String to = req.get("email");
        if (to == null || to.isBlank()) {
            return ResponseEntity.badRequest().body(new com.stayeaze.backend.payload.response.MessageResponse("Recipient email is required."));
        }
        try {
            String resultMsg = emailService.sendTestEmail(to.trim());
            return ResponseEntity.ok(new com.stayeaze.backend.payload.response.MessageResponse(resultMsg));
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST)
                    .body(new com.stayeaze.backend.payload.response.MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/test-razorpay")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> testRazorpay(@RequestBody java.util.Map<String, String> req) {
        String keyId = req.get("keyId");
        String keySecret = req.get("keySecret");
        if (keyId == null || keyId.isBlank() || keySecret == null || keySecret.isBlank()) {
            return ResponseEntity.badRequest().body(new com.stayeaze.backend.payload.response.MessageResponse("Both Master Key ID and Key Secret are required."));
        }
        try {
            com.razorpay.RazorpayClient client = new com.razorpay.RazorpayClient(keyId.trim(), keySecret.trim());
            org.json.JSONObject orderReq = new org.json.JSONObject();
            orderReq.put("amount", 100);
            orderReq.put("currency", "INR");
            orderReq.put("receipt", "DIAG-" + (System.currentTimeMillis() % 1000000L));
            com.razorpay.Order testOrder = client.orders.create(orderReq);
            return ResponseEntity.ok(new com.stayeaze.backend.payload.response.MessageResponse(
                "🟢 Razorpay Credentials Verified! Test connection authenticated successfully (Diagnostic Order: " + testOrder.get("id") + ")."
            ));
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST)
                    .body(new com.stayeaze.backend.payload.response.MessageResponse("🔴 Razorpay Authentication Failed: " + e.getMessage()));
        }
    }
}
