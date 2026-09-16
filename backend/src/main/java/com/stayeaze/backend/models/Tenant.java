package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "organization"})
@Table(name = "tenants", indexes = {
        @Index(name = "idx_tenant_org_status", columnList = "org_id, kyc_status"),
        @Index(name = "idx_tenant_mobile", columnList = "mobile"),
        @Index(name = "idx_tenant_property", columnList = "property_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_tenant_org_mobile", columnNames = {"org_id", "mobile"})
})
public class Tenant {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id", nullable = false)
    @JsonIgnore
    private Organization organization;

    @TenantId
    @Column(name = "org_id", insertable = false, updatable = false)
    private UUID tenantOrgId;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(length = 255)
    private String email;

    @Column(name = "mobile", nullable = false, length = 20)
    private String mobile;

    @Column(length = 10)
    private String gender;

    @Column(name = "kyc_status", length = 50)
    private String kycStatus = "PENDING"; // PENDING, VERIFIED, REJECTED

    @Column(name = "emergency_contact_name", length = 150)
    private String emergencyContactName;

    @Column(name = "emergency_contact_mobile", length = 20)
    private String emergencyContactMobile;

    @Column(length = 255)
    private String dob;

    @Column(length = 150)
    private String occupation;

    @Column(name = "id_type", length = 50)
    private String idType;

    @Column(name = "id_number", length = 100)
    private String idNumber;

    @Column(precision = 12, scale = 2)
    private BigDecimal rent;

    @Column(precision = 12, scale = 2)
    private BigDecimal deposit;

    @Column(name = "advance_balance", precision = 12, scale = 2)
    private BigDecimal advanceBalance = BigDecimal.ZERO;

    @Column(name = "lease_start")
    private String leaseStart;

    @Column(name = "lease_end")
    private String leaseEnd;

    @Column(name = "property_id")
    private UUID propertyId;

    @Column(name = "room_number", length = 50)
    private String roomNumber;

    @Column(name = "bed_number", length = 50)
    private String bedNumber;

    @Column(length = 50)
    private String status = "ACTIVE"; // ACTIVE, CHECKED_OUT, BLACKLISTED

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "refund_upi", length = 100)
    private String refundUpi;

    @Column(name = "refund_account_name", length = 150)
    private String refundAccountName;

    @Column(name = "refund_account_number", length = 50)
    private String refundAccountNumber;

    @Column(name = "refund_ifsc", length = 30)
    private String refundIfsc;

    @Column(name = "refund_bank_name", length = 100)
    private String refundBankName;

    @Column(name = "is_agreement_accepted")
    private Boolean isAgreementAccepted = false;

    @Column(name = "agreement_accepted_at")
    private OffsetDateTime agreementAcceptedAt;

    @Column(name = "lock_in_months")
    private Integer lockInMonths;

    @Column(name = "notice_period_days")
    private Integer noticePeriodDays;

    @Column(name = "last_notice_reminder_sent_at")
    private OffsetDateTime lastNoticeReminderSentAt;

    @Column(name = "notice_status", length = 50)
    private String noticeStatus = "NONE"; // NONE, NOTICE_DUE, REMINDER_SENT, VACATING, RENEWED

    @Column(name = "billing_responsibility", length = 50)
    private String billingResponsibility = "SELF_PAY"; // SELF_PAY, CORPORATE_SPONSORED

    @Column(name = "corporate_company_name", length = 255)
    private String corporateCompanyName;

    @Column(name = "corporate_gstin", length = 30)
    private String corporateGstin;

    @Column(name = "utility_responsibility", length = 50)
    private String utilityResponsibility = "CORPORATE_COVERED"; // CORPORATE_COVERED, OCCUPANT_SELF_PAY

    @Column(name = "deposit_responsibility", length = 50)
    private String depositResponsibility = "OCCUPANT_PAID"; // OCCUPANT_PAID, CORPORATE_PAID

    @Transient
    private String buildingName;

    public Tenant() {
    }

    public Tenant(Organization organization, String firstName, String lastName, String mobile) {
        this.organization = organization;
        this.firstName = firstName;
        this.lastName = lastName;
        this.mobile = mobile;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    @JsonIgnore
    public Organization getOrganization() {
        return organization;
    }

    public UUID getOrgId() {
        if (tenantOrgId != null) {
            return tenantOrgId;
        }
        try {
            return organization != null ? organization.getId() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getName() {
        if (firstName == null)
            return lastName != null && !"-".equals(lastName) ? lastName : "";
        if (lastName == null || "-".equals(lastName))
            return firstName;
        return firstName + " " + lastName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMobile() {
        return mobile;
    }

    // Alias 'phone' for frontend Tenant type compatibility
    public String getPhone() {
        return mobile;
    }

    public void setMobile(String mobile) {
        this.mobile = mobile;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getKycStatus() {
        return kycStatus;
    }

    public void setKycStatus(String kycStatus) {
        this.kycStatus = kycStatus;
    }

    public String getEmergencyContactName() {
        return emergencyContactName;
    }

    // Alias 'emergencyName' for frontend Tenant type compatibility
    public String getEmergencyName() {
        return emergencyContactName;
    }

    public void setEmergencyContactName(String emergencyContactName) {
        this.emergencyContactName = emergencyContactName;
    }

    public String getEmergencyContactMobile() {
        return emergencyContactMobile;
    }

    // Alias 'emergencyContact' for frontend Tenant type compatibility
    public String getEmergencyContact() {
        return emergencyContactMobile;
    }

    public void setEmergencyContactMobile(String emergencyContactMobile) {
        this.emergencyContactMobile = emergencyContactMobile;
    }

    public String getStatus() {
        return status != null ? status.toLowerCase() : null;
    }

    public void setStatus(String status) {
        this.status = status != null ? status.toUpperCase() : null;
    }

    public BigDecimal getAdvanceBalance() {
        return advanceBalance != null ? advanceBalance : BigDecimal.ZERO;
    }

    public void setAdvanceBalance(BigDecimal advanceBalance) {
        this.advanceBalance = advanceBalance != null ? advanceBalance : BigDecimal.ZERO;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getDob() {
        return dob;
    }

    public void setDob(String dob) {
        this.dob = dob;
    }

    public String getOccupation() {
        return occupation;
    }

    public void setOccupation(String occupation) {
        this.occupation = occupation;
    }

    public String getIdType() {
        return idType;
    }

    public void setIdType(String idType) {
        this.idType = idType;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public void setIdNumber(String idNumber) {
        this.idNumber = idNumber;
    }

    public BigDecimal getRent() {
        return rent;
    }

    public void setRent(BigDecimal rent) {
        this.rent = rent;
    }

    public BigDecimal getDeposit() {
        return deposit;
    }

    public BigDecimal getSecurityDeposit() {
        return deposit;
    }

    public void setDeposit(BigDecimal deposit) {
        this.deposit = deposit;
    }

    public void setSecurityDeposit(BigDecimal deposit) {
        this.deposit = deposit;
    }

    public String getLeaseStart() {
        return leaseStart;
    }

    public void setLeaseStart(String leaseStart) {
        this.leaseStart = leaseStart;
    }

    public String getLeaseEnd() {
        return leaseEnd;
    }

    public void setLeaseEnd(String leaseEnd) {
        this.leaseEnd = leaseEnd;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getBedNumber() {
        return bedNumber;
    }

    public void setBedNumber(String bedNumber) {
        this.bedNumber = bedNumber;
    }

    public String getIdProofNumber() {
        return idNumber;
    }

    public String getBuildingName() {
        return buildingName;
    }

    public void setBuildingName(String buildingName) {
        this.buildingName = buildingName;
    }

    public String getRefundUpi() {
        return refundUpi;
    }

    public void setRefundUpi(String refundUpi) {
        this.refundUpi = refundUpi;
    }

    public String getRefundAccountName() {
        return refundAccountName;
    }

    public void setRefundAccountName(String refundAccountName) {
        this.refundAccountName = refundAccountName;
    }

    public String getRefundAccountNumber() {
        return refundAccountNumber;
    }

    public void setRefundAccountNumber(String refundAccountNumber) {
        this.refundAccountNumber = refundAccountNumber;
    }

    public String getRefundIfsc() {
        return refundIfsc;
    }

    public void setRefundIfsc(String refundIfsc) {
        this.refundIfsc = refundIfsc;
    }

    public String getRefundBankName() {
        return refundBankName;
    }

    public void setRefundBankName(String refundBankName) {
        this.refundBankName = refundBankName;
    }

    public Boolean getIsAgreementAccepted() {
        return isAgreementAccepted != null ? isAgreementAccepted : false;
    }

    public void setIsAgreementAccepted(Boolean agreementAccepted) {
        this.isAgreementAccepted = agreementAccepted;
    }

    public OffsetDateTime getAgreementAcceptedAt() {
        return agreementAcceptedAt;
    }

    public void setAgreementAcceptedAt(OffsetDateTime agreementAcceptedAt) {
        this.agreementAcceptedAt = agreementAcceptedAt;
    }

    public Integer getLockInMonths() {
        return lockInMonths;
    }

    public void setLockInMonths(Integer lockInMonths) {
        this.lockInMonths = lockInMonths;
    }

    public Integer getNoticePeriodDays() {
        return noticePeriodDays;
    }

    public void setNoticePeriodDays(Integer noticePeriodDays) {
        this.noticePeriodDays = noticePeriodDays;
    }

    public OffsetDateTime getLastNoticeReminderSentAt() {
        return lastNoticeReminderSentAt;
    }

    public void setLastNoticeReminderSentAt(OffsetDateTime lastNoticeReminderSentAt) {
        this.lastNoticeReminderSentAt = lastNoticeReminderSentAt;
    }

    public String getNoticeStatus() {
        return noticeStatus != null ? noticeStatus : "NONE";
    }

    public void setNoticeStatus(String noticeStatus) {
        this.noticeStatus = noticeStatus;
    }

    public String getBillingResponsibility() {
        return billingResponsibility != null ? billingResponsibility : "SELF_PAY";
    }

    public void setBillingResponsibility(String billingResponsibility) {
        this.billingResponsibility = billingResponsibility;
    }

    public String getCorporateCompanyName() {
        return corporateCompanyName;
    }

    public void setCorporateCompanyName(String corporateCompanyName) {
        this.corporateCompanyName = corporateCompanyName;
    }

    public String getCorporateGstin() {
        return corporateGstin;
    }

    public void setCorporateGstin(String corporateGstin) {
        this.corporateGstin = corporateGstin;
    }

    public String getUtilityResponsibility() {
        return utilityResponsibility != null ? utilityResponsibility : "CORPORATE_COVERED";
    }

    public void setUtilityResponsibility(String utilityResponsibility) {
        this.utilityResponsibility = utilityResponsibility;
    }

    public String getDepositResponsibility() {
        return depositResponsibility != null ? depositResponsibility : "OCCUPANT_PAID";
    }

    public void setDepositResponsibility(String depositResponsibility) {
        this.depositResponsibility = depositResponsibility;
    }
}
