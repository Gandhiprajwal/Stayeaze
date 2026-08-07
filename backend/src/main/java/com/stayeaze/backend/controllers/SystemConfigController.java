package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SystemConfig;
import com.stayeaze.backend.payload.request.SystemConfigRequest;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SystemConfigRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/system-configs")
public class SystemConfigController {

    @Autowired
    private SystemConfigRepository systemConfigRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<SystemConfig> getSystemConfig() {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Organization organization;
        if (isSuperAdmin) {
            organization = organizationRepository.findBySubdomain("system")
                    .orElseThrow(() -> new RuntimeException("System organization not found"));
        } else {
            organization = getLoggedUserOrg();
        }

        SystemConfig config = systemConfigRepository.findByOrganization(organization)
                .orElseGet(() -> {
                    SystemConfig defaultConf = new SystemConfig(organization);
                    return systemConfigRepository.save(defaultConf);
                });
        return ResponseEntity.ok(config);
    }

    @PutMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<SystemConfig> updateSystemConfig(@Valid @RequestBody SystemConfigRequest request) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Organization organization;
        if (isSuperAdmin) {
            organization = organizationRepository.findBySubdomain("system")
                    .orElseThrow(() -> new RuntimeException("System organization not found"));
        } else {
            organization = getLoggedUserOrg();
        }

        SystemConfig config = systemConfigRepository.findByOrganization(organization)
                .orElseGet(() -> new SystemConfig(organization));

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

        SystemConfig saved = systemConfigRepository.save(config);
        return ResponseEntity.ok(saved);
    }
}
