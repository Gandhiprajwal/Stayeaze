package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "key_loans")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class KeyLoan {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    @JsonIgnore
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    @JsonIgnore
    private Property property;

    @Column(name = "room_number", nullable = false)
    private String roomNumber;

    @Column(name = "bed_number")
    private String bedNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    @JsonIgnore
    private Tenant tenant;

    @Column(name = "tenant_name", nullable = false)
    private String tenantName;

    @Column(name = "tenant_phone")
    private String tenantPhone;

    @Column(name = "loan_reason", nullable = false)
    private String loanReason = "LOCKED_OUT"; // LOCKED_OUT, ROOM_INSPECTION, MAINTENANCE, SPARE_BORROW

    @Column(name = "loan_time")
    private OffsetDateTime loanTime = OffsetDateTime.now();

    @Column(name = "expected_return_time")
    private OffsetDateTime expectedReturnTime;

    @Column(name = "actual_return_time")
    private OffsetDateTime actualReturnTime;

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE_LOAN"; // ACTIVE_LOAN, RETURNED, LOST_REPLACED

    @Column(name = "issued_by_name")
    private String issuedByName;

    @Column(name = "replacement_fee")
    private BigDecimal replacementFee = BigDecimal.ZERO;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public KeyLoan() {}

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public Tenant getTenant() { return tenant; }
    public void setTenant(Tenant tenant) { this.tenant = tenant; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public String getTenantPhone() { return tenantPhone; }
    public void setTenantPhone(String tenantPhone) { this.tenantPhone = tenantPhone; }

    public String getLoanReason() { return loanReason; }
    public void setLoanReason(String loanReason) { this.loanReason = loanReason; }

    public OffsetDateTime getLoanTime() { return loanTime; }
    public void setLoanTime(OffsetDateTime loanTime) { this.loanTime = loanTime; }

    public OffsetDateTime getExpectedReturnTime() { return expectedReturnTime; }
    public void setExpectedReturnTime(OffsetDateTime expectedReturnTime) { this.expectedReturnTime = expectedReturnTime; }

    public OffsetDateTime getActualReturnTime() { return actualReturnTime; }
    public void setActualReturnTime(OffsetDateTime actualReturnTime) { this.actualReturnTime = actualReturnTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getIssuedByName() { return issuedByName; }
    public void setIssuedByName(String issuedByName) { this.issuedByName = issuedByName; }

    public BigDecimal getReplacementFee() { return replacementFee; }
    public void setReplacementFee(BigDecimal replacementFee) { this.replacementFee = replacementFee; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public UUID getPropertyId() { return property != null ? property.getId() : null; }
    public UUID getTenantId() { return tenant != null ? tenant.getId() : null; }
}
