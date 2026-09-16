package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Parcel;
import java.io.Serializable;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

public class ParcelDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private MinimalTenantDTO tenant;
    private UUID tenantId;
    private String courierCompany;
    private String trackingNumber;
    private String parcelType;
    private String lockerLocation;
    private String pickupOtp;
    private String qrCodeToken;
    private String status;
    private String handoverMethod;
    private String handedOverBy;
    private String recipientSignature;
    private String delegateName;
    private String delegatePhone;
    private String photoUrl;
    private String notes;
    private Integer reminderCount;
    private OffsetDateTime lastRemindedAt;
    private OffsetDateTime receivedDate;
    private OffsetDateTime handedOverDate;
    private Long ageInHours;
    private Boolean isOverdue;
    private Boolean isPerishable;

    public ParcelDTO() {
    }

    public static ParcelDTO fromEntity(Parcel p) {
        if (p == null) return null;
        ParcelDTO dto = new ParcelDTO();
        dto.setId(p.getId());
        dto.setCourierCompany(p.getCourierCompany());
        dto.setTrackingNumber(p.getTrackingNumber());
        dto.setParcelType(p.getParcelType() != null ? p.getParcelType() : "BOX");
        dto.setLockerLocation(p.getLockerLocation());
        dto.setPickupOtp(p.getPickupOtp());
        dto.setQrCodeToken(p.getQrCodeToken());
        dto.setStatus(p.getStatus() != null ? p.getStatus() : "RECEIVED");
        dto.setHandoverMethod(p.getHandoverMethod());
        dto.setHandedOverBy(p.getHandedOverBy());
        dto.setRecipientSignature(p.getRecipientSignature());
        dto.setDelegateName(p.getDelegateName());
        dto.setDelegatePhone(p.getDelegatePhone());
        dto.setPhotoUrl(p.getPhotoUrl());
        dto.setNotes(p.getNotes());
        dto.setReminderCount(p.getReminderCount());
        dto.setLastRemindedAt(p.getLastRemindedAt());
        dto.setReceivedDate(p.getReceivedDate());
        dto.setHandedOverDate(p.getHandedOverDate());

        // Calculate age and status indicators
        if (p.getReceivedDate() != null) {
            long hours = Duration.between(p.getReceivedDate(), OffsetDateTime.now()).toHours();
            dto.setAgeInHours(Math.max(0, hours));
            boolean pending = "RECEIVED".equalsIgnoreCase(p.getStatus());
            dto.setIsOverdue(pending && hours >= 48);
        } else {
            dto.setAgeInHours(0L);
            dto.setIsOverdue(false);
        }

        String pt = p.getParcelType();
        dto.setIsPerishable(pt != null && (pt.toUpperCase().contains("PERISHABLE") || pt.toUpperCase().contains("FOOD")));

        try {
            if (p.getTenant() != null) {
                dto.setTenant(MinimalTenantDTO.fromEntity(p.getTenant()));
                dto.setTenantId(p.getTenant().getId());
            }
        } catch (Exception e) {
            // fallback if tenant proxy is uninitialized
        }
        return dto;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public MinimalTenantDTO getTenant() {
        return tenant;
    }

    public void setTenant(MinimalTenantDTO tenant) {
        this.tenant = tenant;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
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

    public Long getAgeInHours() {
        return ageInHours;
    }

    public void setAgeInHours(Long ageInHours) {
        this.ageInHours = ageInHours;
    }

    public Boolean getIsOverdue() {
        return isOverdue != null && isOverdue;
    }

    public void setIsOverdue(Boolean isOverdue) {
        this.isOverdue = isOverdue;
    }

    public Boolean getIsPerishable() {
        return isPerishable != null && isPerishable;
    }

    public void setIsPerishable(Boolean isPerishable) {
        this.isPerishable = isPerishable;
    }
}
