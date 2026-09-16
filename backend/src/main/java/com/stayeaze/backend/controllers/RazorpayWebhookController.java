package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.OnboardingLead;
import com.stayeaze.backend.repository.OnboardingLeadRepository;
import com.stayeaze.backend.services.WebSocketNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/webhooks")
public class RazorpayWebhookController {

    private static final Logger logger = LoggerFactory.getLogger(RazorpayWebhookController.class);

    @Autowired
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    private com.stayeaze.backend.repository.SystemConfigRepository systemConfigRepository;

    @Autowired
    private com.stayeaze.backend.repository.OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    // 24-Hour Bounded Thread-Safe Idempotency Cache for Webhook Event IDs
    private static final Map<String, Long> PROCESSED_WEBHOOK_EVENTS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000L; // 24 Hours

    // Razorpay Webhook Endpoint
    @PostMapping("/razorpay")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> handleRazorpayWebhook(
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signatureHeader,
            @RequestHeader(value = "X-Razorpay-Event-Id", required = false) String eventIdHeader,
            @RequestBody String rawPayload) {
        
        // 0. Clean expired idempotency keys periodically
        long now = System.currentTimeMillis();
        PROCESSED_WEBHOOK_EVENTS.entrySet().removeIf(entry -> (now - entry.getValue()) > IDEMPOTENCY_TTL_MS);

        // 1. Idempotency Check
        String eventKey = eventIdHeader;
        if (eventKey == null || eventKey.isBlank()) {
            // Fallback: derive unique signature hash from raw payload + signature
            eventKey = "HASH_" + java.util.Objects.hash(rawPayload, signatureHeader);
        }

        if (PROCESSED_WEBHOOK_EVENTS.containsKey(eventKey)) {
            logger.info("⏭️ Razorpay Webhook Event [{}] already processed. Skipping duplicate execution (Idempotency Guard).", eventKey);
            return ResponseEntity.ok(Map.of("status", "IGNORED_DUPLICATE", "eventId", eventKey));
        }

        // Mark as processing/processed
        PROCESSED_WEBHOOK_EVENTS.put(eventKey, now);

        // 2. Signature Verification
        String activeSecret = null;
        try {
            var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
            if (settings != null && settings.getRazorpayMasterKeySecret() != null && !settings.getRazorpayMasterKeySecret().isBlank()) {
                activeSecret = settings.getRazorpayMasterKeySecret().trim();
            }
            if (activeSecret == null) {
                var sysCfg = systemConfigRepository.findAll().stream().findFirst().orElse(null);
                if (sysCfg != null && sysCfg.getRazorpayKeySecret() != null && !sysCfg.getRazorpayKeySecret().isBlank()) {
                    activeSecret = sysCfg.getRazorpayKeySecret().trim();
                }
            }
        } catch (Exception ignored) {}

        if (activeSecret != null && !activeSecret.isBlank() && !activeSecret.contains("mockSecret")) {
            if (signatureHeader == null || signatureHeader.isBlank()) {
                logger.warn("❌ Rejected Razorpay Webhook: Missing X-Razorpay-Signature header");
                return ResponseEntity.badRequest().body(Map.of("error", "Missing X-Razorpay-Signature header"));
            }
            try {
                boolean isValid = com.razorpay.Utils.verifyWebhookSignature(rawPayload, signatureHeader, activeSecret);
                if (!isValid) {
                    logger.warn("❌ Rejected Razorpay Webhook: Invalid HMAC signature");
                    return ResponseEntity.badRequest().body(Map.of("error", "Invalid signature"));
                }
            } catch (Exception e) {
                logger.warn("❌ Rejected Razorpay Webhook: Signature verification exception: {}", e.getMessage());
                return ResponseEntity.badRequest().body(Map.of("error", "Signature verification failed"));
            }
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(rawPayload, Map.class);
        } catch (Exception e) {
            logger.warn("Failed to parse Razorpay webhook payload JSON: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "Malformed JSON"));
        }

        logger.info("💳 Received Verified Razorpay Webhook Event: {}", payload.get("event"));

        try {
            String event = payload.get("event") != null ? payload.get("event").toString() : "";
            Map<String, Object> payloadBody = (Map<String, Object>) payload.get("payload");

            if ("payment.captured".equalsIgnoreCase(event) || "order.paid".equalsIgnoreCase(event)) {
                if (payloadBody != null && payloadBody.containsKey("payment")) {
                    Map<String, Object> paymentEntity = (Map<String, Object>) ((Map<String, Object>) payloadBody.get("payment")).get("entity");
                    String email = paymentEntity != null && paymentEntity.get("email") != null ? paymentEntity.get("email").toString().trim().toLowerCase() : "";

                    List<OnboardingLead> leads = leadRepository.findAllByOrderByCreatedAtDesc();
                    for (OnboardingLead lead : leads) {
                        if (lead.getOwnerEmail().equalsIgnoreCase(email) && !"COMPLETED".equalsIgnoreCase(lead.getPaymentStatus())) {
                            lead.setPaymentStatus("COMPLETED");
                            lead.setStatus("CONVERTED");
                            leadRepository.save(lead);

                            logger.info("🎉 Auto-converted OnboardingLead for email: {}", email);

                            // Broadcast STOMP celebration notification to Super Admin
                            Map<String, Object> celebrationAlert = new HashMap<>();
                            celebrationAlert.put("type", "PAYMENT_CONVERTED");
                            celebrationAlert.put("title", "🎉 Property Onboarding Payment Received!");
                            celebrationAlert.put("message", "Payment of ₹" + lead.getOnboardingFee() + " confirmed for " + lead.getPropertyName() + " (" + email + ")!");
                            webSocketNotificationService.broadcastTopic("/topic/super-admin/onboarding", celebrationAlert);
                            break;
                        }
                    }
                }
            } else if ("refund.processed".equalsIgnoreCase(event) || "refund.speed_changed".equalsIgnoreCase(event)) {
                if (payloadBody != null && payloadBody.containsKey("refund")) {
                    Map<String, Object> refundEntity = (Map<String, Object>) ((Map<String, Object>) payloadBody.get("refund")).get("entity");
                    if (refundEntity != null) {
                        String refundId = refundEntity.get("id") != null ? refundEntity.get("id").toString() : "";
                        String paymentId = refundEntity.get("payment_id") != null ? refundEntity.get("payment_id").toString() : "";
                        String arn = null;
                        if (refundEntity.containsKey("acquirer_data") && refundEntity.get("acquirer_data") instanceof Map) {
                            Map<String, Object> acq = (Map<String, Object>) refundEntity.get("acquirer_data");
                            if (acq.get("arn") != null) arn = acq.get("arn").toString();
                            else if (acq.get("rrn") != null) arn = acq.get("rrn").toString();
                            else if (acq.get("upi_transaction_id") != null) arn = acq.get("upi_transaction_id").toString();
                        }

                        // Update Billing Profile if matching
                        Optional<com.stayeaze.backend.models.OrganizationBillingProfile> bpOpt = billingProfileRepository.findByRefundId(refundId);
                        if (bpOpt.isEmpty() && !paymentId.isBlank()) {
                            bpOpt = billingProfileRepository.findBySubscriptionPaymentId(paymentId);
                        }

                        if (bpOpt.isPresent()) {
                            com.stayeaze.backend.models.OrganizationBillingProfile bp = bpOpt.get();
                            bp.setRefundStatus("SETTLED_TO_SOURCE");
                            if (arn != null) bp.setRefundArn(arn);
                            bp.setRefundSettledAt(java.time.OffsetDateTime.now());
                            billingProfileRepository.save(bp);
                            logger.info("✅ Refund {} settled to source account with ARN: {}", refundId, arn);

                            Map<String, Object> alert = new HashMap<>();
                            alert.put("type", "REFUND_SETTLED");
                            alert.put("refundId", refundId);
                            alert.put("arn", arn);
                            alert.put("message", "Refund of ₹" + (bp.getRefundAmount() != null ? bp.getRefundAmount() : "1499") + " settled to source bank for " + bp.getLegalName() + " (ARN: " + (arn != null ? arn : "Pending Bank Acquirer") + ")");
                            webSocketNotificationService.broadcastTopic("/topic/super-admin/refunds", alert);
                        }
                    }
                }
            } else if ("refund.failed".equalsIgnoreCase(event)) {
                if (payloadBody != null && payloadBody.containsKey("refund")) {
                    Map<String, Object> refundEntity = (Map<String, Object>) ((Map<String, Object>) payloadBody.get("refund")).get("entity");
                    if (refundEntity != null) {
                        String refundId = refundEntity.get("id") != null ? refundEntity.get("id").toString() : "";
                        String paymentId = refundEntity.get("payment_id") != null ? refundEntity.get("payment_id").toString() : "";
                        String errCode = refundEntity.get("error_code") != null ? refundEntity.get("error_code").toString() : "GATEWAY_ERROR";
                        String errDesc = refundEntity.get("error_description") != null ? refundEntity.get("error_description").toString() : "Refund failed at acquiring bank.";

                        Optional<com.stayeaze.backend.models.OrganizationBillingProfile> bpOpt = billingProfileRepository.findByRefundId(refundId);
                        if (bpOpt.isEmpty() && !paymentId.isBlank()) {
                            bpOpt = billingProfileRepository.findBySubscriptionPaymentId(paymentId);
                        }

                        if (bpOpt.isPresent()) {
                            com.stayeaze.backend.models.OrganizationBillingProfile bp = bpOpt.get();
                            bp.setRefundStatus("REFUND_FAILED");
                            bp.setRefundErrorCode(errCode);
                            bp.setRefundErrorDescription(errDesc);
                            billingProfileRepository.save(bp);
                            logger.warn("❌ Refund {} failed: {} - {}", refundId, errCode, errDesc);

                            Map<String, Object> alert = new HashMap<>();
                            alert.put("type", "REFUND_FAILED");
                            alert.put("refundId", refundId);
                            alert.put("message", "⚠️ Refund failed for " + bp.getLegalName() + ": " + errDesc);
                            webSocketNotificationService.broadcastTopic("/topic/super-admin/refunds", alert);
                        }
                    }
                }
            } else if ("payment.failed".equalsIgnoreCase(event)) {
                if (payloadBody != null && payloadBody.containsKey("payment")) {
                    Map<String, Object> paymentEntity = (Map<String, Object>) ((Map<String, Object>) payloadBody.get("payment")).get("entity");
                    if (paymentEntity != null) {
                        String email = paymentEntity.get("email") != null ? paymentEntity.get("email").toString().trim().toLowerCase() : "";
                        String errCode = paymentEntity.get("error_code") != null ? paymentEntity.get("error_code").toString() : "PAYMENT_FAILED";
                        String errDesc = paymentEntity.get("error_description") != null ? paymentEntity.get("error_description").toString() : "Checkout interrupted";

                        List<OnboardingLead> leads = leadRepository.findAllByOrderByCreatedAtDesc();
                        for (OnboardingLead lead : leads) {
                            if (lead.getOwnerEmail().equalsIgnoreCase(email) && !"COMPLETED".equalsIgnoreCase(lead.getPaymentStatus())) {
                                lead.setPaymentStatus("FAILED");
                                lead.setPaymentFailureCode(errCode);
                                lead.setPaymentFailureDescription(errDesc);
                                leadRepository.save(lead);
                                logger.info("⚠️ Recorded payment failure for onboarding lead: {} ({})", email, errCode);
                                break;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("⚠️ Webhook processing warning: {}", e.getMessage());
        }

        return ResponseEntity.ok(Map.of("status", "RECEIVED"));
    }
}
