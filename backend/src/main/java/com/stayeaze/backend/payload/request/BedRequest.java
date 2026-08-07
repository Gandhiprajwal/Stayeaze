package com.stayeaze.backend.payload.request;

import java.util.UUID;

public class BedRequest {
    private UUID roomId;

    private String bedNumber;
    private String number; // alias from frontend

    private String status;

    private String qrCode;

    public BedRequest() {
    }

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public String getBedNumber() {
        return bedNumber != null ? bedNumber : number;
    }

    public void setBedNumber(String bedNumber) {
        this.bedNumber = bedNumber;
    }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getQrCode() {
        return qrCode;
    }

    public void setQrCode(String qrCode) {
        this.qrCode = qrCode;
    }
}
