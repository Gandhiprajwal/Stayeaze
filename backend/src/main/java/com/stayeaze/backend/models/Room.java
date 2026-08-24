package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "rooms", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"floor_id", "room_number"})
})
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @Column(name = "room_number", nullable = false, length = 20)
    private String roomNumber;

    @Column(name = "sharing_type", nullable = false, length = 50)
    private String sharingType; // SINGLE, DOUBLE, TRIPLE, FOUR_SHARING, DORMITORY

    @Column(name = "base_rent", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseRent;

    @Column(name = "wifi_ssid", length = 150)
    private String wifiSsid;

    @Column(name = "wifi_password", length = 150)
    private String wifiPassword;

    @Column(length = 50)
    private String status = "AVAILABLE"; // AVAILABLE, BLOCKED, MAINTENANCE

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_amenities", joinColumns = @JoinColumn(name = "room_id"))
    @Column(name = "amenity")
    private List<String> amenities = new ArrayList<>();

    // --- Transient fields populated by controller ---
    @Transient
    private Integer beds = 0;

    @Transient
    private Integer occupied = 0;

    public Room() {
    }

    public Room(Floor floor, String roomNumber, String sharingType, BigDecimal baseRent) {
        this.floor = floor;
        this.roomNumber = roomNumber;
        this.sharingType = sharingType;
        this.baseRent = baseRent;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    @JsonIgnore
    public Floor getFloor() {
        return floor;
    }

    public UUID getFloorId() {
        try {
            return (floor != null && org.hibernate.Hibernate.isInitialized(floor)) ? floor.getId() : null;
        } catch (Exception e) {
            return null;
        }
    }

    // Walk hierarchy: Room -> Floor -> Building -> Property
    public UUID getBuildingId() {
        try {
            return (floor != null && org.hibernate.Hibernate.isInitialized(floor) && floor.getBuilding() != null && org.hibernate.Hibernate.isInitialized(floor.getBuilding())) 
                    ? floor.getBuilding().getId() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public UUID getPropertyId() {
        try {
            return (floor != null && org.hibernate.Hibernate.isInitialized(floor) && floor.getBuilding() != null && org.hibernate.Hibernate.isInitialized(floor.getBuilding()) && floor.getBuilding().getProperty() != null && org.hibernate.Hibernate.isInitialized(floor.getBuilding().getProperty()))
                    ? floor.getBuilding().getProperty().getId() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public void setFloor(Floor floor) {
        this.floor = floor;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    // Alias 'number' for frontend Room type compatibility
    public String getNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getSharingType() {
        return sharingType;
    }

    public void setSharingType(String sharingType) {
        this.sharingType = sharingType;
    }

    // Frontend expects 'type' as lowercase: single, double, triple, dorm
    public String getType() {
        if (sharingType == null) return "single";
        return switch (sharingType.toUpperCase()) {
            case "SINGLE" -> "single";
            case "DOUBLE" -> "double";
            case "TRIPLE" -> "triple";
            case "FOUR_SHARING", "DORMITORY" -> "dorm";
            default -> sharingType.toLowerCase();
        };
    }

    // Frontend expects 'sharing' as integer: 1, 2, 3, 4
    public Integer getSharing() {
        if (sharingType == null) return 1;
        return switch (sharingType.toUpperCase()) {
            case "SINGLE" -> 1;
            case "DOUBLE" -> 2;
            case "TRIPLE" -> 3;
            case "FOUR_SHARING" -> 4;
            case "DORMITORY" -> 6;
            default -> 1;
        };
    }

    public BigDecimal getBaseRent() {
        return baseRent;
    }

    // Alias 'rent' for frontend Room type compatibility
    public BigDecimal getRent() {
        return baseRent;
    }

    public void setBaseRent(BigDecimal baseRent) {
        this.baseRent = baseRent;
    }

    public String getWifiSsid() {
        return wifiSsid;
    }

    public void setWifiSsid(String wifiSsid) {
        this.wifiSsid = wifiSsid;
    }

    public String getWifiPassword() {
        return wifiPassword;
    }

    public void setWifiPassword(String wifiPassword) {
        this.wifiPassword = wifiPassword;
    }

    public String getStatus() {
        return status != null ? status.toLowerCase() : null;
    }

    public void setStatus(String status) {
        this.status = status != null ? status.toUpperCase() : null;
    }

    public List<String> getAmenities() {
        return amenities;
    }

    public void setAmenities(List<String> amenities) {
        this.amenities = amenities;
    }

    // Transient stats
    public Integer getBeds() { return beds; }
    public void setBeds(Integer beds) { this.beds = beds; }

    public Integer getOccupied() { return occupied; }
    public void setOccupied(Integer occupied) { this.occupied = occupied; }
}
