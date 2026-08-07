package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "checkin_checklists")
public class CheckinChecklist {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "keys_handed_over")
    private Boolean keysHandedOver = false;

    @Column(name = "amenities_handed_over")
    private Boolean amenitiesHandedOver = false;

    @Column(name = "sub_meter_reading", precision = 10, scale = 2)
    private BigDecimal subMeterReading;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public CheckinChecklist() {
    }

    public CheckinChecklist(Booking booking, Boolean keysHandedOver, Boolean amenitiesHandedOver, BigDecimal subMeterReading) {
        this.booking = booking;
        this.keysHandedOver = keysHandedOver;
        this.amenitiesHandedOver = amenitiesHandedOver;
        this.subMeterReading = subMeterReading;
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

    public Boolean getKeysHandedOver() {
        return keysHandedOver;
    }

    public void setKeysHandedOver(Boolean keysHandedOver) {
        this.keysHandedOver = keysHandedOver;
    }

    public Boolean getAmenitiesHandedOver() {
        return amenitiesHandedOver;
    }

    public void setAmenitiesHandedOver(Boolean amenitiesHandedOver) {
        this.amenitiesHandedOver = amenitiesHandedOver;
    }

    public BigDecimal getSubMeterReading() {
        return subMeterReading;
    }

    public void setSubMeterReading(BigDecimal subMeterReading) {
        this.subMeterReading = subMeterReading;
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
