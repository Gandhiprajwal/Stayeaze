package com.stayeaze.backend.payload.request;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class BookingRequest {
    private UUID bedId;
    private LocalDate checkinDate;
    private LocalDate checkInDate;
    private BigDecimal rentAgreed;
    private BigDecimal rent;
    private BigDecimal depositAgreed;
    private BigDecimal deposit;

    private String tenantName;
    private String tenantEmail;
    private String tenantPhone;
    private UUID propertyId;
    private String roomNumber;
    private String bedNumber;
    private Integer durationMonths;
    private String status;
    private String source;
    private String bookingCode;

    public BookingRequest() {
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public LocalDate getCheckinDate() {
        return checkinDate != null ? checkinDate : checkInDate;
    }

    public void setCheckinDate(LocalDate checkinDate) {
        this.checkinDate = checkinDate;
    }

    public LocalDate getCheckInDate() {
        return checkInDate != null ? checkInDate : checkinDate;
    }

    public void setCheckInDate(LocalDate checkInDate) {
        this.checkInDate = checkInDate;
    }

    public BigDecimal getRentAgreed() {
        return rentAgreed != null ? rentAgreed : rent;
    }

    public void setRentAgreed(BigDecimal rentAgreed) {
        this.rentAgreed = rentAgreed;
    }

    public BigDecimal getRent() {
        return rent != null ? rent : rentAgreed;
    }

    public void setRent(BigDecimal rent) {
        this.rent = rent;
    }

    public BigDecimal getDepositAgreed() {
        return depositAgreed != null ? depositAgreed : deposit;
    }

    public void setDepositAgreed(BigDecimal depositAgreed) {
        this.depositAgreed = depositAgreed;
    }

    public BigDecimal getDeposit() {
        return deposit != null ? deposit : depositAgreed;
    }

    public void setDeposit(BigDecimal deposit) {
        this.deposit = deposit;
    }

    public String getTenantName() {
        return tenantName;
    }

    public void setTenantName(String tenantName) {
        this.tenantName = tenantName;
    }

    public String getTenantEmail() {
        return tenantEmail;
    }

    public void setTenantEmail(String tenantEmail) {
        this.tenantEmail = tenantEmail;
    }

    public String getTenantPhone() {
        return tenantPhone;
    }

    public void setTenantPhone(String tenantPhone) {
        this.tenantPhone = tenantPhone;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getBedNumber() {
        return bedNumber;
    }

    public void setBedNumber(String bedNumber) {
        this.bedNumber = bedNumber;
    }

    public Integer getDurationMonths() {
        return durationMonths;
    }

    public void setDurationMonths(Integer durationMonths) {
        this.durationMonths = durationMonths;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getBookingCode() {
        return bookingCode;
    }

    public void setBookingCode(String bookingCode) {
        this.bookingCode = bookingCode;
    }
}
