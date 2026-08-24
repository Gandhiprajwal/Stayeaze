package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Building;

import java.io.Serializable;
import java.util.UUID;

public class BuildingDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID propertyId;
    private String propertyName;
    private String name;
    private String code;
    private int floors;
    private int rooms;
    private int beds;
    private int occupied;
    private String status;

    public BuildingDTO() {}

    public static BuildingDTO fromEntity(Building b) {
        if (b == null) return null;
        BuildingDTO dto = new BuildingDTO();
        dto.setId(b.getId());
        try {
            if (b.getProperty() != null) {
                dto.setPropertyId(b.getProperty().getId());
            }
        } catch (Exception ignored) {}
        try {
            if (b.getProperty() != null) {
                dto.setPropertyName(b.getProperty().getName());
            }
        } catch (Exception ignored) {}
        dto.setName(b.getName());
        dto.setCode(b.getCode());
        dto.setFloors(b.getFloors());
        dto.setRooms(b.getRooms());
        dto.setBeds(b.getBeds());
        dto.setOccupied(b.getOccupied());
        dto.setStatus(b.getStatus() != null ? b.getStatus() : "active");
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public int getFloors() { return floors; }
    public void setFloors(int floors) { this.floors = floors; }

    public int getRooms() { return rooms; }
    public void setRooms(int rooms) { this.rooms = rooms; }

    public int getBeds() { return beds; }
    public void setBeds(int beds) { this.beds = beds; }

    public int getOccupied() { return occupied; }
    public void setOccupied(int occupied) { this.occupied = occupied; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
