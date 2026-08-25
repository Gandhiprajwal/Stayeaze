package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "floors", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"building_id", "floor_number"})
})
public class Floor {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id", nullable = false)
    private Building building;

    @Column(name = "floor_number", nullable = false)
    private Integer floorNumber;

    @Column(length = 100)
    private String name;

    @Column(length = 50)
    private String status = "ACTIVE"; // ACTIVE, MAINTENANCE

    @Transient
    private Integer rooms = 0;

    @Transient
    private Integer beds = 0;

    @Transient
    private Integer occupied = 0;

    public Floor() {
    }

    public Floor(Building building, Integer floorNumber) {
        this.building = building;
        this.floorNumber = floorNumber;
        this.name = floorNumber != null ? "Floor " + floorNumber : "Floor";
    }

    public Floor(Building building, Integer floorNumber, String name) {
        this.building = building;
        this.floorNumber = floorNumber;
        this.name = (name != null && !name.trim().isEmpty()) ? name.trim() : (floorNumber != null ? "Floor " + floorNumber : "Floor");
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    @JsonIgnore
    public Building getBuilding() {
        return building;
    }

    public UUID getBuildingId() {
        return building != null ? building.getId() : null;
    }

    public void setBuilding(Building building) {
        this.building = building;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    // Alias 'number' for frontend Floor type compatibility
    public Integer getNumber() {
        return floorNumber;
    }

    // Return the actual user-assigned floor name or fallback to "Floor {number}"
    public String getName() {
        if (name != null && !name.trim().isEmpty()) {
            return name;
        }
        return floorNumber != null ? "Floor " + floorNumber : "Floor";
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setFloorNumber(Integer floorNumber) {
        this.floorNumber = floorNumber;
    }

    public String getStatus() {
        return status != null ? status.toLowerCase() : null;
    }

    public void setStatus(String status) {
        this.status = status != null ? status.toUpperCase() : null;
    }

    public Integer getRooms() { return rooms; }
    public void setRooms(Integer rooms) { this.rooms = rooms; }

    public Integer getBeds() { return beds; }
    public void setBeds(Integer beds) { this.beds = beds; }

    public Integer getOccupied() { return occupied; }
    public void setOccupied(Integer occupied) { this.occupied = occupied; }
}
