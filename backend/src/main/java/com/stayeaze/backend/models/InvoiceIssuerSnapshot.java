package com.stayeaze.backend.models;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Immutable copy of the issuer details shown on an invoice at the time it is created. */
@Embeddable
public class InvoiceIssuerSnapshot {
    @Column(name = "issuer_legal_name", length = 200) private String legalName;
    @Column(name = "issuer_address", columnDefinition = "text") private String billingAddress;
    @Column(name = "issuer_city", length = 100) private String city;
    @Column(name = "issuer_state", length = 100) private String state;
    @Column(name = "issuer_pincode", length = 20) private String pincode;
    @Column(name = "issuer_email", length = 150) private String supportEmail;
    @Column(name = "issuer_phone", length = 30) private String supportPhone;
    @Column(name = "issuer_gstin", length = 20) private String gstin;
    @Column(name = "issuer_pan", length = 20) private String pan;
    @Column(name = "issuer_registration_number", length = 100) private String registrationNumber;
    @Column(name = "issuer_bank_account_name", length = 150) private String bankAccountName;
    @Column(name = "issuer_bank_name", length = 150) private String bankName;
    @Column(name = "issuer_bank_account_number", length = 50) private String bankAccountNumber;
    @Column(name = "issuer_bank_ifsc", length = 20) private String bankIfsc;
    @Column(name = "issuer_upi_vpa", length = 100) private String upiVpa;
    @Column(name = "issuer_signatory", length = 150) private String authorizedSignatory;
    @Column(name = "issuer_terms", columnDefinition = "text") private String invoiceTerms;
    @Column(name = "issuer_late_fee_note", columnDefinition = "text") private String lateFeeNote;

    public InvoiceIssuerSnapshot() { }
    public InvoiceIssuerSnapshot(OrganizationBillingProfile profile) {
        legalName = profile.getLegalName(); billingAddress = profile.getBillingAddress(); city = profile.getCity(); state = profile.getState(); pincode = profile.getPincode();
        supportEmail = profile.getSupportEmail(); supportPhone = profile.getSupportPhone(); gstin = profile.getGstin(); pan = profile.getPan(); registrationNumber = profile.getRegistrationNumber();
        bankAccountName = profile.getBankAccountName(); bankName = profile.getBankName(); bankAccountNumber = profile.getBankAccountNumber(); bankIfsc = profile.getBankIfsc(); upiVpa = profile.getUpiVpa();
        authorizedSignatory = profile.getAuthorizedSignatory(); invoiceTerms = profile.getInvoiceTerms(); lateFeeNote = profile.getLateFeeNote();
    }
    public String getLegalName() { return legalName; }
    public String getBillingAddress() { return billingAddress; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getPincode() { return pincode; }
    public String getSupportEmail() { return supportEmail; }
    public String getSupportPhone() { return supportPhone; }
    public String getGstin() { return gstin; }
    public String getPan() { return pan; }
    public String getRegistrationNumber() { return registrationNumber; }
    public String getBankAccountName() { return bankAccountName; }
    public String getBankName() { return bankName; }
    public String getBankAccountNumber() { return bankAccountNumber; }
    public String getBankIfsc() { return bankIfsc; }
    public String getUpiVpa() { return upiVpa; }
    public String getAuthorizedSignatory() { return authorizedSignatory; }
    public String getInvoiceTerms() { return invoiceTerms; }
    public String getLateFeeNote() { return lateFeeNote; }
}
