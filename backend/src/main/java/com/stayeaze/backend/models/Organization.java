package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "organizations")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Organization {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String subdomain;

    @Column(length = 50)
    private String status = "ACTIVE";

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "gst_enabled")
    private Boolean gstEnabled = false;

    @Column(name = "gstin", length = 20)
    private String gstin;

    @Column(name = "gst_trade_name", length = 150)
    private String gstTradeName;

    @Column(name = "default_gst_rate", precision = 5, scale = 2)
    private java.math.BigDecimal defaultGstRate = new java.math.BigDecimal("18.00");

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Organization() {
    }

    public Organization(String name, String subdomain) {
        this.name = name;
        this.subdomain = subdomain;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public void setSubdomain(String subdomain) {
        this.subdomain = subdomain;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Boolean getGstEnabled() {
        return gstEnabled != null ? gstEnabled : false;
    }

    public void setGstEnabled(Boolean gstEnabled) {
        this.gstEnabled = gstEnabled;
    }

    public String getGstin() {
        return gstin;
    }

    public void setGstin(String gstin) {
        this.gstin = gstin;
    }

    public String getGstTradeName() {
        return gstTradeName;
    }

    public void setGstTradeName(String gstTradeName) {
        this.gstTradeName = gstTradeName;
    }

    public java.math.BigDecimal getDefaultGstRate() {
        return defaultGstRate != null ? defaultGstRate : new java.math.BigDecimal("18.00");
    }

    public void setDefaultGstRate(java.math.BigDecimal defaultGstRate) {
        this.defaultGstRate = defaultGstRate;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
