package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Floor;

import java.io.Serializable;
import java.util.UUID;

public class MinimalFloorDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private Integer floorNumber;
    private UUID buildingId;
    private String buildingName;
    private UUID propertyId;

    public MinimalFloorDTO() {}

    public static MinimalFloorDTO fromEntity(Floor f) {
        if (f == null) return null;
        MinimalFloorDTO dto = new MinimalFloorDTO();
        dto.setId(f.getId());
        dto.setName(f.getName());
        dto.setFloorNumber(f.getFloorNumber());
        if (f.getBuilding() != null) {
            dto.setBuildingId(f.getBuilding().getId());
            dto.setBuildingName(f.getBuilding().getName());
            if (f.getBuilding().getProperty() != null) {
                dto.setPropertyId(f.getBuilding().getProperty().getId());
            }
        }
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getFloorNumber() { return floorNumber; }
    public void setFloorNumber(Integer floorNumber) { this.floorNumber = floorNumber; }

    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }

    public String getBuildingName() { return buildingName; }
    public void setBuildingName(String buildingName) { this.buildingName = buildingName; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }
}
