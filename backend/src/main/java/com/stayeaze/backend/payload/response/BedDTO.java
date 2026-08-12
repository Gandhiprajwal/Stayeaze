package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Bed;

import java.io.Serializable;
import java.util.UUID;

public class BedDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID roomId;
    private String roomNumber;
    private UUID floorId;
    private Integer floorNumber;
    private UUID buildingId;
    private String buildingName;
    private UUID propertyId;
    private String propertyName;
    private String bedNumber;
    private String number;
    private String status;
    private String qrCode;
    private String tenantId;
    private String tenantName;
    private String tenantMobile;

    public BedDTO() {}

    public static BedDTO fromEntity(Bed b) {
        if (b == null) return null;
        BedDTO dto = new BedDTO();
        dto.setId(b.getId());
        dto.setBedNumber(b.getBedNumber());
        dto.setNumber(b.getBedNumber());
        dto.setStatus(b.getStatus() != null ? b.getStatus() : "available");
        dto.setQrCode(b.getQrCode());
        dto.setTenantId(b.getTenantId());
        dto.setTenantName(b.getTenantName());
        if (b.getRoom() != null) {
            dto.setRoomId(b.getRoom().getId());
            dto.setRoomNumber(b.getRoom().getRoomNumber());
            if (b.getRoom().getFloor() != null) {
                dto.setFloorId(b.getRoom().getFloor().getId());
                dto.setFloorNumber(b.getRoom().getFloor().getFloorNumber());
                if (b.getRoom().getFloor().getBuilding() != null) {
                    dto.setBuildingId(b.getRoom().getFloor().getBuilding().getId());
                    dto.setBuildingName(b.getRoom().getFloor().getBuilding().getName());
                    if (b.getRoom().getFloor().getBuilding().getProperty() != null) {
                        dto.setPropertyId(b.getRoom().getFloor().getBuilding().getProperty().getId());
                        dto.setPropertyName(b.getRoom().getFloor().getBuilding().getProperty().getName());
                    }
                }
            }
        }
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public UUID getFloorId() { return floorId; }
    public void setFloorId(UUID floorId) { this.floorId = floorId; }

    public Integer getFloorNumber() { return floorNumber; }
    public void setFloorNumber(Integer floorNumber) { this.floorNumber = floorNumber; }

    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }

    public String getBuildingName() { return buildingName; }
    public void setBuildingName(String buildingName) { this.buildingName = buildingName; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public String getTenantMobile() { return tenantMobile; }
    public void setTenantMobile(String tenantMobile) { this.tenantMobile = tenantMobile; }
}
