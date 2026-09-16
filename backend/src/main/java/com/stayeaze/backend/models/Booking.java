package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "bookings")
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bed_id")
    private Bed bed;

    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;

    @Column(name = "checkout_date")
    private LocalDate checkoutDate;

    @Column(name = "rent_agreed", nullable = false, precision = 12, scale = 2)
    private BigDecimal rentAgreed;

    @Column(name = "deposit_agreed", nullable = false, precision = 12, scale = 2)
    private BigDecimal depositAgreed;

    @Column(length = 50)
    private String status = "CONFIRMED"; // CONFIRMED, CHECKED_OUT, CANCELLED

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "advance_amount", precision = 12, scale = 2)
    private BigDecimal advanceAmount = BigDecimal.ZERO;

    @Column(name = "advance_payment_status", length = 50)
    private String advancePaymentStatus = "PENDING";

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "razorpay_order_id", length = 100)
    private String razorpayOrderId;

    @Column(name = "razorpay_payment_id", length = 100)
    private String razorpayPaymentId;

    @Column(name = "razorpay_signature", length = 255)
    private String razorpaySignature;

    @Version
    private Long version = 0L;

    @Column(name = "booking_code", length = 50)
    private String bookingCode;

    @Column(name = "notes", length = 500)
    private String notes;

    @Transient
    private String tenantName;

    @Transient
    private String tenantEmail;

    @Transient
    private String tenantPhone;

    @Transient
    private UUID propertyId;

    @Transient
    private String roomNumber;

    @Transient
    private String bedNumber;

    @Transient
    private Integer durationMonths;

    @Transient
    private String source;

    public Booking() {
    }

    public Booking(Tenant tenant, Bed bed, LocalDate checkinDate, BigDecimal rentAgreed, BigDecimal depositAgreed) {
        this.tenant = tenant;
        this.bed = bed;
        this.checkinDate = checkinDate;
        this.rentAgreed = rentAgreed;
        this.depositAgreed = depositAgreed;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public Bed getBed() {
        return bed;
    }

    public void setBed(Bed bed) {
        this.bed = bed;
    }

    public LocalDate getCheckinDate() {
        return checkinDate;
    }

    public void setCheckinDate(LocalDate checkinDate) {
        this.checkinDate = checkinDate;
    }

    public LocalDate getCheckoutDate() {
        return checkoutDate;
    }

    public void setCheckoutDate(LocalDate checkoutDate) {
        this.checkoutDate = checkoutDate;
    }

    public BigDecimal getRentAgreed() {
        return rentAgreed;
    }

    public void setRentAgreed(BigDecimal rentAgreed) {
        this.rentAgreed = rentAgreed;
    }

    public BigDecimal getDepositAgreed() {
        return depositAgreed;
    }

    public void setDepositAgreed(BigDecimal depositAgreed) {
        this.depositAgreed = depositAgreed;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getBookingCode() {
        return bookingCode;
    }

    public void setBookingCode(String bookingCode) {
        this.bookingCode = bookingCode;
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

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public BigDecimal getAdvanceAmount() { return advanceAmount; }
    public void setAdvanceAmount(BigDecimal advanceAmount) { this.advanceAmount = advanceAmount; }

    public String getAdvancePaymentStatus() { return advancePaymentStatus; }
    public void setAdvancePaymentStatus(String advancePaymentStatus) { this.advancePaymentStatus = advancePaymentStatus; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpaySignature() { return razorpaySignature; }
    public void setRazorpaySignature(String razorpaySignature) { this.razorpaySignature = razorpaySignature; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
