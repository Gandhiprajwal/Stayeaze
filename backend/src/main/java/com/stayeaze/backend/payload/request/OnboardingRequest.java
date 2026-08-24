package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class OnboardingRequest {

    // Owner Account Credentials
    @NotBlank
    @Size(max = 100)
    private String ownerName;

    @NotBlank
    @Size(max = 100)
    @Email
    private String ownerEmail;

    @NotBlank
    @Size(max = 100)
    private String ownerPhone;

    @NotBlank
    @Size(min = 6, max = 120)
    private String ownerPassword;

    @NotBlank
    @Size(max = 100)
    private String orgName;

    @NotBlank
    @Size(max = 50)
    private String orgSubdomain;

    // Compulsory Property Master Details
    @NotBlank
    @Size(max = 150)
    private String propertyName;

    @NotBlank
    @Size(max = 50)
    private String propertyCode;

    private String propertyType = "PG";

    @NotBlank
    private String address;

    @NotBlank
    @Size(max = 100)
    private String city;

    @NotBlank
    @Size(max = 100)
    private String state;

    @NotBlank
    @Size(max = 20)
    private String pincode;

    private String manager;
    private String phone;
    private String email;
    private String landlordPan;
    private String pgLicenseNo;
    private String bankAccountName;
    private String bankName;
    private String bankAccountNumber;
    private String bankIfsc;
    private String upiVpa;
    private String authorizedSignatory;
    private String gstin;

    // SaaS Subscription Details
    private String planId = "starter";
    private String planName = "Starter PG Plan";
    private java.math.BigDecimal planPrice = new java.math.BigDecimal("1499");
    private String billingCycle = "MONTHLY";
    private boolean isTrial = false;
    private boolean seedSampleData = true;

    // Payment verification
    private String razorpayPaymentId;
    private String razorpayOrderId;
    private String razorpaySignature;

    public OnboardingRequest() {}

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    public String getOwnerPhone() { return ownerPhone; }
    public void setOwnerPhone(String ownerPhone) { this.ownerPhone = ownerPhone; }

    public String getOwnerPassword() { return ownerPassword; }
    public void setOwnerPassword(String ownerPassword) { this.ownerPassword = ownerPassword; }

    public String getOrgName() { return orgName; }
    public void setOrgName(String orgName) { this.orgName = orgName; }

    public String getOrgSubdomain() { return orgSubdomain; }
    public void setOrgSubdomain(String orgSubdomain) { this.orgSubdomain = orgSubdomain; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getPropertyCode() { return propertyCode; }
    public void setPropertyCode(String propertyCode) { this.propertyCode = propertyCode; }

    public String getPropertyType() { return propertyType; }
    public void setPropertyType(String propertyType) { this.propertyType = propertyType; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public String getManager() { return manager; }
    public void setManager(String manager) { this.manager = manager; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getLandlordPan() { return landlordPan; }
    public void setLandlordPan(String landlordPan) { this.landlordPan = landlordPan; }

    public String getPgLicenseNo() { return pgLicenseNo; }
    public void setPgLicenseNo(String pgLicenseNo) { this.pgLicenseNo = pgLicenseNo; }

    public String getBankAccountName() { return bankAccountName; }
    public void setBankAccountName(String bankAccountName) { this.bankAccountName = bankAccountName; }

    public String getBankName() { return bankName; }
    public void setBankName(String bankName) { this.bankName = bankName; }

    public String getBankAccountNumber() { return bankAccountNumber; }
    public void setBankAccountNumber(String bankAccountNumber) { this.bankAccountNumber = bankAccountNumber; }

    public String getBankIfsc() { return bankIfsc; }
    public void setBankIfsc(String bankIfsc) { this.bankIfsc = bankIfsc; }

    public String getUpiVpa() { return upiVpa; }
    public void setUpiVpa(String upiVpa) { this.upiVpa = upiVpa; }

    public String getAuthorizedSignatory() { return authorizedSignatory; }
    public void setAuthorizedSignatory(String authorizedSignatory) { this.authorizedSignatory = authorizedSignatory; }

    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }

    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public java.math.BigDecimal getPlanPrice() { return planPrice; }
    public void setPlanPrice(java.math.BigDecimal planPrice) { this.planPrice = planPrice; }

    public String getBillingCycle() { return billingCycle; }
    public void setBillingCycle(String billingCycle) { this.billingCycle = billingCycle; }

    public boolean isTrial() { return isTrial; }
    public void setTrial(boolean trial) { isTrial = trial; }

    public boolean isSeedSampleData() { return seedSampleData; }
    public void setSeedSampleData(boolean seedSampleData) { this.seedSampleData = seedSampleData; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public String getRazorpaySignature() { return razorpaySignature; }
    public void setRazorpaySignature(String razorpaySignature) { this.razorpaySignature = razorpaySignature; }
}
