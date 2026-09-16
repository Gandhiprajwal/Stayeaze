package com.stayeaze.backend.payload.request;

import com.stayeaze.backend.security.validation.ValidEmail;
import com.stayeaze.backend.security.validation.ValidMobile;
import java.math.BigDecimal;
import java.util.UUID;

public class TenantRequest {
    private String firstName;
    private String lastName;
    private String name;

    @ValidEmail
    private String email;

    @ValidMobile
    private String mobile;

    @ValidMobile
    private String phone; // alias from frontend

    private String gender;

    private String emergencyContactName;
    private String emergencyName; // alias from frontend

    @ValidMobile
    private String emergencyContactMobile;

    @ValidMobile
    private String emergencyContact; // alias from frontend

    private String dob;
    private String occupation;
    private String idType;
    private String idNumber;
    private BigDecimal rent;
    private BigDecimal deposit;
    private String leaseStart;
    private String leaseEnd;
    private UUID propertyId;
    private UUID buildingId;
    private UUID floorId;
    private UUID roomId;
    private UUID bedId;
    private String roomNumber;
    private String bedNumber;
    private String status;
    private String paymentMethod;
    private String razorpayPaymentId;
    private String razorpayOrderId;
    private String razorpaySignature;

    public TenantRequest() {
    }

    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }

    public UUID getFloorId() { return floorId; }
    public void setFloorId(UUID floorId) { this.floorId = floorId; }

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public UUID getBedId() { return bedId; }
    public void setBedId(UUID bedId) { this.bedId = bedId; }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
        if (name != null && !name.isBlank()) {
            String[] parts = name.trim().split("\\s+", 2);
            this.firstName = parts[0];
            this.lastName = parts.length > 1 ? parts[1] : parts[0];
        }
    }

    public String getFirstName() {
        if (firstName != null && !firstName.isBlank()) return firstName;
        if (name != null && !name.isBlank()) return name.trim().split("\\s+", 2)[0];
        return "Tenant";
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        if (lastName != null && !lastName.isBlank()) return lastName;
        if (name != null && !name.isBlank()) {
            String[] parts = name.trim().split("\\s+", 2);
            return parts.length > 1 ? parts[1] : parts[0];
        }
        return "User";
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
        return mobile != null ? mobile : phone;
    }

    public void setMobile(String mobile) {
        this.mobile = mobile;
    }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getEmergencyContactName() {
        return emergencyContactName != null ? emergencyContactName : emergencyName;
    }
    public void setEmergencyContactName(String n) { this.emergencyContactName = n; }
    public String getEmergencyName() { return emergencyName; }
    public void setEmergencyName(String n) { this.emergencyName = n; }

    public String getEmergencyContactMobile() {
        return emergencyContactMobile != null ? emergencyContactMobile : emergencyContact;
    }
    public void setEmergencyContactMobile(String m) { this.emergencyContactMobile = m; }
    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String m) { this.emergencyContact = m; }

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

    public void setDeposit(BigDecimal deposit) {
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public String getRazorpaySignature() { return razorpaySignature; }
    public void setRazorpaySignature(String razorpaySignature) { this.razorpaySignature = razorpaySignature; }

    private String refundAccountName;
    private String refundAccountNumber;
    private String refundIfsc;
    private String refundBankName;
    private String refundUpi;

    public String getRefundAccountName() { return refundAccountName; }
    public void setRefundAccountName(String refundAccountName) { this.refundAccountName = refundAccountName; }

    public String getRefundAccountNumber() { return refundAccountNumber; }
    public void setRefundAccountNumber(String refundAccountNumber) { this.refundAccountNumber = refundAccountNumber; }

    public String getRefundIfsc() { return refundIfsc; }
    public void setRefundIfsc(String refundIfsc) { this.refundIfsc = refundIfsc; }

    public String getRefundBankName() { return refundBankName; }
    public void setRefundBankName(String refundBankName) { this.refundBankName = refundBankName; }

    public String getRefundUpi() { return refundUpi; }
    public void setRefundUpi(String refundUpi) { this.refundUpi = refundUpi; }

    private String billingMode; // "PRO_RATA" vs "FULL_MONTH"

    public String getBillingMode() { return billingMode; }
    public void setBillingMode(String billingMode) { this.billingMode = billingMode; }

    private Integer lockInMonths;
    private Integer noticePeriodDays;

    private String billingResponsibility;
    private String corporateCompanyName;
    private String corporateGstin;
    private String utilityResponsibility;
    private String depositResponsibility;

    public Integer getLockInMonths() { return lockInMonths; }
    public void setLockInMonths(Integer lockInMonths) { this.lockInMonths = lockInMonths; }

    public Integer getNoticePeriodDays() { return noticePeriodDays; }
    public void setNoticePeriodDays(Integer noticePeriodDays) { this.noticePeriodDays = noticePeriodDays; }

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
