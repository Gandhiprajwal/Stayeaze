package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;

public class VisitorRequest {
    private java.util.UUID propertyId;
    private java.util.UUID buildingId;
    private java.util.UUID roomId;
    private java.util.UUID tenantId;

    @NotBlank
    private String visitorName;

    @NotBlank
    private String mobileNumber;

    private String purpose;

    public VisitorRequest() {
    }

    public java.util.UUID getPropertyId() { return propertyId; }
    public void setPropertyId(java.util.UUID propertyId) { this.propertyId = propertyId; }

    public java.util.UUID getBuildingId() { return buildingId; }
    public void setBuildingId(java.util.UUID buildingId) { this.buildingId = buildingId; }

    public java.util.UUID getRoomId() { return roomId; }
    public void setRoomId(java.util.UUID roomId) { this.roomId = roomId; }

    public java.util.UUID getTenantId() { return tenantId; }
    public void setTenantId(java.util.UUID tenantId) { this.tenantId = tenantId; }

    public String getVisitorName() {
        return visitorName;
    }

    public void setVisitorName(String visitorName) {
        this.visitorName = visitorName;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }
}
