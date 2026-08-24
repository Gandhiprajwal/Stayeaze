package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Visitor;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lightweight Visitor summary payload for table/list views.
 * Removes raw nested Organization, Property, and Tenant entities.
 */
public class VisitorSummaryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID tenantId;
    private String tenantName;
    private UUID organizationId;
    private UUID propertyId;
    private String propertyName;
    private String approvedBy;
    private String visitorName;
    private String mobileNumber;
    private String photoUrl;
    private String passCode;
    private String qrCodeData;
    private String vehicleNumber;
    private OffsetDateTime expectedArrival;
    private String rejectionReason;
    private String purpose;
    private OffsetDateTime checkInTime;
    private OffsetDateTime checkOutTime;
    private String status;

    public VisitorSummaryDTO() {}

    public static VisitorSummaryDTO fromEntity(Visitor v) {
        if (v == null) return null;
        VisitorSummaryDTO dto = new VisitorSummaryDTO();
        dto.setId(v.getId());
        try {
            if (v.getTenant() != null) {
                dto.setTenantId(v.getTenant().getId());
            }
        } catch (Exception ignored) {}
        dto.setTenantName(v.getTenantName());
        try {
            if (v.getOrganization() != null) {
                dto.setOrganizationId(v.getOrganization().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (v.getProperty() != null) {
                dto.setPropertyId(v.getProperty().getId());
                dto.setPropertyName(v.getProperty().getName());
            }
        } catch (Exception ignored) {}
        dto.setApprovedBy(v.getApprovedBy());
        dto.setVisitorName(v.getVisitorName());
        dto.setMobileNumber(v.getMobileNumber());
        dto.setPhotoUrl(v.getPhotoUrl());
        dto.setPassCode(v.getPassCode());
        dto.setQrCodeData(v.getQrCodeData());
        dto.setVehicleNumber(v.getVehicleNumber());
        dto.setExpectedArrival(v.getExpectedArrival());
        dto.setRejectionReason(v.getRejectionReason());
        dto.setPurpose(v.getPurpose());
        dto.setCheckInTime(v.getCheckInTime());
        dto.setCheckOutTime(v.getCheckOutTime());
        dto.setStatus(v.getStatus());
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }

    public String getVisitorName() { return visitorName; }
    public void setVisitorName(String visitorName) { this.visitorName = visitorName; }

    public String getMobileNumber() { return mobileNumber; }
    public void setMobileNumber(String mobileNumber) { this.mobileNumber = mobileNumber; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getPassCode() { return passCode; }
    public void setPassCode(String passCode) { this.passCode = passCode; }

    public String getQrCodeData() { return qrCodeData; }
    public void setQrCodeData(String qrCodeData) { this.qrCodeData = qrCodeData; }

    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public OffsetDateTime getExpectedArrival() { return expectedArrival; }
    public void setExpectedArrival(OffsetDateTime expectedArrival) { this.expectedArrival = expectedArrival; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }

    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }

    public OffsetDateTime getCheckInTime() { return checkInTime; }
    public void setCheckInTime(OffsetDateTime checkInTime) { this.checkInTime = checkInTime; }

    public OffsetDateTime getCheckOutTime() { return checkOutTime; }
    public void setCheckOutTime(OffsetDateTime checkOutTime) { this.checkOutTime = checkOutTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
