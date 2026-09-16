package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "meter_readings")
public class MeterReading {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "reading_date", nullable = false)
    private LocalDate readingDate;

    @Column(name = "reading_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal readingValue;

    @Column(name = "unit_rate", nullable = false, precision = 6, scale = 2)
    private BigDecimal unitRate;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "previous_reading_value", precision = 10, scale = 2)
    private BigDecimal previousReadingValue;

    @Column(name = "units_consumed", precision = 10, scale = 2)
    private BigDecimal unitsConsumed;

    @Column(name = "billing_month")
    private Integer billingMonth;

    @Column(name = "billing_year")
    private Integer billingYear;

    @Column(name = "split_mode", length = 50)
    private String splitMode = "FAIR_PROPORTIONAL"; // FAIR_PROPORTIONAL, EQUAL_OCCUPANTS, SINGLE_OCCUPANT, CUSTOM

    @Column(name = "free_allowance_units", precision = 10, scale = 2)
    private BigDecimal freeAllowanceUnits = BigDecimal.ZERO;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(name = "tenant_split_details_json", columnDefinition = "TEXT")
    private String tenantSplitDetailsJson;

    @Column(length = 50)
    private String status = "UNBILLED"; // UNBILLED, BILLED

    @Column(name = "meter_replaced")
    private Boolean meterReplaced = false;

    @Column(name = "old_meter_final_reading", precision = 10, scale = 2)
    private BigDecimal oldMeterFinalReading;

    @Column(name = "new_meter_initial_reading", precision = 10, scale = 2)
    private BigDecimal newMeterInitialReading;

    public MeterReading() {
    }

    public MeterReading(Room room, LocalDate readingDate, BigDecimal readingValue, BigDecimal unitRate, BigDecimal totalAmount) {
        this.room = room;
        this.readingDate = readingDate;
        this.readingValue = readingValue;
        this.unitRate = unitRate;
        this.totalAmount = totalAmount;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public LocalDate getReadingDate() {
        return readingDate;
    }

    public void setReadingDate(LocalDate readingDate) {
        this.readingDate = readingDate;
    }

    public BigDecimal getReadingValue() {
        return readingValue;
    }

    public void setReadingValue(BigDecimal readingValue) {
        this.readingValue = readingValue;
    }

    public BigDecimal getPreviousReadingValue() {
        return previousReadingValue;
    }

    public void setPreviousReadingValue(BigDecimal previousReadingValue) {
        this.previousReadingValue = previousReadingValue;
    }

    public BigDecimal getUnitsConsumed() {
        return unitsConsumed;
    }

    public void setUnitsConsumed(BigDecimal unitsConsumed) {
        this.unitsConsumed = unitsConsumed;
    }

    public BigDecimal getUnitRate() {
        return unitRate;
    }

    public void setUnitRate(BigDecimal unitRate) {
        this.unitRate = unitRate;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public Integer getBillingMonth() {
        return billingMonth;
    }

    public void setBillingMonth(Integer billingMonth) {
        this.billingMonth = billingMonth;
    }

    public Integer getBillingYear() {
        return billingYear;
    }

    public void setBillingYear(Integer billingYear) {
        this.billingYear = billingYear;
    }

    public String getSplitMode() {
        return splitMode;
    }

    public void setSplitMode(String splitMode) {
        this.splitMode = splitMode;
    }

    public BigDecimal getFreeAllowanceUnits() {
        return freeAllowanceUnits;
    }

    public void setFreeAllowanceUnits(BigDecimal freeAllowanceUnits) {
        this.freeAllowanceUnits = freeAllowanceUnits;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getTenantSplitDetailsJson() {
        return tenantSplitDetailsJson;
    }

    public void setTenantSplitDetailsJson(String tenantSplitDetailsJson) {
        this.tenantSplitDetailsJson = tenantSplitDetailsJson;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Boolean getMeterReplaced() {
        return meterReplaced;
    }

    public void setMeterReplaced(Boolean meterReplaced) {
        this.meterReplaced = meterReplaced;
    }

    public BigDecimal getOldMeterFinalReading() {
        return oldMeterFinalReading;
    }

    public void setOldMeterFinalReading(BigDecimal oldMeterFinalReading) {
        this.oldMeterFinalReading = oldMeterFinalReading;
    }

    public BigDecimal getNewMeterInitialReading() {
        return newMeterInitialReading;
    }

    public void setNewMeterInitialReading(BigDecimal newMeterInitialReading) {
        this.newMeterInitialReading = newMeterInitialReading;
    }
}
