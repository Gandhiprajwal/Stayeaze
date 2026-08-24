package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "user_journey_audits", indexes = {
    @Index(name = "idx_uja_org_id", columnList = "org_id"),
    @Index(name = "idx_uja_user_email", columnList = "user_email"),
    @Index(name = "idx_uja_category", columnList = "category"),
    @Index(name = "idx_uja_status", columnList = "status"),
    @Index(name = "idx_uja_resource_id", columnList = "resource_id"),
    @Index(name = "idx_uja_created_at", columnList = "created_at")
})
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class UserJourneyAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id", insertable = false, updatable = false)
    @JsonIgnore
    private Organization organization;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "org_name", length = 150)
    private String orgName;

    @Column(name = "org_subdomain", length = 100)
    private String orgSubdomain;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "user_email", length = 150)
    private String userEmail;

    @Column(name = "user_role", length = 50)
    private String userRole;

    @Column(name = "category", nullable = false, length = 50)
    private String category; // AUTH, SAAS_BILLING, TENANT_RENT, ONBOARDING, SECURITY, SYSTEM_ERROR

    @Column(name = "action", nullable = false, length = 100)
    private String action; // LOGIN_SUCCESS, LOGIN_FAILED, PAYMENT_INITIATED, PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_DEDUCTION_ANOMALY, etc.

    @Column(name = "status", nullable = false, length = 30)
    private String status = "SUCCESS"; // SUCCESS, FAILURE, WARNING, CRITICAL

    @Column(name = "resource_id", length = 150)
    private String resourceId; // order_id, payment_id, invoice_id, ticket_id

    @Column(name = "amount", precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details; // JSON formatted payload, error details, gateway code, stack summary

    @Column(name = "client_ip", length = 50)
    private String clientIp;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "device", length = 100)
    private String device; // e.g. "Chrome 128 / Windows 11", "Safari / iPhone iOS 17"

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UserJourneyAudit() {
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
        if (organization != null) {
            this.orgId = organization.getId();
            this.orgName = organization.getName();
            this.orgSubdomain = organization.getSubdomain();
        }
    }

    public UUID getOrgId() {
        return orgId;
    }

    public void setOrgId(UUID orgId) {
        this.orgId = orgId;
    }

    public String getOrgName() {
        return orgName;
    }

    public void setOrgName(String orgName) {
        this.orgName = orgName;
    }

    public String getOrgSubdomain() {
        return orgSubdomain;
    }

    public void setOrgSubdomain(String orgSubdomain) {
        this.orgSubdomain = orgSubdomain;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public String getUserRole() {
        return userRole;
    }

    public void setUserRole(String userRole) {
        this.userRole = userRole;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getResourceId() {
        return resourceId;
    }

    public void setResourceId(String resourceId) {
        this.resourceId = resourceId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
