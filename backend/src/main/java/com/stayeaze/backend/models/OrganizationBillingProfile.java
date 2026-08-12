package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Billing identity and payment instructions owned by one organization. */
@Entity
@Table(name = "organization_billing_profiles")
public class OrganizationBillingProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id", nullable = false, unique = true)
    private Organization organization;

    @Column(name = "legal_name", length = 200)
    private String legalName;
    @Column(name = "billing_address", columnDefinition = "text")
    private String billingAddress;
    @Column(length = 100)
    private String city;
    @Column(length = 100)
    private String state;
    @Column(length = 20)
    private String pincode;
    @Column(name = "support_email", length = 150)
    private String supportEmail;
    @Column(name = "support_phone", length = 30)
    private String supportPhone;
    @Column(length = 20)
    private String gstin;
    @Column(length = 20)
    private String pan;
    @Column(name = "registration_number", length = 100)
    private String registrationNumber;
    @Column(name = "invoice_prefix", nullable = false, length = 30)
    private String invoicePrefix = "INV";
    @Column(name = "payment_due_days", nullable = false)
    private Integer paymentDueDays = 7;
    @Column(name = "late_fee_note", columnDefinition = "text")
    private String lateFeeNote = "Late-payment charges, if applicable, will be charged as per the property policy and tenancy agreement.";
    @Column(name = "bank_account_name", length = 150)
    private String bankAccountName;
    @Column(name = "bank_name", length = 150)
    private String bankName;
    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;
    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc;
    @Column(name = "upi_vpa", length = 100)
    private String upiVpa;
    @Column(name = "authorized_signatory", length = 150)
    private String authorizedSignatory;
    @Column(name = "razorpay_key_id", length = 150)
    private String razorpayKeyId;

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    @Column(name = "razorpay_key_secret", length = 150)
    private String razorpayKeySecret;
    @Column(name = "invoice_terms", columnDefinition = "text")
    private String invoiceTerms = "Rent is payable on or before the due date of each month.\nThis receipt is issued for room accommodation services.\nValid official receipt for tenant records and HRA tax submission.\nComputer-generated verified receipt with security QR verification code.";
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public OrganizationBillingProfile() { }
    public OrganizationBillingProfile(Organization organization) {
        this.organization = organization;
        this.legalName = organization.getName();
    }
    public UUID getId() { return id; }
    @JsonIgnore
    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }
    public String getLegalName() { return legalName; }
    public void setLegalName(String legalName) { this.legalName = legalName; }
    public String getBillingAddress() { return billingAddress; }
    public void setBillingAddress(String billingAddress) { this.billingAddress = billingAddress; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }
    public String getSupportEmail() { return supportEmail; }
    public void setSupportEmail(String supportEmail) { this.supportEmail = supportEmail; }
    public String getSupportPhone() { return supportPhone; }
    public void setSupportPhone(String supportPhone) { this.supportPhone = supportPhone; }
    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }
    public String getPan() { return pan; }
    public void setPan(String pan) { this.pan = pan; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public String getInvoicePrefix() { return invoicePrefix; }
    public void setInvoicePrefix(String invoicePrefix) { this.invoicePrefix = invoicePrefix; }
    public Integer getPaymentDueDays() { return paymentDueDays; }
    public void setPaymentDueDays(Integer paymentDueDays) { this.paymentDueDays = paymentDueDays; }
    public String getLateFeeNote() { return lateFeeNote; }
    public void setLateFeeNote(String lateFeeNote) { this.lateFeeNote = lateFeeNote; }
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
    public String getRazorpayKeyId() { return razorpayKeyId; }
    public void setRazorpayKeyId(String razorpayKeyId) { this.razorpayKeyId = razorpayKeyId; }
    public String getRazorpayKeySecret() { return razorpayKeySecret; }
    public void setRazorpayKeySecret(String razorpayKeySecret) { this.razorpayKeySecret = razorpayKeySecret; }
    @com.fasterxml.jackson.annotation.JsonProperty("hasRazorpaySecret")
    public boolean hasRazorpaySecret() { return razorpayKeySecret != null && !razorpayKeySecret.isBlank(); }
    @com.fasterxml.jackson.annotation.JsonProperty("hasRazorpayConfigured")
    public boolean hasRazorpayConfigured() {
        return razorpayKeyId != null && !razorpayKeyId.isBlank() &&
               razorpayKeySecret != null && !razorpayKeySecret.isBlank();
    }
    @com.fasterxml.jackson.annotation.JsonProperty("isSetupComplete")
    public boolean isSetupComplete() {
        return legalName != null && !legalName.isBlank() &&
               billingAddress != null && !billingAddress.isBlank() &&
               city != null && !city.isBlank() &&
               state != null && !state.isBlank() &&
               pincode != null && !pincode.isBlank() &&
               ((supportEmail != null && !supportEmail.isBlank()) || (supportPhone != null && !supportPhone.isBlank()));
    }
    public String getInvoiceTerms() { return invoiceTerms; }
    public void setInvoiceTerms(String invoiceTerms) { this.invoiceTerms = invoiceTerms; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
