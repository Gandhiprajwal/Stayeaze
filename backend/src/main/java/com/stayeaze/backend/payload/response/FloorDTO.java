package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Floor;

import java.io.Serializable;
import java.util.UUID;

/**
 * Lightweight Floor payload for list/table views.
 * Strips the nested Building/Organization entity from JSON responses.
 */
public class FloorDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID buildingId;
    private String buildingName;
    private UUID propertyId;
    private String propertyName;
    private Integer floorNumber;
    private Integer number;
    private String name;
    private String status;
    private String wifiSsid;
    private String wifiPassword;
    private int rooms;
    private int beds;
    private int occupied;

    public FloorDTO() {}

    public static FloorDTO fromEntity(Floor f) {
        if (f == null) return null;
        FloorDTO dto = new FloorDTO();
        dto.setId(f.getId());
        dto.setFloorNumber(f.getFloorNumber());
        dto.setNumber(f.getFloorNumber());
        dto.setName(f.getName() != null && !f.getName().isBlank() ? f.getName() : (f.getFloorNumber() != null ? "Floor " + f.getFloorNumber() : "Floor"));
        dto.setStatus(f.getStatus() != null ? f.getStatus() : "ACTIVE");
        dto.setRooms(f.getRooms() != null ? f.getRooms() : 0);
        dto.setBeds(f.getBeds() != null ? f.getBeds() : 0);
        dto.setOccupied(f.getOccupied() != null ? f.getOccupied() : 0);
        try {
            if (f.getBuilding() != null) {
                dto.setBuildingId(f.getBuilding().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (f.getBuilding() != null) {
                dto.setBuildingName(f.getBuilding().getName());
            }
        } catch (Exception ignored) {}
        try {
            if (f.getBuilding() != null && f.getBuilding().getProperty() != null) {
                dto.setPropertyId(f.getBuilding().getProperty().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (f.getBuilding() != null && f.getBuilding().getProperty() != null) {
                dto.setPropertyName(f.getBuilding().getProperty().getName());
            }
        } catch (Exception ignored) {}
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }

    public String getBuildingName() { return buildingName; }
    public void setBuildingName(String buildingName) { this.buildingName = buildingName; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public Integer getFloorNumber() { return floorNumber; }
    public void setFloorNumber(Integer floorNumber) { this.floorNumber = floorNumber; }

    public Integer getNumber() { return number; }
    public void setNumber(Integer number) { this.number = number; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getRooms() { return rooms; }
    public void setRooms(int rooms) { this.rooms = rooms; }

    public int getBeds() { return beds; }
    public void setBeds(int beds) { this.beds = beds; }

    public int getOccupied() { return occupied; }
    public void setOccupied(int occupied) { this.occupied = occupied; }
}
