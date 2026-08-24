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

    public ComplaintDTO() {}

    public static ComplaintDTO fromEntity(Complaint c) {
        if (c == null) return null;
        ComplaintDTO dto = new ComplaintDTO();
        dto.setId(c.getId());
        if (c.getId() != null) {
            String idStr = c.getId().toString();
            dto.setTicketNumber("TKT-" + (idStr.length() >= 6 ? idStr.substring(0, 6) : idStr).toUpperCase());
        } else {
            dto.setTicketNumber("TKT-000000");
        }
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

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
