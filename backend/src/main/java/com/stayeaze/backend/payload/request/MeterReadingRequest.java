package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class MeterReadingRequest {
    private UUID propertyId;
    private UUID buildingId;
    private UUID roomId;

    @NotNull
    private LocalDate readingDate;

    @NotNull
    private BigDecimal readingValue;

    @NotNull
    private BigDecimal unitRate;

    public MeterReadingRequest() {
    }

    public java.util.UUID getPropertyId() { return propertyId; }
    public void setPropertyId(java.util.UUID propertyId) { this.propertyId = propertyId; }

    public java.util.UUID getBuildingId() { return buildingId; }
    public void setBuildingId(java.util.UUID buildingId) { this.buildingId = buildingId; }

    public java.util.UUID getRoomId() { return roomId; }
    public void setRoomId(java.util.UUID roomId) { this.roomId = roomId; }

    public LocalDate getReadingDate() {
        return readingDate;
    }

    public void setReadingDate(LocalDate readingDate) {
        this.readingDate = readingDate;
    }

    public BigDecimal getReadingValue() {
        return readingValue;
    }

    public void setReadingValue(BigDecimal readingValue) {
        this.readingValue = readingValue;
    }

    public BigDecimal getUnitRate() {
        return unitRate;
    }

    public void setUnitRate(BigDecimal unitRate) {
        this.unitRate = unitRate;
    }
}
