package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class ComplaintRequest {
    @NotBlank
    private String category; // PLUMBING, ELECTRICAL, WIFI, HOUSEKEEPING, OTHER

    @NotBlank
    private String description;

    private UUID propertyId;
    private UUID buildingId;
    private UUID floorId;
    private UUID roomId;

    public ComplaintRequest() {
    }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }

    public UUID getFloorId() { return floorId; }
    public void setFloorId(UUID floorId) { this.floorId = floorId; }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }
}
