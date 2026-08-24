package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "support_tickets")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SupportTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "ticket_number", length = 50, nullable = false, unique = true)
    private String ticketNumber;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "org_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Organization organization;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User createdBy;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(nullable = false, length = 50)
    private String category = "TECHNICAL_BUG"; // TECHNICAL_BUG, BILLING_ISSUE, PAYMENT_GATEWAY, FEATURE_REQUEST, ACCOUNT_SECURITY, OTHER

    @Column(nullable = false, length = 30)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, URGENT

    @Column(nullable = false, length = 30)
    private String status = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED, CLOSED

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "assigned_agent", length = 150)
    private String assignedAgent;

    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "is_escalated", nullable = false)
    private Boolean escalated = false;

    @Column(name = "escalated_at")
    private OffsetDateTime escalatedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "escalated_by_user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User escalatedBy;

    @Column(name = "escalation_category", length = 80)
    private String escalationCategory;

    @Column(name = "escalation_notes", columnDefinition = "TEXT")
    private String escalationNotes;

    @Column(name = "super_admin_action_notes", columnDefinition = "TEXT")
    private String superAdminActionNotes;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @OneToMany(mappedBy = "ticket", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private java.util.List<SupportTicketMessage> messages = new java.util.ArrayList<>();

    // Transient fields populated at query time for notification routing
    @Transient
    private String lastMessageSenderRole; // "SUPPORT" or "CUSTOMER" — who sent the most recent message

    @Transient
    private String lastMessageSenderId; // UUID of the user who sent the most recent message

    public SupportTicket() {}

    public SupportTicket(String ticketNumber, Organization organization, User createdBy, String title, String description, String category, String priority) {
        this.ticketNumber = ticketNumber;
        this.organization = organization;
        this.createdBy = createdBy;
        this.title = title;
        this.description = description;
        this.category = category != null ? category : "TECHNICAL_BUG";
        this.priority = priority != null ? priority : "MEDIUM";
        this.status = "OPEN";
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
    }

    public boolean isResolvedOrClosed() {
        return "RESOLVED".equalsIgnoreCase(status) || "CLOSED".equalsIgnoreCase(status);
    }

    public boolean isPermanentlyLocked() {
        if (!isResolvedOrClosed()) return false;
        OffsetDateTime baseline = resolvedAt != null ? resolvedAt : updatedAt;
        return baseline != null && OffsetDateTime.now().isAfter(baseline.plusHours(24));
    }

    public boolean isWithin24HourGracePeriod() {
        if (!isResolvedOrClosed()) return true;
        return !isPermanentlyLocked();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }

    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }

    public String getAssignedAgent() { return assignedAgent; }
    public void setAssignedAgent(String assignedAgent) { this.assignedAgent = assignedAgent; }

    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public java.util.List<SupportTicketMessage> getMessages() { return messages; }
    public void setMessages(java.util.List<SupportTicketMessage> messages) { this.messages = messages; }

    public String getLastMessageSenderRole() { return lastMessageSenderRole; }
    public void setLastMessageSenderRole(String lastMessageSenderRole) { this.lastMessageSenderRole = lastMessageSenderRole; }

    public String getLastMessageSenderId() { return lastMessageSenderId; }
    public void setLastMessageSenderId(String lastMessageSenderId) { this.lastMessageSenderId = lastMessageSenderId; }

    public Boolean getEscalated() { return escalated != null && escalated; }
    public void setEscalated(Boolean escalated) { this.escalated = escalated; }

    public OffsetDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(OffsetDateTime escalatedAt) { this.escalatedAt = escalatedAt; }

    public User getEscalatedBy() { return escalatedBy; }
    public void setEscalatedBy(User escalatedBy) { this.escalatedBy = escalatedBy; }

    public String getEscalationCategory() { return escalationCategory; }
    public void setEscalationCategory(String escalationCategory) { this.escalationCategory = escalationCategory; }

    public String getEscalationNotes() { return escalationNotes; }
    public void setEscalationNotes(String escalationNotes) { this.escalationNotes = escalationNotes; }

    public String getSuperAdminActionNotes() { return superAdminActionNotes; }
    public void setSuperAdminActionNotes(String superAdminActionNotes) { this.superAdminActionNotes = superAdminActionNotes; }
}
