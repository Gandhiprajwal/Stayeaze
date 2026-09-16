package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Bed;

import java.io.Serializable;
import java.util.UUID;

public class MinimalBedDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String bedNumber;
    private String number;
    private UUID roomId;
    private String roomNumber;
    private String status;
    private boolean isOccupied;
    private String tenantId;
    private String tenantName;

    public MinimalBedDTO() {}

    public static MinimalBedDTO fromEntity(Bed b) {
        if (b == null) return null;
        MinimalBedDTO dto = new MinimalBedDTO();
        dto.setId(b.getId());
        dto.setBedNumber(b.getBedNumber());
        dto.setNumber(b.getBedNumber());
        dto.setStatus(b.getStatus() != null ? b.getStatus().toLowerCase() : "available");
        dto.setOccupied("occupied".equalsIgnoreCase(b.getStatus()) || b.getTenantId() != null);

        if (b.getRoom() != null) {
            dto.setRoomId(b.getRoom().getId());
            dto.setRoomNumber(b.getRoom().getRoomNumber());
        }
        dto.setTenantId(b.getTenantId());
        dto.setTenantName(b.getTenantName());
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isOccupied() { return isOccupied; }
    public void setOccupied(boolean occupied) { isOccupied = occupied; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }
}
