package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;

public class ParcelRequest {
    @NotBlank
    private String courierCompany;

    private String trackingNumber;

    public ParcelRequest() {
    }

    public String getCourierCompany() {
        return courierCompany;
    }

    public void setCourierCompany(String courierCompany) {
        this.courierCompany = courierCompany;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }
}
