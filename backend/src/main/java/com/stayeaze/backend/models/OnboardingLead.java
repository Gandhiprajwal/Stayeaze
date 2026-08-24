package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "onboarding_leads")
public class OnboardingLead {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "owner_name", length = 150, nullable = false)
    private String ownerName;

    @Column(name = "owner_email", length = 255, nullable = false)
    private String ownerEmail;

    @Column(name = "owner_phone", length = 20)
    private String ownerPhone;

    @Column(name = "property_name", length = 150, nullable = false)
    private String propertyName;

    @Column(name = "property_code", length = 50)
    private String propertyCode;

    @Column(name = "status", length = 50, nullable = false)
    private String status = "PENDING_PAYMENT"; // PENDING_PAYMENT, FAILED_ONBOARDING, COMPLETED, CONVERTED

    @Column(name = "payment_status", length = 50, nullable = false)
    private String paymentStatus = "UNPAID"; // UNPAID, PARTIAL, COMPLETED, FAILED

    @Column(name = "onboarding_fee", precision = 12, scale = 2)
    private BigDecimal onboardingFee = new BigDecimal("2999.00");

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "sales_notes", length = 2000)
    private String salesNotes;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    // --- Onboarding Payment Failure & Recovery Fields ---
    @Column(name = "payment_failure_code", length = 100)
    private String paymentFailureCode;

    @Column(name = "payment_failure_description", columnDefinition = "text")
    private String paymentFailureDescription;

    @Column(name = "recovery_checkout_url", columnDefinition = "text")
    private String recoveryCheckoutUrl;

    @Column(name = "refund_id", length = 100)
    private String refundId;

    @Column(name = "refund_status", length = 50)
    private String refundStatus;

    @Column(name = "refund_arn", length = 100)
    private String refundArn;

    @Column(name = "refund_settled_at")
    private OffsetDateTime refundSettledAt;

    @Column(name = "last_contacted_at")
    private OffsetDateTime lastContactedAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public OnboardingLead() {}

    public OnboardingLead(String ownerName, String ownerEmail, String ownerPhone, String propertyName, String propertyCode, String status, String paymentStatus, String errorMessage) {
        this.ownerName = ownerName;
        this.ownerEmail = ownerEmail;
        this.ownerPhone = ownerPhone;
        this.propertyName = propertyName;
        this.propertyCode = propertyCode;
        this.status = status != null ? status : "PENDING_PAYMENT";
        this.paymentStatus = paymentStatus != null ? paymentStatus : "UNPAID";
        this.errorMessage = errorMessage;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    public String getOwnerPhone() { return ownerPhone; }
    public void setOwnerPhone(String ownerPhone) { this.ownerPhone = ownerPhone; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getPropertyCode() { return propertyCode; }
    public void setPropertyCode(String propertyCode) { this.propertyCode = propertyCode; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public BigDecimal getOnboardingFee() { return onboardingFee; }
    public void setOnboardingFee(BigDecimal onboardingFee) { this.onboardingFee = onboardingFee; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getSalesNotes() { return salesNotes; }
    public void setSalesNotes(String salesNotes) { this.salesNotes = salesNotes; }

    public OffsetDateTime getLastContactedAt() { return lastContactedAt; }
    public void setLastContactedAt(OffsetDateTime lastContactedAt) { this.lastContactedAt = lastContactedAt; }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getPaymentFailureCode() { return paymentFailureCode; }
    public void setPaymentFailureCode(String paymentFailureCode) { this.paymentFailureCode = paymentFailureCode; }

    public String getPaymentFailureDescription() { return paymentFailureDescription; }
    public void setPaymentFailureDescription(String paymentFailureDescription) { this.paymentFailureDescription = paymentFailureDescription; }

    public String getRecoveryCheckoutUrl() { return recoveryCheckoutUrl; }
    public void setRecoveryCheckoutUrl(String recoveryCheckoutUrl) { this.recoveryCheckoutUrl = recoveryCheckoutUrl; }

    public String getRefundId() { return refundId; }
    public void setRefundId(String refundId) { this.refundId = refundId; }

    public String getRefundStatus() { return refundStatus; }
    public void setRefundStatus(String refundStatus) { this.refundStatus = refundStatus; }

    public String getRefundArn() { return refundArn; }
    public void setRefundArn(String refundArn) { this.refundArn = refundArn; }

    public OffsetDateTime getRefundSettledAt() { return refundSettledAt; }
    public void setRefundSettledAt(OffsetDateTime refundSettledAt) { this.refundSettledAt = refundSettledAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
