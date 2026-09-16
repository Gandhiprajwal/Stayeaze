package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "front_desk_shift_handovers")
public class FrontDeskShiftHandover {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receptionist_id")
    private User receptionist;

    @Column(name = "receptionist_name", nullable = false)
    private String receptionistName;

    @Column(name = "shift_type", nullable = false)
    private String shiftType = "MORNING"; // MORNING, EVENING, NIGHT

    @Column(name = "shift_date", nullable = false)
    private LocalDate shiftDate = LocalDate.now();

    @Column(name = "cash_collected", nullable = false)
    private BigDecimal cashCollected = BigDecimal.ZERO;

    @Column(name = "token_advances", nullable = false)
    private BigDecimal tokenAdvances = BigDecimal.ZERO;

    @Column(name = "key_deposits", nullable = false)
    private BigDecimal keyDeposits = BigDecimal.ZERO;

    @Column(name = "guest_meal_tokens", nullable = false)
    private BigDecimal guestMealTokens = BigDecimal.ZERO;

    @Column(name = "status", nullable = false)
    private String status = "PENDING_VERIFICATION"; // PENDING_VERIFICATION, VERIFIED_DEPOSITED, DISCREPANCY

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_manager_id")
    private User verifiedByManager;

    @Column(name = "verified_by_manager_name")
    private String verifiedByManagerName;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @Column(name = "incoming_staff_name")
    private String incomingStaffName;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public FrontDeskShiftHandover() {}

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public User getReceptionist() { return receptionist; }
    public void setReceptionist(User receptionist) { this.receptionist = receptionist; }

    public String getReceptionistName() { return receptionistName; }
    public void setReceptionistName(String receptionistName) { this.receptionistName = receptionistName; }

    public String getShiftType() { return shiftType; }
    public void setShiftType(String shiftType) { this.shiftType = shiftType; }

    public LocalDate getShiftDate() { return shiftDate; }
    public void setShiftDate(LocalDate shiftDate) { this.shiftDate = shiftDate; }

    public BigDecimal getCashCollected() { return cashCollected; }
    public void setCashCollected(BigDecimal cashCollected) { this.cashCollected = cashCollected; }

    public BigDecimal getTokenAdvances() { return tokenAdvances; }
    public void setTokenAdvances(BigDecimal tokenAdvances) { this.tokenAdvances = tokenAdvances; }

    public BigDecimal getKeyDeposits() { return keyDeposits; }
    public void setKeyDeposits(BigDecimal keyDeposits) { this.keyDeposits = keyDeposits; }

    public BigDecimal getGuestMealTokens() { return guestMealTokens; }
    public void setGuestMealTokens(BigDecimal guestMealTokens) { this.guestMealTokens = guestMealTokens; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public User getVerifiedByManager() { return verifiedByManager; }
    public void setVerifiedByManager(User verifiedByManager) { this.verifiedByManager = verifiedByManager; }

    public String getVerifiedByManagerName() { return verifiedByManagerName; }
    public void setVerifiedByManagerName(String verifiedByManagerName) { this.verifiedByManagerName = verifiedByManagerName; }

    public OffsetDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(OffsetDateTime verifiedAt) { this.verifiedAt = verifiedAt; }

    public String getIncomingStaffName() { return incomingStaffName; }
    public void setIncomingStaffName(String incomingStaffName) { this.incomingStaffName = incomingStaffName; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
