package com.stayeaze.backend.models;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.UUID;

@Entity
@Table(name = "beds", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"room_id", "bed_number"})
})
public class Bed {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "bed_number", nullable = false, length = 20)
    private String bedNumber;

    @Column(length = 50)
    private String status = "AVAILABLE"; // AVAILABLE, RESERVED, OCCUPIED, MAINTENANCE

    @Column(name = "qr_code", unique = true, length = 150)
    private String qrCode;

    @Version
    private Long version = 0L;

    @Transient
    private String tenantId;

    @Transient
    private String tenantName;

    public Bed() {
    }

    public Bed(Room room, String bedNumber) {
        this.room = room;
        this.bedNumber = bedNumber;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    @JsonIgnore
    public Room getRoom() {
        return room;
    }

    public UUID getRoomId() {
        return room != null ? room.getId() : null;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public String getBedNumber() {
        return bedNumber;
    }

    // Alias 'number' for frontend Bed type compatibility
    public String getNumber() {
        return bedNumber;
    }

    public void setBedNumber(String bedNumber) {
        this.bedNumber = bedNumber;
    }

    public String getStatus() {
        return status != null ? status.toLowerCase() : null;
    }

    public void setStatus(String status) {
        this.status = status != null ? status.toUpperCase() : null;
    }

    public String getQrCode() {
        return qrCode;
    }

    public void setQrCode(String qrCode) {
        this.qrCode = qrCode;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getTenantName() {
        return tenantName;
    }

    public void setTenantName(String tenantName) {
        this.tenantName = tenantName;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }
}
