package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "parcels")
public class Parcel {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "courier_company", nullable = false, length = 100)
    private String courierCompany;

    @Column(name = "tracking_number", length = 150)
    private String trackingNumber;

    @Column(name = "received_date", nullable = false)
    private OffsetDateTime receivedDate = OffsetDateTime.now();

    @Column(name = "handed_over_date")
    private OffsetDateTime handedOverDate;

    @Column(length = 50)
    private String status = "RECEIVED"; // RECEIVED, HANDED_OVER

    @Column(name = "recipient_signature", length = 255)
    private String recipientSignature;

    public Parcel() {
    }

    public Parcel(Tenant tenant, String courierCompany) {
        this.tenant = tenant;
        this.courierCompany = courierCompany;
    }

    public UUID getId() {
        return id;
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

    public String getCourierCompany() {
        return courierCompany;
    }

    public void setCourierCompany(String courierCompany) {
        this.courierCompany = courierCompany;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }

    public OffsetDateTime getReceivedDate() {
        return receivedDate;
    }

    public void setReceivedDate(OffsetDateTime receivedDate) {
        this.receivedDate = receivedDate;
    }

    public OffsetDateTime getHandedOverDate() {
        return handedOverDate;
    }

    public void setHandedOverDate(OffsetDateTime handedOverDate) {
        this.handedOverDate = handedOverDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRecipientSignature() {
        return recipientSignature;
    }

    public void setRecipientSignature(String recipientSignature) {
        this.recipientSignature = recipientSignature;
    }
}
