package com.stayeaze.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "system_integration_settings")
@Cacheable
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class SystemIntegrationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    // Redis Configuration
    @Column(name = "redis_enabled")
    private Boolean redisEnabled = false;

    @Column(name = "redis_host", length = 200)
    private String redisHost = "localhost";

    @Column(name = "redis_port")
    private Integer redisPort = 6379;

    @Column(name = "redis_password", length = 200)
    private String redisPassword;

    // AWS S3 Configuration
    @Column(name = "aws_s3_enabled")
    private Boolean awsS3Enabled = false;

    @Column(name = "aws_access_key", length = 200)
    private String awsAccessKey;

    @Column(name = "aws_secret_key", length = 200)
    private String awsSecretKey;

    @Column(name = "aws_region", length = 100)
    private String awsRegion = "ap-south-1";

    @Column(name = "aws_bucket_name", length = 150)
    private String awsBucketName = "stayeaze-media-storage";

    // Rate Limiting & Security
    @Column(name = "rate_limiting_enabled")
    private Boolean rateLimitingEnabled = true;

    @Column(name = "max_requests_per_sec")
    private Integer maxRequestsPerSec = 50;

    @Column(name = "auth_brute_force_limit_per_min")
    private Integer authBruteForceLimitPerMin = 5;

    // Razorpay Master Keys Override
    @Column(name = "razorpay_master_key_id", length = 150)
    private String razorpayMasterKeyId;

    @Column(name = "razorpay_master_key_secret", length = 150)
    private String razorpayMasterKeySecret;

    // SaaS Subscription Invoicing & Legal Branding
    @Column(name = "saas_company_name", length = 200)
    private String saasCompanyName = "StayEaze SaaS Technologies Pvt. Ltd.";

    @Column(name = "saas_gstin", length = 50)
    private String saasGstin = "29AAAAA0000A1Z5";

    @Column(name = "saas_pan", length = 50)
    private String saasPan = "ABCDE1234F";

    @Column(name = "saas_sac_code", length = 50)
    private String saasSacCode = "998314";

    @Column(name = "saas_address", length = 500)
    private String saasAddress = "100 SaaS Tech Park, Indiranagar, Bengaluru, KA 560038";

    @Column(name = "saas_support_email", length = 150)
    private String saasSupportEmail = "billing@stayeaze.com";

    @Column(name = "saas_support_phone", length = 50)
    private String saasSupportPhone = "+91 98765 43210";

    @Column(name = "saas_website_url", length = 200)
    private String saasWebsiteUrl = "https://stayeaze.com";

    @Column(name = "invoice_prefix", length = 50)
    private String invoicePrefix = "SE-INV-";

    @Column(name = "default_tax_rate")
    private Double defaultTaxRate = 18.0;

    @Column(name = "currency", length = 20)
    private String currency = "INR";

    @Column(name = "invoice_terms", length = 1500)
    private String invoiceTerms = "1. Payment is due within 7 days of invoice date. 2. All fees are subject to 18% GST (SAC Code: 998314). 3. A 3-day grace period is allowed post-due date before workspace feature lockout. 4. Subscriptions are auto-renewed unless cancelled prior to the billing cycle. 5. Computer-generated tax invoice issued by StayEaze SaaS Technologies Pvt. Ltd.";

    @Column(name = "grace_period_days")
    private Integer gracePeriodDays = 3;

    @Column(name = "lockout_action", length = 50)
    private String lockoutAction = "HARD_LOCKOUT";

    @Column(name = "auto_pdf_emailing")
    private Boolean autoPdfEmailing = true;

    @Column(name = "maintenance_mode_enabled")
    private Boolean maintenanceModeEnabled = false;

    @Column(name = "maintenance_message", length = 500)
    private String maintenanceMessage = "StayEaze is undergoing scheduled maintenance. We will be back shortly.";

    @Column(name = "onboarding_mode", length = 50)
    private String onboardingMode = "ENABLED"; // ENABLED, WAITLIST, DISABLED

    @Column(name = "vip_invite_codes", length = 500)
    private String vipInviteCodes = "STAYVIP,EARLYBIRD,STAYEAZE2026";

    @Column(name = "onboarding_headline", length = 200)
    private String onboardingHeadline = "Automate Your PG & Co-Living Operations";

    @Column(name = "onboarding_message", length = 1000)
    private String onboardingMessage = "Join India's premier multi-property management platform.";

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public SystemIntegrationSettings() {}

    public String getOnboardingMode() { return onboardingMode != null ? onboardingMode : "ENABLED"; }
    public void setOnboardingMode(String onboardingMode) { this.onboardingMode = onboardingMode; }

    public String getVipInviteCodes() { return vipInviteCodes != null ? vipInviteCodes : ""; }
    public void setVipInviteCodes(String vipInviteCodes) { this.vipInviteCodes = vipInviteCodes; }

    public String getOnboardingHeadline() { return onboardingHeadline; }
    public void setOnboardingHeadline(String onboardingHeadline) { this.onboardingHeadline = onboardingHeadline; }

    public String getOnboardingMessage() { return onboardingMessage; }
    public void setOnboardingMessage(String onboardingMessage) { this.onboardingMessage = onboardingMessage; }

    public UUID getId() { return id; }

    public String getSaasCompanyName() { return saasCompanyName; }
    public void setSaasCompanyName(String saasCompanyName) { this.saasCompanyName = saasCompanyName; }

    public String getSaasGstin() { return saasGstin; }
    public void setSaasGstin(String saasGstin) { this.saasGstin = saasGstin; }

    public String getSaasPan() { return saasPan; }
    public void setSaasPan(String saasPan) { this.saasPan = saasPan; }

    public String getSaasSacCode() { return saasSacCode; }
    public void setSaasSacCode(String saasSacCode) { this.saasSacCode = saasSacCode; }

    public String getSaasAddress() { return saasAddress; }
    public void setSaasAddress(String saasAddress) { this.saasAddress = saasAddress; }

    public String getSaasSupportEmail() { return saasSupportEmail; }
    public void setSaasSupportEmail(String saasSupportEmail) { this.saasSupportEmail = saasSupportEmail; }

    public String getSaasSupportPhone() { return saasSupportPhone; }
    public void setSaasSupportPhone(String saasSupportPhone) { this.saasSupportPhone = saasSupportPhone; }

    public String getSaasWebsiteUrl() { return saasWebsiteUrl; }
    public void setSaasWebsiteUrl(String saasWebsiteUrl) { this.saasWebsiteUrl = saasWebsiteUrl; }

    public String getInvoicePrefix() { return invoicePrefix; }
    public void setInvoicePrefix(String invoicePrefix) { this.invoicePrefix = invoicePrefix; }

    public Double getDefaultTaxRate() { return defaultTaxRate; }
    public void setDefaultTaxRate(Double defaultTaxRate) { this.defaultTaxRate = defaultTaxRate; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getInvoiceTerms() { return invoiceTerms; }
    public void setInvoiceTerms(String invoiceTerms) { this.invoiceTerms = invoiceTerms; }

    public Integer getGracePeriodDays() { return gracePeriodDays; }
    public void setGracePeriodDays(Integer gracePeriodDays) { this.gracePeriodDays = gracePeriodDays; }

    public String getLockoutAction() { return lockoutAction; }
    public void setLockoutAction(String lockoutAction) { this.lockoutAction = lockoutAction; }

    public Boolean getAutoPdfEmailing() { return autoPdfEmailing; }
    public void setAutoPdfEmailing(Boolean autoPdfEmailing) { this.autoPdfEmailing = autoPdfEmailing; }

    public Boolean getMaintenanceModeEnabled() { return maintenanceModeEnabled; }
    public void setMaintenanceModeEnabled(Boolean maintenanceModeEnabled) { this.maintenanceModeEnabled = maintenanceModeEnabled; }

    public String getMaintenanceMessage() { return maintenanceMessage; }
    public void setMaintenanceMessage(String maintenanceMessage) { this.maintenanceMessage = maintenanceMessage; }
    public Boolean getRedisEnabled() { return redisEnabled != null ? redisEnabled : false; }
    public void setRedisEnabled(Boolean redisEnabled) { this.redisEnabled = redisEnabled; }

    public String getRedisHost() { return redisHost; }
    public void setRedisHost(String redisHost) { this.redisHost = redisHost; }

    public Integer getRedisPort() { return redisPort != null ? redisPort : 6379; }
    public void setRedisPort(Integer redisPort) { this.redisPort = redisPort; }

    public String getRedisPassword() { return redisPassword; }
    public void setRedisPassword(String redisPassword) { this.redisPassword = redisPassword; }

    public Boolean getAwsS3Enabled() { return awsS3Enabled != null ? awsS3Enabled : false; }
    public void setAwsS3Enabled(Boolean awsS3Enabled) { this.awsS3Enabled = awsS3Enabled; }

    public String getAwsAccessKey() { return awsAccessKey; }
    public void setAwsAccessKey(String awsAccessKey) { this.awsAccessKey = awsAccessKey; }

    public String getAwsSecretKey() { return awsSecretKey; }
    public void setAwsSecretKey(String awsSecretKey) { this.awsSecretKey = awsSecretKey; }

    public String getAwsRegion() { return awsRegion; }
    public void setAwsRegion(String awsRegion) { this.awsRegion = awsRegion; }

    public String getAwsBucketName() { return awsBucketName; }
    public void setAwsBucketName(String awsBucketName) { this.awsBucketName = awsBucketName; }

    public Boolean getRateLimitingEnabled() { return rateLimitingEnabled != null ? rateLimitingEnabled : true; }
    public void setRateLimitingEnabled(Boolean rateLimitingEnabled) { this.rateLimitingEnabled = rateLimitingEnabled; }

    public Integer getMaxRequestsPerSec() { return maxRequestsPerSec != null ? maxRequestsPerSec : 50; }
    public void setMaxRequestsPerSec(Integer maxRequestsPerSec) { this.maxRequestsPerSec = maxRequestsPerSec; }

    public Integer getAuthBruteForceLimitPerMin() { return authBruteForceLimitPerMin != null ? authBruteForceLimitPerMin : 5; }
    public void setAuthBruteForceLimitPerMin(Integer authBruteForceLimitPerMin) { this.authBruteForceLimitPerMin = authBruteForceLimitPerMin; }

    public String getRazorpayMasterKeyId() { return razorpayMasterKeyId; }
    public void setRazorpayMasterKeyId(String razorpayMasterKeyId) { this.razorpayMasterKeyId = razorpayMasterKeyId; }

    public String getRazorpayMasterKeySecret() { return razorpayMasterKeySecret; }
    public void setRazorpayMasterKeySecret(String razorpayMasterKeySecret) { this.razorpayMasterKeySecret = razorpayMasterKeySecret; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
