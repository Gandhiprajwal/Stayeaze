package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Random;
import java.util.UUID;

@Entity
@Table(name = "parcels")
public class Parcel {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "organization", "property", "bed", "room", "user", "documents", "invoices", "complaints", "bookings", "agreements"})
    private Tenant tenant;

    @Column(name = "courier_company", nullable = false, length = 100)
    private String courierCompany;

    @Column(name = "tracking_number", length = 150)
    private String trackingNumber;

    @Column(name = "parcel_type", length = 50)
    private String parcelType = "BOX"; // BOX, ENVELOPE, PERISHABLE_FOOD, FRAGILE, MEDICINE, ELECTRONICS

    @Column(name = "locker_location", length = 100)
    private String lockerLocation;

    @Column(name = "pickup_otp", length = 10)
    private String pickupOtp;

    @Column(name = "qr_code_token", length = 100)
    private String qrCodeToken;

    @Column(length = 50)
    private String status = "RECEIVED"; // RECEIVED, COLLECTED, RETURNED, DISCARDED

    @Column(name = "handover_method", length = 50)
    private String handoverMethod; // OTP, SIGNATURE, QR_CODE, DELEGATE

    @Column(name = "handed_over_by", length = 150)
    private String handedOverBy;

    @Column(name = "recipient_signature", columnDefinition = "TEXT")
    private String recipientSignature;

    @Column(name = "delegate_name", length = 150)
    private String delegateName;

    @Column(name = "delegate_phone", length = 30)
    private String delegatePhone;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "reminder_count")
    private Integer reminderCount = 0;

    @Column(name = "last_reminded_at")
    private OffsetDateTime lastRemindedAt;

    @Column(name = "received_date", nullable = false)
    private OffsetDateTime receivedDate = OffsetDateTime.now();

    @Column(name = "handed_over_date")
    private OffsetDateTime handedOverDate;

    public Parcel() {
        generateOtpAndToken();
    }

    public Parcel(Tenant tenant, String courierCompany) {
        this.tenant = tenant;
        this.courierCompany = courierCompany;
        if (tenant != null) {
            this.organization = tenant.getOrganization();
        }
        generateOtpAndToken();
    }

    public void generateOtpAndToken() {
        if (this.pickupOtp == null || this.pickupOtp.isBlank()) {
            this.pickupOtp = String.format("%04d", new Random().nextInt(10000));
        }
        if (this.qrCodeToken == null || this.qrCodeToken.isBlank()) {
            this.qrCodeToken = "PKG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public String getCourierCompany() {
        return courierCompany;
    }

    public void setCourierCompany(String courierCompany) {
        this.courierCompany = courierCompany;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }

    public String getParcelType() {
        return parcelType;
    }

    public void setParcelType(String parcelType) {
        this.parcelType = parcelType;
    }

    public String getLockerLocation() {
        return lockerLocation;
    }

    public void setLockerLocation(String lockerLocation) {
        this.lockerLocation = lockerLocation;
    }

    public String getPickupOtp() {
        return pickupOtp;
    }

    public void setPickupOtp(String pickupOtp) {
        this.pickupOtp = pickupOtp;
    }

    public String getQrCodeToken() {
        return qrCodeToken;
    }

    public void setQrCodeToken(String qrCodeToken) {
        this.qrCodeToken = qrCodeToken;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getHandoverMethod() {
        return handoverMethod;
    }

    public void setHandoverMethod(String handoverMethod) {
        this.handoverMethod = handoverMethod;
    }

    public String getHandedOverBy() {
        return handedOverBy;
    }

    public void setHandedOverBy(String handedOverBy) {
        this.handedOverBy = handedOverBy;
    }

    public String getRecipientSignature() {
        return recipientSignature;
    }

    public void setRecipientSignature(String recipientSignature) {
        this.recipientSignature = recipientSignature;
    }

    public String getDelegateName() {
        return delegateName;
    }

    public void setDelegateName(String delegateName) {
        this.delegateName = delegateName;
    }

    public String getDelegatePhone() {
        return delegatePhone;
    }

    public void setDelegatePhone(String delegatePhone) {
        this.delegatePhone = delegatePhone;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Integer getReminderCount() {
        return reminderCount != null ? reminderCount : 0;
    }

    public void setReminderCount(Integer reminderCount) {
        this.reminderCount = reminderCount;
    }

    public OffsetDateTime getLastRemindedAt() {
        return lastRemindedAt;
    }

    public void setLastRemindedAt(OffsetDateTime lastRemindedAt) {
        this.lastRemindedAt = lastRemindedAt;
    }

    public OffsetDateTime getReceivedDate() {
        return receivedDate;
    }

    public void setReceivedDate(OffsetDateTime receivedDate) {
        this.receivedDate = receivedDate;
    }

    public OffsetDateTime getHandedOverDate() {
        return handedOverDate;
    }

    public void setHandedOverDate(OffsetDateTime handedOverDate) {
        this.handedOverDate = handedOverDate;
    }
}
