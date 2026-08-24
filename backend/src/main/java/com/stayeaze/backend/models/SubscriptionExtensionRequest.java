package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "subscription_extension_requests")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SubscriptionExtensionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "org_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Organization organization;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "requested_by_user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User requestedBy;

    @Column(name = "additional_days", nullable = false)
    private Integer additionalDays = 30;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, length = 50)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "reviewed_by_user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "roles"})
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @Column(name = "previous_end_date")
    private OffsetDateTime previousEndDate;

    @Column(name = "new_end_date")
    private OffsetDateTime newEndDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public SubscriptionExtensionRequest() {
    }

    public SubscriptionExtensionRequest(Organization organization, User requestedBy, Integer additionalDays, String reason, OffsetDateTime previousEndDate) {
        this.organization = organization;
        this.requestedBy = requestedBy;
        this.additionalDays = additionalDays != null ? additionalDays : 30;
        this.reason = reason;
        this.previousEndDate = previousEndDate;
        this.status = "PENDING";
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public User getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(User requestedBy) {
        this.requestedBy = requestedBy;
    }

    public Integer getAdditionalDays() {
        return additionalDays;
    }

    public void setAdditionalDays(Integer additionalDays) {
        this.additionalDays = additionalDays;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public User getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(User reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public OffsetDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(OffsetDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewNotes() {
        return reviewNotes;
    }

    public void setReviewNotes(String reviewNotes) {
        this.reviewNotes = reviewNotes;
    }

    public OffsetDateTime getPreviousEndDate() {
        return previousEndDate;
    }

    public void setPreviousEndDate(OffsetDateTime previousEndDate) {
        this.previousEndDate = previousEndDate;
    }

    public OffsetDateTime getNewEndDate() {
        return newEndDate;
    }

    public void setNewEndDate(OffsetDateTime newEndDate) {
        this.newEndDate = newEndDate;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
