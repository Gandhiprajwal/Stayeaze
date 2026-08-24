package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/branding")
public class BrandingController {

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @GetMapping("/current")
    public ResponseEntity<?> getCurrentBranding(
            @RequestHeader(value = "X-Subdomain", required = false) String headerSubdomain,
            HttpServletRequest request) {

        Organization targetOrg = null;

        // 1. Try resolving organization from logged-in user
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            Object principal = auth.getPrincipal();
            if (principal instanceof UserDetailsImpl) {
                UserDetailsImpl userDetails = (UserDetailsImpl) principal;
                User user = userRepository.findById(userDetails.getId()).orElse(null);
                if (user != null && user.getOrganization() != null) {
                    targetOrg = user.getOrganization();
                } else if (userDetails.getOrgId() != null) {
                    targetOrg = organizationRepository.findById(userDetails.getOrgId()).orElse(null);
                }
            }
        }

        // 2. If not logged in or no user org, resolve by X-Subdomain header
        if (targetOrg == null && headerSubdomain != null && !headerSubdomain.isBlank() && !"system".equalsIgnoreCase(headerSubdomain)) {
            targetOrg = organizationRepository.findBySubdomain(headerSubdomain.trim().toLowerCase()).orElse(null);
        }

        // 3. If no org resolved, return default StayEaze platform branding
        if (targetOrg == null) {
            Map<String, Object> defaultBranding = new HashMap<>();
            defaultBranding.put("enabled", false);
            defaultBranding.put("brandName", "StayEaze");
            defaultBranding.put("brandLogoUrl", null);
            defaultBranding.put("brandFaviconUrl", null);
            defaultBranding.put("brandPrimaryColor", "#4f46e5");
            defaultBranding.put("brandAccentColor", "#06b6d4");
            defaultBranding.put("brandTagline", "Smart PG & Co-Living Management Platform");
            defaultBranding.put("customFooterText", null);
            defaultBranding.put("hideStayEazeBranding", false);
            defaultBranding.put("isEnterprise", false);
            defaultBranding.put("allowCustomBranding", false);
            return ResponseEntity.ok(defaultBranding);
        }

        OrganizationBillingProfile profile = organizationBillingProfileRepository.findByOrganization(targetOrg).orElse(null);
        boolean isEnterprise = false;
        boolean allowedByPlan = false;

        if (profile != null) {
            String planName = profile.getSubscriptionPlanName();
            if (planName != null && !planName.isBlank()) {
                String pLower = planName.toLowerCase();
                isEnterprise = pLower.contains("enterprise") || pLower.contains("custom") || pLower.contains("unlimited");
                Optional<SaaSPlan> planOpt = saasPlanRepository.findByNameIgnoreCase(planName);
                if (planOpt.isEmpty() && isEnterprise) {
                    planOpt = saasPlanRepository.findByPlanKey("ENTERPRISE");
                }
                if (planOpt.isPresent() && Boolean.TRUE.equals(planOpt.get().getAllowCustomBranding())) {
                    allowedByPlan = true;
                }
            }
            if (isEnterprise || Boolean.TRUE.equals(profile.getCustomBrandingEnabled())) {
                allowedByPlan = true;
            }
        }

        boolean active = (allowedByPlan || isEnterprise) && profile != null && Boolean.TRUE.equals(profile.getCustomBrandingEnabled());

        Map<String, Object> branding = new HashMap<>();
        branding.put("organizationId", targetOrg.getId());
        branding.put("organizationName", targetOrg.getName());
        branding.put("subdomain", targetOrg.getSubdomain());
        branding.put("enabled", active);
        branding.put("isEnterprise", isEnterprise || allowedByPlan);
        branding.put("allowCustomBranding", isEnterprise || allowedByPlan);
        branding.put("brandName", active && profile.getBrandName() != null && !profile.getBrandName().isBlank()
                ? profile.getBrandName() : targetOrg.getName());
        branding.put("brandLogoUrl", active ? profile.getBrandLogoUrl() : null);
        branding.put("brandFaviconUrl", active ? profile.getBrandFaviconUrl() : null);
        branding.put("brandPrimaryColor", active && profile.getBrandPrimaryColor() != null
                ? profile.getBrandPrimaryColor() : "#4f46e5");
        branding.put("brandAccentColor", active && profile.getBrandAccentColor() != null
                ? profile.getBrandAccentColor() : "#06b6d4");
        branding.put("brandTagline", active ? profile.getBrandTagline() : null);
        branding.put("customFooterText", active ? profile.getCustomFooterText() : null);
        branding.put("hideStayEazeBranding", active && Boolean.TRUE.equals(profile.getHideStayEazeBranding()));
        branding.put("supportEmail", profile != null ? profile.getSupportEmail() : null);
        branding.put("supportPhone", profile != null ? profile.getSupportPhone() : null);

        return ResponseEntity.ok(branding);
    }

    @PutMapping("/organization")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<?> updateOrganizationBranding(@RequestBody Map<String, Object> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null || user.getOrganization() == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Organization not found"));
        }

        Organization org = user.getOrganization();
        OrganizationBillingProfile profile = organizationBillingProfileRepository.findByOrganization(org)
                .orElseGet(() -> new OrganizationBillingProfile(org));

        // Check if plan permits custom branding
        String planName = profile.getSubscriptionPlanName();
        boolean planAllows = false;
        if (planName != null && !planName.isBlank()) {
            String pLower = planName.toLowerCase();
            if (pLower.contains("enterprise") || pLower.contains("custom") || pLower.contains("unlimited")) {
                planAllows = true;
            }
            Optional<SaaSPlan> planOpt = saasPlanRepository.findByNameIgnoreCase(planName);
            if (planOpt.isEmpty() && planAllows) {
                planOpt = saasPlanRepository.findByPlanKey("ENTERPRISE");
            }
            if (planOpt.isPresent() && Boolean.TRUE.equals(planOpt.get().getAllowCustomBranding())) {
                planAllows = true;
            }
        }
        if (Boolean.TRUE.equals(profile.getCustomBrandingEnabled())) {
            planAllows = true;
        }

        if (!planAllows) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: White-Label Custom Branding is an exclusive Enterprise Plan feature. Please upgrade to the Enterprise Plan to enable custom branding."));
        }

        if (body.containsKey("customBrandingEnabled")) {
            profile.setCustomBrandingEnabled(Boolean.TRUE.equals(body.get("customBrandingEnabled")));
        }
        if (body.containsKey("brandName")) {
            profile.setBrandName((String) body.get("brandName"));
        }
        if (body.containsKey("brandLogoUrl")) {
            profile.setBrandLogoUrl((String) body.get("brandLogoUrl"));
        }
        if (body.containsKey("brandFaviconUrl")) {
            profile.setBrandFaviconUrl((String) body.get("brandFaviconUrl"));
        }
        if (body.containsKey("brandPrimaryColor")) {
            profile.setBrandPrimaryColor((String) body.get("brandPrimaryColor"));
        }
        if (body.containsKey("brandAccentColor")) {
            profile.setBrandAccentColor((String) body.get("brandAccentColor"));
        }
        if (body.containsKey("brandTagline")) {
            profile.setBrandTagline((String) body.get("brandTagline"));
        }
        if (body.containsKey("customFooterText")) {
            profile.setCustomFooterText((String) body.get("customFooterText"));
        }
        if (body.containsKey("hideStayEazeBranding")) {
            profile.setHideStayEazeBranding(Boolean.TRUE.equals(body.get("hideStayEazeBranding")));
        }

        profile.setUpdatedAt(java.time.OffsetDateTime.now());
        organizationBillingProfileRepository.save(profile);

        return ResponseEntity.ok(new MessageResponse("Custom White-Label Branding settings saved successfully!"));
    }
}
