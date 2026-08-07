package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "checkout_audits")
public class CheckoutAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "damages_checked")
    private Boolean damagesChecked = false;

    @Column(name = "damage_charges", precision = 12, scale = 2)
    private BigDecimal damageCharges;

    @Column(name = "keys_returned")
    private Boolean keysReturned = false;

    @Column(name = "refund_amount", precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public CheckoutAudit() {
    }

    public CheckoutAudit(Booking booking, Boolean damagesChecked, BigDecimal damageCharges, Boolean keysReturned, BigDecimal refundAmount) {
        this.booking = booking;
        this.damagesChecked = damagesChecked;
        this.damageCharges = damageCharges;
        this.keysReturned = keysReturned;
        this.refundAmount = refundAmount;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Booking getBooking() {
        return booking;
    }

    public void setBooking(Booking booking) {
        this.booking = booking;
    }

    public Boolean getDamagesChecked() {
        return damagesChecked;
    }

    public void setDamagesChecked(Boolean damagesChecked) {
        this.damagesChecked = damagesChecked;
    }

    public BigDecimal getDamageCharges() {
        return damageCharges;
    }

    public void setDamageCharges(BigDecimal damageCharges) {
        this.damageCharges = damageCharges;
    }

    public Boolean getKeysReturned() {
        return keysReturned;
    }

    public void setKeysReturned(Boolean keysReturned) {
        this.keysReturned = keysReturned;
    }

    public BigDecimal getRefundAmount() {
        return refundAmount;
    }

    public void setRefundAmount(BigDecimal refundAmount) {
        this.refundAmount = refundAmount;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
