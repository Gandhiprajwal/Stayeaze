package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;

public class SafetyIncidentRequest {
    @NotBlank
    private String reportedBy;

    @NotBlank
    private String description;

    private String severity; // LOW, MEDIUM, HIGH

    public SafetyIncidentRequest() {
    }

    public String getReportedBy() {
        return reportedBy;
    }

    public void setReportedBy(String reportedBy) {
        this.reportedBy = reportedBy;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }
}
