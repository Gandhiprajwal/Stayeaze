package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Room;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

public class RoomDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID floorId;
    private Integer floorNumber;
    private UUID buildingId;
    private String buildingName;
    private UUID propertyId;
    private String propertyName;
    private String roomNumber;
    private String sharingType;
    private String type;
    private Integer sharing;
    private BigDecimal baseRent;
    private BigDecimal rent;
    private int occupied;
    private int beds;
    private String status;
    private java.util.List<String> amenities = new java.util.ArrayList<>();

    public RoomDTO() {}

    public static RoomDTO fromEntity(Room r) {
        if (r == null) return null;
        RoomDTO dto = new RoomDTO();
        dto.setId(r.getId());
        try {
            if (r.getFloor() != null) {
                dto.setFloorId(r.getFloor().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (r.getFloor() != null) {
                dto.setFloorNumber(r.getFloor().getFloorNumber());
            }
        } catch (Exception ignored) {}
        try {
            if (r.getFloor() != null && r.getFloor().getBuilding() != null) {
                dto.setBuildingId(r.getFloor().getBuilding().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (r.getFloor() != null && r.getFloor().getBuilding() != null) {
                dto.setBuildingName(r.getFloor().getBuilding().getName());
            }
        } catch (Exception ignored) {}
        try {
            if (r.getFloor() != null && r.getFloor().getBuilding() != null && r.getFloor().getBuilding().getProperty() != null) {
                dto.setPropertyId(r.getFloor().getBuilding().getProperty().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (r.getFloor() != null && r.getFloor().getBuilding() != null && r.getFloor().getBuilding().getProperty() != null) {
                dto.setPropertyName(r.getFloor().getBuilding().getProperty().getName());
            }
        } catch (Exception ignored) {}
        dto.setRoomNumber(r.getRoomNumber());
        dto.setNumber(r.getRoomNumber());
        dto.setSharingType(r.getSharingType());
        dto.setType(r.getSharingType() != null ? r.getSharingType().toLowerCase() : "double");
        dto.setSharing(r.getSharing());
        dto.setBaseRent(r.getBaseRent());
        dto.setRent(r.getBaseRent());
        dto.setOccupied(r.getOccupied());
        dto.setBeds(r.getBeds());
        dto.setStatus(r.getStatus() != null ? r.getStatus() : "available");
        dto.setAmenities(r.getAmenities() != null ? new java.util.ArrayList<>(r.getAmenities()) : new java.util.ArrayList<>());
        return dto;
    }

    public String getNumber() { return roomNumber; }
    public void setNumber(String number) { this.roomNumber = number; }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

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

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getSharingType() { return sharingType; }
    public void setSharingType(String sharingType) { this.sharingType = sharingType; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Integer getSharing() { return sharing; }
    public void setSharing(Integer sharing) { this.sharing = sharing; }

    public BigDecimal getBaseRent() { return baseRent; }
    public void setBaseRent(BigDecimal baseRent) { this.baseRent = baseRent; }

    public BigDecimal getRent() { return rent; }
    public void setRent(BigDecimal rent) { this.rent = rent; }

    public int getOccupied() { return occupied; }
    public void setOccupied(int occupied) { this.occupied = occupied; }

    public int getBeds() { return beds; }
    public void setBeds(int beds) { this.beds = beds; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public java.util.List<String> getAmenities() { return amenities; }
    public void setAmenities(java.util.List<String> amenities) { this.amenities = amenities; }
}
