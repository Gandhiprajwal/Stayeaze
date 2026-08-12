package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class SystemConfigRequest {
    @NotBlank
    private String smsProvider;

    @NotBlank
    private String emailProvider;

    @NotNull
    private Boolean allowSelfRegistration;

    @NotNull
    private Boolean maintenanceMode;

    private String twilioSid;
    private String twilioAuthToken;
    private String smtpHost;
    private String smtpPort;
    private String smtpUsername;
    private String smtpPassword;
    private String razorpayKeyId;
    private String razorpayKeySecret;
    private java.math.BigDecimal defaultSecurityDeposit;

    public SystemConfigRequest() {
    }

    public String getSmsProvider() {
        return smsProvider;
    }

    public void setSmsProvider(String smsProvider) {
        this.smsProvider = smsProvider;
    }

    public String getEmailProvider() {
        return emailProvider;
    }

    public void setEmailProvider(String emailProvider) {
        this.emailProvider = emailProvider;
    }

    public Boolean getAllowSelfRegistration() {
        return allowSelfRegistration;
    }

    public void setAllowSelfRegistration(Boolean allowSelfRegistration) {
        this.allowSelfRegistration = allowSelfRegistration;
    }

    public Boolean getMaintenanceMode() {
        return maintenanceMode;
    }

    public void setMaintenanceMode(Boolean maintenanceMode) {
        this.maintenanceMode = maintenanceMode;
    }

    public String getTwilioSid() {
        return twilioSid;
    }

    public void setTwilioSid(String twilioSid) {
        this.twilioSid = twilioSid;
    }

    public String getTwilioAuthToken() {
        return twilioAuthToken;
    }

    public void setTwilioAuthToken(String twilioAuthToken) {
        this.twilioAuthToken = twilioAuthToken;
    }

    public String getSmtpHost() {
        return smtpHost;
    }

    public void setSmtpHost(String smtpHost) {
        this.smtpHost = smtpHost;
    }

    public String getSmtpPort() {
        return smtpPort;
    }

    public void setSmtpPort(String smtpPort) {
        this.smtpPort = smtpPort;
    }

    public String getSmtpUsername() {
        return smtpUsername;
    }

    public void setSmtpUsername(String smtpUsername) {
        this.smtpUsername = smtpUsername;
    }

    public String getSmtpPassword() {
        return smtpPassword;
    }

    public void setSmtpPassword(String smtpPassword) {
        this.smtpPassword = smtpPassword;
    }

    public String getRazorpayKeyId() {
        return razorpayKeyId;
    }

    public void setRazorpayKeyId(String razorpayKeyId) {
        this.razorpayKeyId = razorpayKeyId;
    }

    public String getRazorpayKeySecret() {
        return razorpayKeySecret;
    }

    public void setRazorpayKeySecret(String razorpayKeySecret) {
        this.razorpayKeySecret = razorpayKeySecret;
    }

    public java.math.BigDecimal getDefaultSecurityDeposit() {
        return defaultSecurityDeposit;
    }

    public void setDefaultSecurityDeposit(java.math.BigDecimal defaultSecurityDeposit) {
        this.defaultSecurityDeposit = defaultSecurityDeposit;
    }
}
