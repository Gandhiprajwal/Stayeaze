package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.OnboardingLead;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lightweight Lead summary payload for table/list views.
 * Excludes internal refund, checkout recovery, and diagnostic details.
 */
public class LeadSummaryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String ownerName;
    private String ownerEmail;
    private String ownerPhone;
    private String propertyName;
    private String propertyCode;
    private String status;
    private String paymentStatus;
    private BigDecimal onboardingFee;
    private String salesNotes;
    private OffsetDateTime lastContactedAt;
    private OffsetDateTime createdAt;

    public LeadSummaryDTO() {}

    public static LeadSummaryDTO fromEntity(OnboardingLead lead) {
        if (lead == null) return null;
        LeadSummaryDTO dto = new LeadSummaryDTO();
        dto.setId(lead.getId());
        dto.setOwnerName(lead.getOwnerName());
        dto.setOwnerEmail(lead.getOwnerEmail());
        dto.setOwnerPhone(lead.getOwnerPhone());
        dto.setPropertyName(lead.getPropertyName());
        dto.setPropertyCode(lead.getPropertyCode());
        dto.setStatus(lead.getStatus());
        dto.setPaymentStatus(lead.getPaymentStatus());
        dto.setOnboardingFee(lead.getOnboardingFee());
        dto.setSalesNotes(lead.getSalesNotes());
        dto.setLastContactedAt(lead.getLastContactedAt());
        dto.setCreatedAt(lead.getCreatedAt());
        return dto;
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

    public String getSalesNotes() { return salesNotes; }
    public void setSalesNotes(String salesNotes) { this.salesNotes = salesNotes; }

    public OffsetDateTime getLastContactedAt() { return lastContactedAt; }
    public void setLastContactedAt(OffsetDateTime lastContactedAt) { this.lastContactedAt = lastContactedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
