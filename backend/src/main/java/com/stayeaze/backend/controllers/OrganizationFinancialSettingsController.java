package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/organization/financial-settings")
public class OrganizationFinancialSettingsController {

    private static final String GSTIN_REGEX = "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$";

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                    ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                    : null;

            if (principal instanceof UserDetailsImpl userDetails) {
                if (userDetails.getOrgId() != null) {
                    Organization org = organizationRepository.findById(userDetails.getOrgId()).orElse(null);
                    if (org != null) return org;
                }
            }
        } catch (Exception ignored) {}
        return organizationRepository.findAll().stream().findFirst().orElse(null);
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getFinancialSettings() {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Organization not found."));
        }

        Map<String, Object> data = new HashMap<>();
        data.put("gstEnabled", org.getGstEnabled());
        data.put("gstin", org.getGstin() != null ? org.getGstin() : "");
        data.put("gstTradeName", org.getGstTradeName() != null ? org.getGstTradeName() : org.getName());
        data.put("defaultGstRate", org.getDefaultGstRate());
        data.put("organizationName", org.getName());

        return ResponseEntity.ok(data);
    }

    @PutMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateFinancialSettings(@RequestBody Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Organization not found."));
        }

        Boolean gstEnabled = payload.get("gstEnabled") != null && Boolean.parseBoolean(payload.get("gstEnabled").toString());
        String gstin = payload.get("gstin") != null ? payload.get("gstin").toString().trim().toUpperCase() : "";
        String gstTradeName = payload.get("gstTradeName") != null ? payload.get("gstTradeName").toString().trim() : "";
        BigDecimal defaultGstRate = new BigDecimal("18.00");

        if (payload.get("defaultGstRate") != null) {
            try {
                defaultGstRate = new BigDecimal(payload.get("defaultGstRate").toString());
            } catch (Exception ignored) {}
        }

        // BACKEND STRICT INPUT VALIDATIONS
        if (Boolean.TRUE.equals(gstEnabled)) {
            if (gstin.isBlank()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: GSTIN is required when GST is enabled."));
            }
            if (!Pattern.matches(GSTIN_REGEX, gstin)) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid 15-digit GSTIN format (e.g. 27AAAAA0000A1Z5)."));
            }
            if (gstTradeName.isBlank()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: GST Trade Legal Name is required when GST is enabled."));
            }
            if (defaultGstRate.compareTo(BigDecimal.ZERO) < 0 || defaultGstRate.compareTo(new BigDecimal("28.00")) > 0) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: GST Tax Rate must be between 0% and 28%."));
            }
        }

        org.setGstEnabled(gstEnabled);
        org.setGstin(gstin);
        org.setGstTradeName(gstTradeName.isBlank() ? org.getName() : gstTradeName);
        org.setDefaultGstRate(defaultGstRate);
        org.setUpdatedAt(java.time.OffsetDateTime.now());

        organizationRepository.save(org);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Organization GST & Financial Settings updated successfully!");
        response.put("gstEnabled", org.getGstEnabled());
        response.put("gstin", org.getGstin());
        response.put("gstTradeName", org.getGstTradeName());
        response.put("defaultGstRate", org.getDefaultGstRate());

        return ResponseEntity.ok(response);
    }
}
