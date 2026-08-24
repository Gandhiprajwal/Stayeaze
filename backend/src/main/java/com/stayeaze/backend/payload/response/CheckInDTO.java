package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.CheckIn;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public class CheckInDTO {
    private UUID id;
    private String code;
    private String tenantName;
    private UUID propertyId;
    private String roomNumber;
    private String bedNumber;
    private LocalDate checkInDate;
    private LocalDate leaseEnd;
    private BigDecimal rent;
    private BigDecimal depositPaid;
    private Boolean idVerified;
    private String status;
    private UUID bookingId;
    private BigDecimal advanceAmount;
    private String tenantEmail;
    private String tenantPhone;
    private String paymentMethod;
    private String razorpayPaymentId;
    private String razorpayOrderId;
    private OffsetDateTime createdAt;

    public CheckInDTO() {}

    public static CheckInDTO fromEntity(CheckIn c) {
        if (c == null) return null;
        CheckInDTO dto = new CheckInDTO();
        dto.setId(c.getId());
        dto.setCode(c.getCode());
        dto.setTenantName(c.getTenantName());
        dto.setPropertyId(c.getPropertyId());
        dto.setRoomNumber(c.getRoomNumber());
        dto.setBedNumber(c.getBedNumber());
        dto.setCheckInDate(c.getCheckInDate());
        dto.setLeaseEnd(c.getLeaseEnd());
        dto.setRent(c.getRent());
        dto.setDepositPaid(c.getDepositPaid());
        dto.setIdVerified(c.getIdVerified() != null ? c.getIdVerified() : true);
        dto.setStatus(c.getStatus() != null ? c.getStatus() : "pending");
        dto.setBookingId(c.getBookingId());
        dto.setAdvanceAmount(c.getAdvanceAmount() != null ? c.getAdvanceAmount() : BigDecimal.ZERO);
        dto.setTenantEmail(c.getTenantEmail());
        dto.setTenantPhone(c.getTenantPhone());
        dto.setPaymentMethod(c.getPaymentMethod());
        dto.setRazorpayPaymentId(c.getRazorpayPaymentId());
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

    public LocalDate getCheckInDate() { return checkInDate; }
    public void setCheckInDate(LocalDate checkInDate) { this.checkInDate = checkInDate; }

    public LocalDate getLeaseEnd() { return leaseEnd; }
    public void setLeaseEnd(LocalDate leaseEnd) { this.leaseEnd = leaseEnd; }

    public BigDecimal getRent() { return rent; }
    public void setRent(BigDecimal rent) { this.rent = rent; }

    public BigDecimal getDepositPaid() { return depositPaid; }
    public void setDepositPaid(BigDecimal depositPaid) { this.depositPaid = depositPaid; }

    public Boolean getIdVerified() { return idVerified; }
    public void setIdVerified(Boolean idVerified) { this.idVerified = idVerified; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getBookingId() { return bookingId; }
    public void setBookingId(UUID bookingId) { this.bookingId = bookingId; }

    public BigDecimal getAdvanceAmount() { return advanceAmount; }
    public void setAdvanceAmount(BigDecimal advanceAmount) { this.advanceAmount = advanceAmount; }

    public String getTenantEmail() { return tenantEmail; }
    public void setTenantEmail(String tenantEmail) { this.tenantEmail = tenantEmail; }

    public String getTenantPhone() { return tenantPhone; }
    public void setTenantPhone(String tenantPhone) { this.tenantPhone = tenantPhone; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
