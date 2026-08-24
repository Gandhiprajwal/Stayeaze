package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.stayeaze.backend.security.validation.ValidEmail;
import com.stayeaze.backend.security.validation.ValidGstin;
import com.stayeaze.backend.security.validation.ValidMobile;
import com.stayeaze.backend.security.validation.ValidPan;
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
    
    @ValidEmail
    @Column(name = "support_email", length = 150)
    private String supportEmail;

    @ValidMobile
    @Column(name = "support_phone", length = 30)
    private String supportPhone;

    @ValidGstin
    @Column(length = 20)
    private String gstin;

    @ValidPan
    @Column(length = 20)
    private String pan;
    @Column(name = "registration_number", length = 100)
    private String registrationNumber;
    @Column(name = "invoice_prefix", nullable = false, length = 30)
    private String invoicePrefix = "INV";
    @Column(name = "payment_due_days", nullable = false)
    private Integer paymentDueDays = 7;
    @Column(name = "default_security_deposit")
    private java.math.BigDecimal defaultSecurityDeposit = java.math.BigDecimal.ZERO;
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

    @Column(name = "subscription_plan_name", length = 100)
    private String subscriptionPlanName = "Starter PG Plan";

    @Column(name = "subscription_plan_price")
    private java.math.BigDecimal subscriptionPlanPrice = new java.math.BigDecimal("1499");

    @Column(name = "subscription_billing_cycle", length = 30)
    private String subscriptionBillingCycle = "MONTHLY";

    @Column(name = "subscription_start_date")
    private OffsetDateTime subscriptionStartDate = OffsetDateTime.now();

    @Column(name = "subscription_end_date")
    private OffsetDateTime subscriptionEndDate = OffsetDateTime.now().plusDays(30);

    @Column(name = "subscription_status", length = 30)
    private String subscriptionStatus = "ACTIVE";

    @Column(name = "subscription_payment_id", length = 150)
    private String subscriptionPaymentId;

    @Column(name = "subscription_order_id", length = 150)
    private String subscriptionOrderId;

    // --- End-to-End Refund Lifecycle Fields ---
    @Column(name = "refund_id", length = 100)
    private String refundId;

    @Column(name = "refund_status", length = 50)
    private String refundStatus;

    @Column(name = "refund_amount")
    private java.math.BigDecimal refundAmount;

    @Column(name = "refund_arn", length = 100)
    private String refundArn;

    @Column(name = "refund_speed", length = 50)
    private String refundSpeed;

    @Column(name = "refund_error_code", length = 100)
    private String refundErrorCode;

    @Column(name = "refund_error_description", columnDefinition = "text")
    private String refundErrorDescription;

    @Column(name = "refund_created_at")
    private OffsetDateTime refundCreatedAt;

    @Column(name = "refund_settled_at")
    private OffsetDateTime refundSettledAt;

    // --- Enterprise White-Label & Custom Branding ---
    @Column(name = "custom_branding_enabled")
    private Boolean customBrandingEnabled = false;

    @Column(name = "brand_name", length = 150)
    private String brandName;

    @Column(name = "brand_logo_url", length = 500)
    private String brandLogoUrl;

    @Column(name = "brand_favicon_url", length = 500)
    private String brandFaviconUrl;

    @Column(name = "brand_primary_color", length = 30)
    private String brandPrimaryColor = "#4f46e5";

    @Column(name = "brand_accent_color", length = 30)
    private String brandAccentColor = "#06b6d4";

    @Column(name = "brand_tagline", length = 255)
    private String brandTagline;

    @Column(name = "custom_footer_text", length = 300)
    private String customFooterText;

    @Column(name = "hide_stayeaze_branding")
    private Boolean hideStayEazeBranding = false;

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
    public java.math.BigDecimal getDefaultSecurityDeposit() { return defaultSecurityDeposit != null ? defaultSecurityDeposit : java.math.BigDecimal.ZERO; }
    public void setDefaultSecurityDeposit(java.math.BigDecimal defaultSecurityDeposit) { this.defaultSecurityDeposit = defaultSecurityDeposit; }
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
        return getMissingFields().isEmpty();
    }

    @com.fasterxml.jackson.annotation.JsonProperty("missingFields")
    public java.util.List<String> getMissingFields() {
        java.util.List<String> missing = new java.util.ArrayList<>();
        if (legalName == null || legalName.isBlank()) {
            missing.add("Legal Business Name");
        }
        if (billingAddress == null || billingAddress.isBlank() || city == null || city.isBlank() || state == null || state.isBlank() || pincode == null || pincode.isBlank()) {
            missing.add("Business Address & City/State/Pincode");
        }
        if (supportEmail == null || supportEmail.isBlank()) {
            missing.add("Support Email");
        }
        if (supportPhone == null || supportPhone.isBlank()) {
            missing.add("Support Phone");
        }
        if (pan == null || pan.isBlank()) {
            missing.add("PAN / Tax Identification");
        }
        if (defaultSecurityDeposit == null || defaultSecurityDeposit.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            missing.add("Default Security Deposit");
        }
        boolean hasBank = bankAccountNumber != null && !bankAccountNumber.isBlank() && bankIfsc != null && !bankIfsc.isBlank();
        boolean hasUpi = upiVpa != null && !upiVpa.isBlank();
        if (!hasBank && !hasUpi) {
            missing.add("Payout & Settlement (Bank Account or UPI ID)");
        }
        if (authorizedSignatory == null || authorizedSignatory.isBlank()) {
            missing.add("Authorized Signatory");
        }
        return missing;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("completionPercentage")
    public int getCompletionPercentage() {
        int total = 8;
        int missingCount = getMissingFields().size();
        int completed = total - missingCount;
        return (int) Math.round(((double) completed / total) * 100.0);
    }
    public String getInvoiceTerms() { return invoiceTerms; }
    public void setInvoiceTerms(String invoiceTerms) { this.invoiceTerms = invoiceTerms; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getSubscriptionPlanName() { return subscriptionPlanName; }
    public void setSubscriptionPlanName(String subscriptionPlanName) { this.subscriptionPlanName = subscriptionPlanName; }

    public java.math.BigDecimal getSubscriptionPlanPrice() { return subscriptionPlanPrice; }
    public void setSubscriptionPlanPrice(java.math.BigDecimal subscriptionPlanPrice) { this.subscriptionPlanPrice = subscriptionPlanPrice; }

    public String getSubscriptionBillingCycle() { return subscriptionBillingCycle; }
    public void setSubscriptionBillingCycle(String subscriptionBillingCycle) { this.subscriptionBillingCycle = subscriptionBillingCycle; }

    public OffsetDateTime getSubscriptionStartDate() { return subscriptionStartDate; }
    public void setSubscriptionStartDate(OffsetDateTime subscriptionStartDate) { this.subscriptionStartDate = subscriptionStartDate; }

    public OffsetDateTime getSubscriptionEndDate() { return subscriptionEndDate; }
    public void setSubscriptionEndDate(OffsetDateTime subscriptionEndDate) { this.subscriptionEndDate = subscriptionEndDate; }

    public String getSubscriptionStatus() { return subscriptionStatus; }
    public void setSubscriptionStatus(String subscriptionStatus) { this.subscriptionStatus = subscriptionStatus; }

    public String getSubscriptionPaymentId() { return subscriptionPaymentId; }
    public void setSubscriptionPaymentId(String subscriptionPaymentId) { this.subscriptionPaymentId = subscriptionPaymentId; }

    public String getSubscriptionOrderId() { return subscriptionOrderId; }
    public void setSubscriptionOrderId(String subscriptionOrderId) { this.subscriptionOrderId = subscriptionOrderId; }

    public Boolean getCustomBrandingEnabled() { return customBrandingEnabled != null && customBrandingEnabled; }
    public void setCustomBrandingEnabled(Boolean customBrandingEnabled) { this.customBrandingEnabled = customBrandingEnabled; }

    public String getBrandName() { return brandName; }
    public void setBrandName(String brandName) { this.brandName = brandName; }

    public String getBrandLogoUrl() { return brandLogoUrl; }
    public void setBrandLogoUrl(String brandLogoUrl) { this.brandLogoUrl = brandLogoUrl; }

    public String getBrandFaviconUrl() { return brandFaviconUrl; }
    public void setBrandFaviconUrl(String brandFaviconUrl) { this.brandFaviconUrl = brandFaviconUrl; }

    public String getBrandPrimaryColor() { return brandPrimaryColor != null && !brandPrimaryColor.isBlank() ? brandPrimaryColor : "#4f46e5"; }
    public void setBrandPrimaryColor(String brandPrimaryColor) { this.brandPrimaryColor = brandPrimaryColor; }

    public String getBrandAccentColor() { return brandAccentColor != null && !brandAccentColor.isBlank() ? brandAccentColor : "#06b6d4"; }
    public void setBrandAccentColor(String brandAccentColor) { this.brandAccentColor = brandAccentColor; }

    public String getBrandTagline() { return brandTagline; }
    public void setBrandTagline(String brandTagline) { this.brandTagline = brandTagline; }

    public String getCustomFooterText() { return customFooterText; }
    public void setCustomFooterText(String customFooterText) { this.customFooterText = customFooterText; }

    public String getRefundId() { return refundId; }
    public void setRefundId(String refundId) { this.refundId = refundId; }

    public String getRefundStatus() { return refundStatus; }
    public void setRefundStatus(String refundStatus) { this.refundStatus = refundStatus; }

    public java.math.BigDecimal getRefundAmount() { return refundAmount; }
    public void setRefundAmount(java.math.BigDecimal refundAmount) { this.refundAmount = refundAmount; }

    public String getRefundArn() { return refundArn; }
    public void setRefundArn(String refundArn) { this.refundArn = refundArn; }

    public String getRefundSpeed() { return refundSpeed; }
    public void setRefundSpeed(String refundSpeed) { this.refundSpeed = refundSpeed; }

    public String getRefundErrorCode() { return refundErrorCode; }
    public void setRefundErrorCode(String refundErrorCode) { this.refundErrorCode = refundErrorCode; }

    public String getRefundErrorDescription() { return refundErrorDescription; }
    public void setRefundErrorDescription(String refundErrorDescription) { this.refundErrorDescription = refundErrorDescription; }

    public OffsetDateTime getRefundCreatedAt() { return refundCreatedAt; }
    public void setRefundCreatedAt(OffsetDateTime refundCreatedAt) { this.refundCreatedAt = refundCreatedAt; }

    public OffsetDateTime getRefundSettledAt() { return refundSettledAt; }
    public void setRefundSettledAt(OffsetDateTime refundSettledAt) { this.refundSettledAt = refundSettledAt; }

    public Boolean getHideStayEazeBranding() { return hideStayEazeBranding != null && hideStayEazeBranding; }
    public void setHideStayEazeBranding(Boolean hideStayEazeBranding) { this.hideStayEazeBranding = hideStayEazeBranding; }
}
