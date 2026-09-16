package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Tenant;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Lightweight DTO for tenant table lists and dropdown pickers.
 * Excludes heavy KYC documents, emergency contact details, DOB, and identity numbers.
 * Full details are loaded on-demand via GET /api/v1/tenants/{id}.
 */
public class MinimalTenantDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String firstName;
    private String lastName;
    private String name;
    private String email;
    private String phone;
    private String mobile;
    private String gender;
    private String occupation;
    private String kycStatus;
    private UUID propertyId;
    private String roomNumber;
    private String bedNumber;
    private BigDecimal rent;
    private BigDecimal deposit;
    private String leaseStart;
    private String leaseEnd;
    private String status;
    private String dob;
    private String idType;
    private String idNumber;
    private String emergencyContactName;
    private String emergencyName;
    private String emergencyContactMobile;
    private String emergencyContact;
    private Boolean isAgreementAccepted;
    private String agreementAcceptedAt;
    private Integer noticePeriodDays;
    private String lastNoticeReminderSentAt;
    private String noticeStatus;
    private Long daysUntilLeaseExpiry;
    private Boolean isUnderNoticeWindow;
    private String billingResponsibility;
    private String corporateCompanyName;
    private String corporateGstin;
    private String utilityResponsibility;
    private String depositResponsibility;

    public MinimalTenantDTO() {
    }

    public static MinimalTenantDTO fromEntity(Tenant t) {
        if (t == null) return null;
        MinimalTenantDTO dto = new MinimalTenantDTO();
        dto.setId(t.getId());
        dto.setFirstName(t.getFirstName());
        dto.setLastName(t.getLastName());
        dto.setName((t.getFirstName() != null ? t.getFirstName() : "") + (t.getLastName() != null ? " " + t.getLastName() : "").trim());
        dto.setEmail(t.getEmail());
        dto.setPhone(t.getMobile());
        dto.setMobile(t.getMobile());
        dto.setGender(t.getGender());
        dto.setOccupation(t.getOccupation());
        dto.setKycStatus(t.getKycStatus());
        dto.setPropertyId(t.getPropertyId());
        dto.setRoomNumber(t.getRoomNumber());
        dto.setBedNumber(t.getBedNumber());
        dto.setRent(t.getRent());
        dto.setDeposit(t.getDeposit());
        dto.setLeaseStart(t.getLeaseStart());
        dto.setLeaseEnd(t.getLeaseEnd());
        dto.setStatus(t.getStatus());
        dto.setDob(t.getDob());
        dto.setIdType(t.getIdType());
        dto.setIdNumber(t.getIdNumber());
        dto.setEmergencyContactName(t.getEmergencyContactName());
        dto.setEmergencyName(t.getEmergencyContactName());
        dto.setEmergencyContactMobile(t.getEmergencyContactMobile());
        dto.setEmergencyContact(t.getEmergencyContactMobile());
        dto.setIsAgreementAccepted(t.getIsAgreementAccepted());
        dto.setAgreementAcceptedAt(t.getAgreementAcceptedAt() != null ? t.getAgreementAcceptedAt().toString() : null);
        dto.setBillingResponsibility(t.getBillingResponsibility());
        dto.setCorporateCompanyName(t.getCorporateCompanyName());
        dto.setCorporateGstin(t.getCorporateGstin());
        dto.setUtilityResponsibility(t.getUtilityResponsibility());
        dto.setDepositResponsibility(t.getDepositResponsibility());

        // Notice period calculations
        int noticeDays = t.getNoticePeriodDays() != null && t.getNoticePeriodDays() > 0 ? t.getNoticePeriodDays() : 30;
        dto.setNoticePeriodDays(noticeDays);
        dto.setLastNoticeReminderSentAt(t.getLastNoticeReminderSentAt() != null ? t.getLastNoticeReminderSentAt().toString() : null);
        dto.setNoticeStatus(t.getNoticeStatus());

        if (t.getLeaseEnd() != null && !t.getLeaseEnd().isBlank()) {
            try {
                java.time.LocalDate end = java.time.LocalDate.parse(t.getLeaseEnd().trim());
                long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), end);
                dto.setDaysUntilLeaseExpiry(daysLeft);
                dto.setIsUnderNoticeWindow(daysLeft >= 0 && daysLeft <= noticeDays && "ACTIVE".equalsIgnoreCase(t.getStatus()));
            } catch (Exception ignored) {
                dto.setIsUnderNoticeWindow(false);
            }
        } else {
            dto.setIsUnderNoticeWindow(false);
        }

        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getOccupation() { return occupation; }
    public void setOccupation(String occupation) { this.occupation = occupation; }

    public String getKycStatus() { return kycStatus; }
    public void setKycStatus(String kycStatus) { this.kycStatus = kycStatus; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public BigDecimal getRent() { return rent; }
    public void setRent(BigDecimal rent) { this.rent = rent; }

    public String getLeaseEnd() { return leaseEnd; }
    public void setLeaseEnd(String leaseEnd) { this.leaseEnd = leaseEnd; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getDeposit() { return deposit; }
    public void setDeposit(BigDecimal deposit) { this.deposit = deposit; }

    public String getLeaseStart() { return leaseStart; }
    public void setLeaseStart(String leaseStart) { this.leaseStart = leaseStart; }

    public String getDob() { return dob; }
    public void setDob(String dob) { this.dob = dob; }

    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }

    public String getIdNumber() { return idNumber; }
    public void setIdNumber(String idNumber) { this.idNumber = idNumber; }

    public String getEmergencyContactName() { return emergencyContactName; }
    public void setEmergencyContactName(String emergencyContactName) { this.emergencyContactName = emergencyContactName; }

    public String getEmergencyName() { return emergencyName; }
    public void setEmergencyName(String emergencyName) { this.emergencyName = emergencyName; }

    public String getEmergencyContactMobile() { return emergencyContactMobile; }
    public void setEmergencyContactMobile(String emergencyContactMobile) { this.emergencyContactMobile = emergencyContactMobile; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }

    public Boolean getIsAgreementAccepted() { return isAgreementAccepted; }
    public void setIsAgreementAccepted(Boolean isAgreementAccepted) { this.isAgreementAccepted = isAgreementAccepted; }

    public String getAgreementAcceptedAt() { return agreementAcceptedAt; }
    public void setAgreementAcceptedAt(String agreementAcceptedAt) { this.agreementAcceptedAt = agreementAcceptedAt; }

    public Integer getNoticePeriodDays() { return noticePeriodDays; }
    public void setNoticePeriodDays(Integer noticePeriodDays) { this.noticePeriodDays = noticePeriodDays; }

    public String getLastNoticeReminderSentAt() { return lastNoticeReminderSentAt; }
    public void setLastNoticeReminderSentAt(String lastNoticeReminderSentAt) { this.lastNoticeReminderSentAt = lastNoticeReminderSentAt; }

    public String getNoticeStatus() { return noticeStatus; }
    public void setNoticeStatus(String noticeStatus) { this.noticeStatus = noticeStatus; }

    public Long getDaysUntilLeaseExpiry() { return daysUntilLeaseExpiry; }
    public void setDaysUntilLeaseExpiry(Long daysUntilLeaseExpiry) { this.daysUntilLeaseExpiry = daysUntilLeaseExpiry; }

    public Boolean getIsUnderNoticeWindow() { return isUnderNoticeWindow; }
    public void setIsUnderNoticeWindow(Boolean isUnderNoticeWindow) { this.isUnderNoticeWindow = isUnderNoticeWindow; }

    public String getBillingResponsibility() { return billingResponsibility; }
    public void setBillingResponsibility(String billingResponsibility) { this.billingResponsibility = billingResponsibility; }

    public String getCorporateCompanyName() { return corporateCompanyName; }
    public void setCorporateCompanyName(String corporateCompanyName) { this.corporateCompanyName = corporateCompanyName; }

    public String getCorporateGstin() { return corporateGstin; }
    public void setCorporateGstin(String corporateGstin) { this.corporateGstin = corporateGstin; }

    public String getUtilityResponsibility() { return utilityResponsibility; }
    public void setUtilityResponsibility(String utilityResponsibility) { this.utilityResponsibility = utilityResponsibility; }

    public String getDepositResponsibility() { return depositResponsibility; }
    public void setDepositResponsibility(String depositResponsibility) { this.depositResponsibility = depositResponsibility; }
}
