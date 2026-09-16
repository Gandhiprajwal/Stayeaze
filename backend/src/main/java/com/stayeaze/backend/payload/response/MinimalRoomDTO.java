package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Room;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

public class MinimalRoomDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String roomNumber;
    private String number;
    private UUID floorId;
    private String floorName;
    private Integer floorNumber;
    private UUID buildingId;
    private String buildingName;
    private UUID propertyId;
    private String propertyName;
    private String type;
    private String sharingType;
    private Integer sharing;
    private BigDecimal rent;
    private BigDecimal baseRent;
    private int occupied;
    private int beds;
    private boolean isVacant;
    private String status;

    public MinimalRoomDTO() {}

    public static MinimalRoomDTO fromEntity(Room r) {
        if (r == null) return null;
        MinimalRoomDTO dto = new MinimalRoomDTO();
        dto.setId(r.getId());
        dto.setRoomNumber(r.getRoomNumber());
        dto.setNumber(r.getRoomNumber());
        dto.setSharingType(r.getSharingType());
        dto.setType(r.getSharingType() != null ? r.getSharingType().toLowerCase() : "double");
        dto.setSharing(r.getSharing());
        dto.setRent(r.getBaseRent());
        dto.setBaseRent(r.getBaseRent());
        dto.setOccupied(r.getOccupied());
        dto.setBeds(r.getBeds());
        int cap = r.getSharing() != null && r.getSharing() > 0 ? r.getSharing() : (r.getBeds() > 0 ? r.getBeds() : 1);
        dto.setVacant(r.getOccupied() < cap);
        dto.setStatus(r.getStatus() != null ? r.getStatus().toLowerCase() : "available");

        try {
            if (r.getFloor() != null) {
                dto.setFloorId(r.getFloor().getId());
                dto.setFloorName(r.getFloor().getName());
                dto.setFloorNumber(r.getFloor().getFloorNumber());
                if (r.getFloor().getBuilding() != null) {
                    dto.setBuildingId(r.getFloor().getBuilding().getId());
                    dto.setBuildingName(r.getFloor().getBuilding().getName());
                    if (r.getFloor().getBuilding().getProperty() != null) {
                        dto.setPropertyId(r.getFloor().getBuilding().getProperty().getId());
                        dto.setPropertyName(r.getFloor().getBuilding().getProperty().getName());
                    }
                }
            }
        } catch (Exception ignored) {}

        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public UUID getFloorId() { return floorId; }
    public void setFloorId(UUID floorId) { this.floorId = floorId; }

    public String getFloorName() { return floorName; }
    public void setFloorName(String floorName) { this.floorName = floorName; }

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

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSharingType() { return sharingType; }
    public void setSharingType(String sharingType) { this.sharingType = sharingType; }

    public Integer getSharing() { return sharing; }
    public void setSharing(Integer sharing) { this.sharing = sharing; }

    public BigDecimal getRent() { return rent; }
    public void setRent(BigDecimal rent) { this.rent = rent; }

    public BigDecimal getBaseRent() { return baseRent; }
    public void setBaseRent(BigDecimal baseRent) { this.baseRent = baseRent; }

    public int getOccupied() { return occupied; }
    public void setOccupied(int occupied) { this.occupied = occupied; }

    public int getBeds() { return beds; }
    public void setBeds(int beds) { this.beds = beds; }

    public boolean isVacant() { return isVacant; }
    public void setVacant(boolean vacant) { isVacant = vacant; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
