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
}
