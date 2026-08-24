package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.CheckOut;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lightweight CheckOut payload for list/table views.
 * Strips the nested Organization entity.
 */
public class CheckOutDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String code;
    private String tenantName;
    private UUID propertyId;
    private String roomNumber;
    private String bedNumber;
    private LocalDate checkOutDate;
    private LocalDate noticeDate;
    private BigDecimal depositRefund;
    private BigDecimal deductions;
    private String reason;
    private String status;
    private String refundStatus;
    private String refundApprovedBy;
    private OffsetDateTime refundApprovedAt;
    private String refundPaymentMode;
    private String refundTransactionRef;
    private String refundNotes;
    private BigDecimal netRefundAmount;
    private String beneficiaryUpi;
    private String beneficiaryBank;
    private String beneficiaryAccount;
    private String beneficiaryIfsc;
    private OffsetDateTime createdAt;

    public CheckOutDTO() {}

    public static CheckOutDTO fromEntity(CheckOut c) {
        if (c == null) return null;
        CheckOutDTO dto = new CheckOutDTO();
        dto.setId(c.getId());
        dto.setCode(c.getCode());
        dto.setTenantName(c.getTenantName());
        dto.setPropertyId(c.getPropertyId());
        dto.setRoomNumber(c.getRoomNumber());
        dto.setBedNumber(c.getBedNumber());
        dto.setCheckOutDate(c.getCheckOutDate());
        dto.setNoticeDate(c.getNoticeDate());
        dto.setDepositRefund(c.getDepositRefund());
        dto.setDeductions(c.getDeductions());
        dto.setReason(c.getReason());
        dto.setStatus(c.getStatus() != null ? c.getStatus() : "pending");
        dto.setRefundStatus(c.getRefundStatus());
        dto.setRefundApprovedBy(c.getRefundApprovedBy());
        dto.setRefundApprovedAt(c.getRefundApprovedAt());
        dto.setRefundPaymentMode(c.getRefundPaymentMode());
        dto.setRefundTransactionRef(c.getRefundTransactionRef());
        dto.setRefundNotes(c.getRefundNotes());
        dto.setNetRefundAmount(c.getNetRefundAmount());
        dto.setBeneficiaryUpi(c.getBeneficiaryUpi());
        dto.setBeneficiaryBank(c.getBeneficiaryBank());
        dto.setBeneficiaryAccount(c.getBeneficiaryAccount());
        dto.setBeneficiaryIfsc(c.getBeneficiaryIfsc());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public LocalDate getCheckOutDate() { return checkOutDate; }
    public void setCheckOutDate(LocalDate checkOutDate) { this.checkOutDate = checkOutDate; }

    public LocalDate getNoticeDate() { return noticeDate; }
    public void setNoticeDate(LocalDate noticeDate) { this.noticeDate = noticeDate; }

    public BigDecimal getDepositRefund() { return depositRefund; }
    public void setDepositRefund(BigDecimal depositRefund) { this.depositRefund = depositRefund; }

    public BigDecimal getDeductions() { return deductions; }
    public void setDeductions(BigDecimal deductions) { this.deductions = deductions; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public String getRefundStatus() { return refundStatus; }
    public void setRefundStatus(String refundStatus) { this.refundStatus = refundStatus; }

    public String getRefundApprovedBy() { return refundApprovedBy; }
    public void setRefundApprovedBy(String refundApprovedBy) { this.refundApprovedBy = refundApprovedBy; }

    public OffsetDateTime getRefundApprovedAt() { return refundApprovedAt; }
    public void setRefundApprovedAt(OffsetDateTime refundApprovedAt) { this.refundApprovedAt = refundApprovedAt; }

    public String getRefundPaymentMode() { return refundPaymentMode; }
    public void setRefundPaymentMode(String refundPaymentMode) { this.refundPaymentMode = refundPaymentMode; }

    public String getRefundTransactionRef() { return refundTransactionRef; }
    public void setRefundTransactionRef(String refundTransactionRef) { this.refundTransactionRef = refundTransactionRef; }

    public String getRefundNotes() { return refundNotes; }
    public void setRefundNotes(String refundNotes) { this.refundNotes = refundNotes; }

    public BigDecimal getNetRefundAmount() { return netRefundAmount; }
    public void setNetRefundAmount(BigDecimal netRefundAmount) { this.netRefundAmount = netRefundAmount; }

    public String getBeneficiaryUpi() { return beneficiaryUpi; }
    public void setBeneficiaryUpi(String beneficiaryUpi) { this.beneficiaryUpi = beneficiaryUpi; }

    public String getBeneficiaryBank() { return beneficiaryBank; }
    public void setBeneficiaryBank(String beneficiaryBank) { this.beneficiaryBank = beneficiaryBank; }

    public String getBeneficiaryAccount() { return beneficiaryAccount; }
    public void setBeneficiaryAccount(String beneficiaryAccount) { this.beneficiaryAccount = beneficiaryAccount; }

    public String getBeneficiaryIfsc() { return beneficiaryIfsc; }
    public void setBeneficiaryIfsc(String beneficiaryIfsc) { this.beneficiaryIfsc = beneficiaryIfsc; }
}
