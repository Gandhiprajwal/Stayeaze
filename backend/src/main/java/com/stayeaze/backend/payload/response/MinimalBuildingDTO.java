package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Building;

import java.io.Serializable;
import java.util.UUID;

public class MinimalBuildingDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private String code;
    private UUID propertyId;
    private String propertyName;

    public MinimalBuildingDTO() {}

    public static MinimalBuildingDTO fromEntity(Building b) {
        if (b == null) return null;
        MinimalBuildingDTO dto = new MinimalBuildingDTO();
        dto.setId(b.getId());
        dto.setName(b.getName());
        dto.setCode(b.getCode());
        if (b.getProperty() != null) {
            dto.setPropertyId(b.getProperty().getId());
            dto.setPropertyName(b.getProperty().getName());
        }
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }
}
