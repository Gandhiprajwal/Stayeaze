package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "complaints")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Complaint {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = true)
    @org.hibernate.annotations.NotFound(action = org.hibernate.annotations.NotFoundAction.IGNORE)
    @JsonIgnore
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    @org.hibernate.annotations.NotFound(action = org.hibernate.annotations.NotFoundAction.IGNORE)
    @JsonIgnore
    private Room room;

    @Column(nullable = false, length = 50)
    private String category; // PLUMBING, ELECTRICAL, WIFI, HOUSEKEEPING, OTHER

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(length = 50)
    private String status = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED

    @Column(length = 50)
    private String priority = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "assigned_staff", length = 150)
    private String assignedStaff;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "feedback_rating")
    private Integer feedbackRating;

    @Column(name = "feedback_notes", columnDefinition = "text")
    private String feedbackNotes;

    @Column(name = "resolution_notes", columnDefinition = "text")
    private String resolutionNotes;

    @Column(name = "ticket_number", length = 50)
    private String ticketNumber;

    @Column(name = "sla_due_at")
    private OffsetDateTime slaDueAt;

    @Column(name = "is_escalated")
    private Boolean isEscalated = false;

    @Column(name = "escalated_at")
    private OffsetDateTime escalatedAt;

    @Column(name = "escalation_reason", columnDefinition = "text")
    private String escalationReason;

    @Column(name = "sla_breached")
    private Boolean slaBreached = false;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Complaint() {
    }

    public Complaint(Tenant tenant, String category, String description) {
        this.tenant = tenant;
        this.category = category;
        this.description = description;
    }

    public UUID getId() {
        return id;
    }

    public String getTicketNumber() {
        if (ticketNumber != null && !ticketNumber.isBlank()) {
            return ticketNumber;
        }
        if (id != null) {
            String idStr = id.toString();
            return "TKT-" + (idStr.length() >= 6 ? idStr.substring(0, 6) : idStr).toUpperCase();
        }
        return "TKT-000000";
    }

    public void setTicketNumber(String ticketNumber) {
        this.ticketNumber = ticketNumber;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPriority() {
        return priority != null ? priority : "MEDIUM";
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getAssignedStaff() {
        return assignedStaff;
    }

    public void setAssignedStaff(String assignedStaff) {
        this.assignedStaff = assignedStaff;
    }

    public OffsetDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(OffsetDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Integer getFeedbackRating() {
        return feedbackRating;
    }

    public void setFeedbackRating(Integer feedbackRating) {
        this.feedbackRating = feedbackRating;
    }

    public String getFeedbackNotes() {
        return feedbackNotes;
    }

    public void setFeedbackNotes(String feedbackNotes) {
        this.feedbackNotes = feedbackNotes;
    }

    public String getResolutionNotes() {
        return resolutionNotes;
    }

    public void setResolutionNotes(String resolutionNotes) {
        this.resolutionNotes = resolutionNotes;
    }

    public OffsetDateTime getSlaDueAt() {
        return slaDueAt;
    }

    public void setSlaDueAt(OffsetDateTime slaDueAt) {
        this.slaDueAt = slaDueAt;
    }

    public Boolean getIsEscalated() {
        return isEscalated != null && isEscalated;
    }

    public void setIsEscalated(Boolean isEscalated) {
        this.isEscalated = isEscalated;
    }

    public OffsetDateTime getEscalatedAt() {
        return escalatedAt;
    }

    public void setEscalatedAt(OffsetDateTime escalatedAt) {
        this.escalatedAt = escalatedAt;
    }

    public String getEscalationReason() {
        return escalationReason;
    }

    public void setEscalationReason(String escalationReason) {
        this.escalationReason = escalationReason;
    }

    public Boolean getSlaBreached() {
        return slaBreached != null && slaBreached;
    }

    public void setSlaBreached(Boolean slaBreached) {
        this.slaBreached = slaBreached;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
