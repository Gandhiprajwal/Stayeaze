package com.stayeaze.backend.payload.request;

import java.math.BigDecimal;

public class CheckinChecklistRequest {
    private Boolean keysHandedOver;
    private Boolean amenitiesHandedOver;
    private BigDecimal subMeterReading;
    private String notes;

    public CheckinChecklistRequest() {
    }

    public Boolean getKeysHandedOver() {
        return keysHandedOver;
    }

    public void setKeysHandedOver(Boolean keysHandedOver) {
        this.keysHandedOver = keysHandedOver;
    }

    public Boolean getAmenitiesHandedOver() {
        return amenitiesHandedOver;
    }

    public void setAmenitiesHandedOver(Boolean amenitiesHandedOver) {
        this.amenitiesHandedOver = amenitiesHandedOver;
    }

    public BigDecimal getSubMeterReading() {
        return subMeterReading;
    }

    public void setSubMeterReading(BigDecimal subMeterReading) {
        this.subMeterReading = subMeterReading;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
