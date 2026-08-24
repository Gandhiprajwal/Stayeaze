package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.SupportTicket;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lightweight SupportTicket summary payload for list views.
 * Removes raw nested User and Organization entities.
 */
public class SupportTicketSummaryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String ticketNumber;
    private UUID organizationId;
    private String organizationName;
    private UUID createdByUserId;
    private String createdByName;
    private String createdByEmail;
    private String title;
    private String category;
    private String priority;
    private String status;
    private String assignedAgent;
    private String contactEmail;
    private String contactPhone;
    private Boolean escalated;
    private String lastMessageSenderRole;
    private String lastMessageSenderId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime resolvedAt;

    public SupportTicketSummaryDTO() {}

    public static SupportTicketSummaryDTO fromEntity(SupportTicket ticket) {
        if (ticket == null) return null;
        SupportTicketSummaryDTO dto = new SupportTicketSummaryDTO();
        dto.setId(ticket.getId());
        dto.setTicketNumber(ticket.getTicketNumber());
        if (ticket.getOrganization() != null) {
            dto.setOrganizationId(ticket.getOrganization().getId());
            dto.setOrganizationName(ticket.getOrganization().getName());
        }
        if (ticket.getCreatedBy() != null) {
            dto.setCreatedByUserId(ticket.getCreatedBy().getId());
            String name = ticket.getCreatedBy().getFirstName();
            dto.setCreatedByName(name != null && !name.isBlank() ? name : ticket.getCreatedBy().getEmail());
            dto.setCreatedByEmail(ticket.getCreatedBy().getEmail());
        }
        dto.setTitle(ticket.getTitle());
        dto.setCategory(ticket.getCategory());
        dto.setPriority(ticket.getPriority());
        dto.setStatus(ticket.getStatus());
        dto.setAssignedAgent(ticket.getAssignedAgent());
        dto.setContactEmail(ticket.getContactEmail());
        dto.setContactPhone(ticket.getContactPhone());
        dto.setEscalated(ticket.getEscalated());
        dto.setLastMessageSenderRole(ticket.getLastMessageSenderRole());
        dto.setLastMessageSenderId(ticket.getLastMessageSenderId());
        dto.setCreatedAt(ticket.getCreatedAt());
        dto.setUpdatedAt(ticket.getUpdatedAt());
        dto.setResolvedAt(ticket.getResolvedAt());
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }

    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }

    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    public UUID getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(UUID createdByUserId) { this.createdByUserId = createdByUserId; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public String getCreatedByEmail() { return createdByEmail; }
    public void setCreatedByEmail(String createdByEmail) { this.createdByEmail = createdByEmail; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAssignedAgent() { return assignedAgent; }
    public void setAssignedAgent(String assignedAgent) { this.assignedAgent = assignedAgent; }

    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public Boolean getEscalated() { return escalated; }
    public void setEscalated(Boolean escalated) { this.escalated = escalated; }

    public String getLastMessageSenderRole() { return lastMessageSenderRole; }
    public void setLastMessageSenderRole(String lastMessageSenderRole) { this.lastMessageSenderRole = lastMessageSenderRole; }

    public String getLastMessageSenderId() { return lastMessageSenderId; }
    public void setLastMessageSenderId(String lastMessageSenderId) { this.lastMessageSenderId = lastMessageSenderId; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
