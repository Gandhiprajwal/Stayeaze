package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Booking;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class BookingSummaryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String bookingCode;
    private UUID tenantId;
    private String tenantName;
    private String tenantPhone;
    private String tenantEmail;
    private UUID propertyId;
    private String propertyName;
    private String roomNumber;
    private String bedNumber;
    private LocalDate checkinDate;
    private LocalDate checkoutDate;
    private BigDecimal rentAgreed;
    private BigDecimal depositAgreed;
    private BigDecimal advanceAmount;
    private String advancePaymentStatus;
    private String status;
    private String createdAt;

    public BookingSummaryDTO() {}

    public static BookingSummaryDTO fromEntity(Booking b) {
        if (b == null) return null;
        BookingSummaryDTO dto = new BookingSummaryDTO();
        dto.setId(b.getId());
        dto.setBookingCode(b.getBookingCode());
        dto.setCheckinDate(b.getCheckinDate());
        dto.setCheckoutDate(b.getCheckoutDate());
        dto.setRentAgreed(b.getRentAgreed());
        dto.setDepositAgreed(b.getDepositAgreed());
        dto.setAdvanceAmount(b.getAdvanceAmount());
        dto.setAdvancePaymentStatus(b.getAdvancePaymentStatus());
        dto.setStatus(b.getStatus());

        if (b.getCreatedAt() != null) {
            dto.setCreatedAt(b.getCreatedAt().toString());
        }

        if (b.getTenant() != null) {
            try {
                dto.setTenantId(b.getTenant().getId());
                dto.setTenantName(b.getTenant().getFirstName() + " " + (b.getTenant().getLastName() != null ? b.getTenant().getLastName() : ""));
                dto.setTenantPhone(b.getTenant().getPhone());
                dto.setTenantEmail(b.getTenant().getEmail());
            } catch (Exception ignored) {}
        } else {
            dto.setTenantName(b.getTenantName());
            dto.setTenantEmail(b.getTenantEmail());
            dto.setTenantPhone(b.getTenantPhone());
        }

        if (b.getBed() != null) {
            try {
                dto.setBedNumber(b.getBed().getBedNumber());
                if (b.getBed().getRoom() != null) {
                    dto.setRoomNumber(b.getBed().getRoom().getRoomNumber());
                    if (b.getBed().getRoom().getFloor() != null && b.getBed().getRoom().getFloor().getBuilding() != null && b.getBed().getRoom().getFloor().getBuilding().getProperty() != null) {
                        dto.setPropertyId(b.getBed().getRoom().getFloor().getBuilding().getProperty().getId());
                        dto.setPropertyName(b.getBed().getRoom().getFloor().getBuilding().getProperty().getName());
                    }
                }
            } catch (Exception ignored) {}
        }

        if (dto.getPropertyId() == null) {
            dto.setPropertyId(b.getPropertyId());
        }
        if (dto.getRoomNumber() == null) {
            dto.setRoomNumber(b.getRoomNumber());
        }
        if (dto.getBedNumber() == null) {
            dto.setBedNumber(b.getBedNumber());
        }

        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getBookingCode() { return bookingCode; }
    public void setBookingCode(String bookingCode) { this.bookingCode = bookingCode; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public String getTenantPhone() { return tenantPhone; }
    public void setTenantPhone(String tenantPhone) { this.tenantPhone = tenantPhone; }

    public String getTenantEmail() { return tenantEmail; }
    public void setTenantEmail(String tenantEmail) { this.tenantEmail = tenantEmail; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public LocalDate getCheckinDate() { return checkinDate; }
    public void setCheckinDate(LocalDate checkinDate) { this.checkinDate = checkinDate; }

    public LocalDate getCheckoutDate() { return checkoutDate; }
    public void setCheckoutDate(LocalDate checkoutDate) { this.checkoutDate = checkoutDate; }

    public BigDecimal getRentAgreed() { return rentAgreed; }
    public void setRentAgreed(BigDecimal rentAgreed) { this.rentAgreed = rentAgreed; }

    public BigDecimal getDepositAgreed() { return depositAgreed; }
    public void setDepositAgreed(BigDecimal depositAgreed) { this.depositAgreed = depositAgreed; }

    public BigDecimal getAdvanceAmount() { return advanceAmount; }
    public void setAdvanceAmount(BigDecimal advanceAmount) { this.advanceAmount = advanceAmount; }

    public String getAdvancePaymentStatus() { return advancePaymentStatus; }
    public void setAdvancePaymentStatus(String advancePaymentStatus) { this.advancePaymentStatus = advancePaymentStatus; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
