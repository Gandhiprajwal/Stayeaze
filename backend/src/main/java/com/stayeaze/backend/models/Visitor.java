
package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "visitors")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Visitor {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = true)
    @JsonIgnore
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id", nullable = true)
    @JsonIgnore
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = true)
    @JsonIgnore
    private Property property;

    @Column(name = "tenant_name", length = 150)
    private String tenantName;

    @Column(name = "approved_by", length = 150)
    private String approvedBy;

    @Column(name = "visitor_name", nullable = false, length = 150)
    private String visitorName;

    @Column(name = "mobile_number", nullable = false, length = 50)
    private String mobileNumber;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(name = "pass_code", length = 30)
    private String passCode;

    @Column(name = "qr_code_data", length = 500)
    private String qrCodeData;

    @Column(name = "vehicle_number", length = 50)
    private String vehicleNumber;

    @Column(name = "expected_arrival")
    private OffsetDateTime expectedArrival;

    @Column(name = "rejection_reason", length = 255)
    private String rejectionReason;

    @Column(length = 255)
    private String purpose;

    @Column(name = "check_in_time")
    private OffsetDateTime checkInTime;

    @Column(name = "check_out_time")
    private OffsetDateTime checkOutTime;

    @Column(length = 50)
    private String status = "CHECKED_IN"; // PRE_REGISTERED, WAITING_APPROVAL, APPROVED, REJECTED, CHECKED_IN, CHECKED_OUT, EXITED

    public Visitor() {
    }

    public Visitor(Tenant tenant, String visitorName, String mobileNumber) {
        this.tenant = tenant;
        this.visitorName = visitorName;
        this.mobileNumber = mobileNumber;
        if (tenant != null) {
            this.organization = tenant.getOrganization();
            this.tenantName = (tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim();
        }
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
        if (tenant != null) {
            if (this.organization == null) this.organization = tenant.getOrganization();
            if (this.tenantName == null) {
                this.tenantName = (tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim();
            }
        }
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public String getTenantName() {
        if (tenantName != null && !tenantName.isBlank()) return tenantName;
        if (tenant != null) {
            return (tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim();
        }
        return null;
    }

    public void setTenantName(String tenantName) {
        this.tenantName = tenantName;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public String getVisitorName() {
        return visitorName;
    }

    public void setVisitorName(String visitorName) {
        this.visitorName = visitorName;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    // Frontend alias for phone
    public String getVisitorPhone() {
        return mobileNumber;
    }

    public void setVisitorPhone(String visitorPhone) {
        if (visitorPhone != null) this.mobileNumber = visitorPhone;
    }

    public String getName() {
        return visitorName;
    }

    public void setName(String name) {
        if (name != null) this.visitorName = name;
    }

    public String getPhone() {
        return mobileNumber;
    }

    public void setPhone(String phone) {
        if (phone != null) this.mobileNumber = phone;
    }

    public UUID getPropertyId() {
        return property != null ? property.getId() : null;
    }

    public UUID getTenantId() {
        return tenant != null ? tenant.getId() : null;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public OffsetDateTime getCheckInTime() {
        return checkInTime;
    }

    public void setCheckInTime(OffsetDateTime checkInTime) {
        this.checkInTime = checkInTime;
    }

    public OffsetDateTime getCheckOutTime() {
        return checkOutTime;
    }

    public void setCheckOutTime(OffsetDateTime checkOutTime) {
        this.checkOutTime = checkOutTime;
    }

    public OffsetDateTime getExitTime() {
        return checkOutTime;
    }

    public void setExitTime(OffsetDateTime exitTime) {
        this.checkOutTime = exitTime;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getPassCode() {
        return passCode;
    }

    public void setPassCode(String passCode) {
        this.passCode = passCode;
    }

    public String getQrCodeData() {
        return qrCodeData;
    }

    public void setQrCodeData(String qrCodeData) {
        this.qrCodeData = qrCodeData;
    }

    public String getVehicleNumber() {
        return vehicleNumber;
    }

    public void setVehicleNumber(String vehicleNumber) {
        this.vehicleNumber = vehicleNumber;
    }

    public OffsetDateTime getExpectedArrival() {
        return expectedArrival;
    }

    public void setExpectedArrival(OffsetDateTime expectedArrival) {
        this.expectedArrival = expectedArrival;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
