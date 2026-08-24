package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.OnboardingLead;
import com.stayeaze.backend.repository.OnboardingLeadRepository;
import com.stayeaze.backend.services.WebSocketNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/public/leads")
public class PublicLeadController {

    @Autowired
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    // Public endpoint for prospective property owners submitting interest/demo request
    @PostMapping
    public ResponseEntity<?> submitPublicLead(@RequestBody Map<String, Object> body) {
        String ownerName = body.get("name") != null ? body.get("name").toString() : "Prospective Owner";
        String ownerEmail = body.get("email") != null ? body.get("email").toString().trim().toLowerCase() : "";
        String ownerPhone = body.get("phone") != null ? body.get("phone").toString() : "";
        String propertyName = body.get("propertyName") != null ? body.get("propertyName").toString() : "New Property Inquiry";
        String note = body.get("message") != null ? body.get("message").toString() : "Submitted interest form from public site.";

        if (ownerEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required."));
        }

        OnboardingLead lead = new OnboardingLead(
                ownerName,
                ownerEmail,
                ownerPhone,
                propertyName,
                "LEAD-" + String.valueOf(System.currentTimeMillis()).substring(7),
                "DEMO_REQUESTED",
                "UNPAID",
                null
        );
        lead.setSalesNotes("Public Site Inquiry: " + note);
        OnboardingLead saved = leadRepository.save(lead);

        // Send Onboarding Lead Tax Invoice / Registration Email
        try {
            String invoiceNum = "INV-PROP-" + saved.getPropertyCode();
            String checkoutPaymentUrl = "http://localhost:5173/subscription?leadId=" + saved.getId();
            emailService.sendPropertyOwnerRegistrationInvoice(
                    saved.getOwnerEmail(),
                    saved.getOwnerName(),
                    saved.getPropertyName(),
                    saved.getPropertyCode(),
                    invoiceNum,
                    saved.getOnboardingFee(),
                    checkoutPaymentUrl
            );
        } catch (Exception e) {
            // Non-blocking log for email exception
        }

        // Broadcast STOMP Live Toast Alert to Super Admin
        Map<String, Object> leadAlert = new HashMap<>();
        leadAlert.put("type", "PUBLIC_ONBOARDING_INQUIRY");
        leadAlert.put("title", "📩 New Public Property Onboarding Lead!");
        leadAlert.put("message", ownerName + " (" + ownerEmail + ") requested property onboarding assistance.");
        leadAlert.put("ownerEmail", ownerEmail);
        leadAlert.put("propertyName", propertyName);
        webSocketNotificationService.broadcastTopic("/topic/super-admin/onboarding", leadAlert);

        return ResponseEntity.ok(Map.of(
                "message", "Thank you for your interest! Our onboarding team will contact you shortly.",
                "id", saved.getId()
        ));
    }

    // Public endpoint for resuming a dropped onboarding session
    @GetMapping("/resume/{id}")
    public ResponseEntity<?> getLeadForResume(@PathVariable UUID id) {
        Optional<OnboardingLead> leadOpt = leadRepository.findById(id);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Onboarding session not found or expired."));
        }

        OnboardingLead lead = leadOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("id", lead.getId());
        response.put("ownerName", lead.getOwnerName());
        response.put("ownerEmail", lead.getOwnerEmail());
        response.put("ownerPhone", lead.getOwnerPhone());
        response.put("propertyName", lead.getPropertyName());
        response.put("propertyCode", lead.getPropertyCode());
        response.put("status", lead.getStatus());
        response.put("paymentStatus", lead.getPaymentStatus());
        response.put("onboardingFee", lead.getOnboardingFee());
        response.put("failureCode", lead.getPaymentFailureCode());
        response.put("failureDescription", lead.getPaymentFailureDescription());

        return ResponseEntity.ok(response);
    }
}
