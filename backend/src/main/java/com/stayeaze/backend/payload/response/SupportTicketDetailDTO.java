package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.SupportTicket;

import java.time.OffsetDateTime;

/**
 * Detailed SupportTicket payload for single-ticket detail views.
 * Includes text descriptions, resolution notes, and escalation history while removing raw entity relations.
 */
public class SupportTicketDetailDTO extends SupportTicketSummaryDTO {
    private static final long serialVersionUID = 1L;

    private String description;
    private String resolutionNotes;
    private OffsetDateTime escalatedAt;
    private String escalatedByName;
    private String escalationCategory;
    private String escalationNotes;
    private String superAdminActionNotes;

    public SupportTicketDetailDTO() {}

    public static SupportTicketDetailDTO fromEntity(SupportTicket ticket) {
        if (ticket == null) return null;
        SupportTicketSummaryDTO summary = SupportTicketSummaryDTO.fromEntity(ticket);
        SupportTicketDetailDTO dto = new SupportTicketDetailDTO();
        
        dto.setId(summary.getId());
        dto.setTicketNumber(summary.getTicketNumber());
        dto.setOrganizationId(summary.getOrganizationId());
        dto.setOrganizationName(summary.getOrganizationName());
        dto.setCreatedByUserId(summary.getCreatedByUserId());
        dto.setCreatedByName(summary.getCreatedByName());
        dto.setCreatedByEmail(summary.getCreatedByEmail());
        dto.setTitle(summary.getTitle());
        dto.setCategory(summary.getCategory());
        dto.setPriority(summary.getPriority());
        dto.setStatus(summary.getStatus());
        dto.setAssignedAgent(summary.getAssignedAgent());
        dto.setContactEmail(summary.getContactEmail());
        dto.setContactPhone(summary.getContactPhone());
        dto.setEscalated(summary.getEscalated());
        dto.setLastMessageSenderRole(summary.getLastMessageSenderRole());
        dto.setLastMessageSenderId(summary.getLastMessageSenderId());
        dto.setCreatedAt(summary.getCreatedAt());
        dto.setUpdatedAt(summary.getUpdatedAt());
        dto.setResolvedAt(summary.getResolvedAt());

        dto.setDescription(ticket.getDescription());
        dto.setResolutionNotes(ticket.getResolutionNotes());
        dto.setEscalatedAt(ticket.getEscalatedAt());
        if (ticket.getEscalatedBy() != null) {
            String name = ticket.getEscalatedBy().getFirstName();
            dto.setEscalatedByName(name != null && !name.isBlank() ? name : ticket.getEscalatedBy().getEmail());
        }
        dto.setEscalationCategory(ticket.getEscalationCategory());
        dto.setEscalationNotes(ticket.getEscalationNotes());
        dto.setSuperAdminActionNotes(ticket.getSuperAdminActionNotes());
        return dto;
    }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }

    public OffsetDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(OffsetDateTime escalatedAt) { this.escalatedAt = escalatedAt; }

    public String getEscalatedByName() { return escalatedByName; }
    public void setEscalatedByName(String escalatedByName) { this.escalatedByName = escalatedByName; }

    public String getEscalationCategory() { return escalationCategory; }
    public void setEscalationCategory(String escalationCategory) { this.escalationCategory = escalationCategory; }

    public String getEscalationNotes() { return escalationNotes; }
    public void setEscalationNotes(String escalationNotes) { this.escalationNotes = escalationNotes; }

    public String getSuperAdminActionNotes() { return superAdminActionNotes; }
    public void setSuperAdminActionNotes(String superAdminActionNotes) { this.superAdminActionNotes = superAdminActionNotes; }
}
