package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;

public class VisitorRequest {
    @NotBlank
    private String visitorName;

    @NotBlank
    private String mobileNumber;

    private String purpose;

    public VisitorRequest() {
    }

    public String getVisitorName() {
        return visitorName;
    }

    public void setVisitorName(String visitorName) {
        this.visitorName = visitorName;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }
}
