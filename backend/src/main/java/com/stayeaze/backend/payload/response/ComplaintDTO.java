package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Complaint;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lightweight Complaint payload for list/table views.
 * Strips nested Tenant entity; exposes only display fields.
 */
public class ComplaintDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String ticketNumber;
    private UUID tenantId;
    private String tenantName;
    private UUID propertyId;
    private String roomNumber;
    private String category;
    private String description;
    private String status;
    private String priority;
    private String assignedStaff;
    private String assignedTo;
    private Integer feedbackRating;
    private String feedbackNotes;
    private OffsetDateTime resolvedAt;
    private OffsetDateTime createdAt;

    // SLA & Escalation Engine fields
    private OffsetDateTime slaDueAt;
    private Boolean isEscalated;
    private OffsetDateTime escalatedAt;
    private String escalationReason;
    private Boolean slaBreached;
    private String slaStatus; // "RESOLVED", "ESCALATED", "BREACHED", "DUE_SOON", "ON_TRACK"
    private Long slaMinutesRemaining;

    public ComplaintDTO() {}

    public static ComplaintDTO fromEntity(Complaint c) {
        if (c == null) return null;
        ComplaintDTO dto = new ComplaintDTO();
        dto.setId(c.getId());
        dto.setTicketNumber(c.getTicketNumber());
        try {
            if (c.getTenant() != null) {
                dto.setTenantId(c.getTenant().getId());
                dto.setTenantName((c.getTenant().getFirstName() != null ? c.getTenant().getFirstName() : "") + " " +
                                  (c.getTenant().getLastName() != null ? c.getTenant().getLastName() : ""));
                dto.setPropertyId(c.getTenant().getPropertyId());
                if (c.getRoom() != null && c.getRoom().getRoomNumber() != null) {
                    dto.setRoomNumber(c.getRoom().getRoomNumber());
                } else {
                    dto.setRoomNumber(c.getTenant().getRoomNumber());
                }
            } else if (c.getRoom() != null && c.getRoom().getRoomNumber() != null) {
                dto.setRoomNumber(c.getRoom().getRoomNumber());
            }
        } catch (Exception ignored) {}
        dto.setCategory(c.getCategory());
        dto.setDescription(c.getDescription());
        dto.setStatus(c.getStatus() != null ? c.getStatus().toLowerCase() : "open");
        dto.setPriority(c.getPriority() != null ? c.getPriority().toLowerCase() : "medium");
        dto.setAssignedStaff(c.getAssignedStaff());
        dto.setAssignedTo(c.getAssignedStaff());
        dto.setFeedbackRating(c.getFeedbackRating());
        dto.setFeedbackNotes(c.getFeedbackNotes());
        dto.setResolvedAt(c.getResolvedAt());
        dto.setCreatedAt(c.getCreatedAt());

        // SLA fields & Status calculation
        OffsetDateTime slaDue = c.getSlaDueAt();
        if (slaDue == null && c.getCreatedAt() != null) {
            // Fallback dynamic SLA calculation based on category/priority
            String prio = c.getPriority() != null ? c.getPriority().toUpperCase() : "MEDIUM";
            String cat = c.getCategory() != null ? c.getCategory().toUpperCase() : "OTHER";
            int hours = 24;
            if ("CRITICAL".equals(prio)) hours = 4;
            else if ("HIGH".equals(prio) || "ELECTRICAL".equals(cat) || "PLUMBING".equals(cat)) hours = 12;
            else if ("LOW".equals(prio) || "HOUSEKEEPING".equals(cat)) hours = 48;
            slaDue = c.getCreatedAt().plusHours(hours);
        }
        dto.setSlaDueAt(slaDue);
        dto.setIsEscalated(c.getIsEscalated());
        dto.setEscalatedAt(c.getEscalatedAt());
        dto.setEscalationReason(c.getEscalationReason());

        OffsetDateTime now = OffsetDateTime.now();
        boolean isResolved = "RESOLVED".equalsIgnoreCase(c.getStatus()) || c.getResolvedAt() != null;
        boolean breached = Boolean.TRUE.equals(c.getSlaBreached()) || (!isResolved && slaDue != null && now.isAfter(slaDue));
        dto.setSlaBreached(breached);

        if (slaDue != null) {
            long minutes = java.time.Duration.between(now, slaDue).toMinutes();
            dto.setSlaMinutesRemaining(minutes);
        }

        if (isResolved) {
            dto.setSlaStatus("RESOLVED");
        } else if (Boolean.TRUE.equals(c.getIsEscalated())) {
            dto.setSlaStatus("ESCALATED");
        } else if (breached) {
            dto.setSlaStatus("BREACHED");
        } else if (dto.getSlaMinutesRemaining() != null && dto.getSlaMinutesRemaining() <= 360) {
            dto.setSlaStatus("DUE_SOON");
        } else {
            dto.setSlaStatus("ON_TRACK");
        }

        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getAssignedStaff() { return assignedStaff; }
    public void setAssignedStaff(String assignedStaff) { this.assignedStaff = assignedStaff; }

    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }

    public Integer getFeedbackRating() { return feedbackRating; }
    public void setFeedbackRating(Integer feedbackRating) { this.feedbackRating = feedbackRating; }

    public String getFeedbackNotes() { return feedbackNotes; }
    public void setFeedbackNotes(String feedbackNotes) { this.feedbackNotes = feedbackNotes; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public OffsetDateTime getSlaDueAt() { return slaDueAt; }
    public void setSlaDueAt(OffsetDateTime slaDueAt) { this.slaDueAt = slaDueAt; }

    public Boolean getIsEscalated() { return isEscalated; }
    public void setIsEscalated(Boolean isEscalated) { this.isEscalated = isEscalated; }

    public OffsetDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(OffsetDateTime escalatedAt) { this.escalatedAt = escalatedAt; }

    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }

    public Boolean getSlaBreached() { return slaBreached; }
    public void setSlaBreached(Boolean slaBreached) { this.slaBreached = slaBreached; }

    public String getSlaStatus() { return slaStatus; }
    public void setSlaStatus(String slaStatus) { this.slaStatus = slaStatus; }

    public Long getSlaMinutesRemaining() { return slaMinutesRemaining; }
    public void setSlaMinutesRemaining(Long slaMinutesRemaining) { this.slaMinutesRemaining = slaMinutesRemaining; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
