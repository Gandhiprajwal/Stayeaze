package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.UUID;

public class InquiryRequest {
    private UUID propertyId;

    @NotBlank
    private String name;

    private String email;

    @NotBlank
    private String mobile;

    private String gender;

    private String preferredSharing;

    private LocalDate expectedMoveInDate;

    private String source;

    private String status;

    private UUID assignedToUserId;

    public InquiryRequest() {
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMobile() {
        return mobile;
    }

    public void setMobile(String mobile) {
        this.mobile = mobile;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getPreferredSharing() {
        return preferredSharing;
    }

    public void setPreferredSharing(String preferredSharing) {
        this.preferredSharing = preferredSharing;
    }

    public LocalDate getExpectedMoveInDate() {
        return expectedMoveInDate;
    }

    public void setExpectedMoveInDate(LocalDate expectedMoveInDate) {
        this.expectedMoveInDate = expectedMoveInDate;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getAssignedToUserId() {
        return assignedToUserId;
    }

    public void setAssignedToUserId(UUID assignedToUserId) {
        this.assignedToUserId = assignedToUserId;
    }
}
