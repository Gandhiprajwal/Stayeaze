package com.stayeaze.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "properties")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Property {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "org_id", nullable = false)
    private Organization organization;

    @TenantId
    @Column(name = "org_id", insertable = false, updatable = false)
    private UUID tenantOrgId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 50)
    private String code;

    @Column(length = 50)
    private String type = "PG";

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, columnDefinition = "text")
    private String address;

    @Column(length = 150)
    private String city;

    @Column(length = 150)
    private String state;

    @Column(length = 20)
    private String pincode;

    @Column(length = 150)
    private String manager;

    @Column(length = 50)
    private String phone;

    @Column(length = 150)
    private String email;

    @Column(name = "landlord_pan", length = 20)
    private String landlordPan = "ABCDE1234F";

    @Column(name = "pg_license_no", length = 100)
    private String pgLicenseNo = "PG-REG/UP/NOIDA/2024/09812";

    @Column(name = "bank_account_name", length = 150)
    private String bankAccountName = "StayEaze Living Solutions";

    @Column(name = "bank_name", length = 100)
    private String bankName = "HDFC Bank Ltd";

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber = "502000987654321";

    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc = "HDFC0001234";

    @Column(name = "upi_vpa", length = 100)
    private String upiVpa = "stayeaze@icici";

    @Column(name = "wifi_ssid", length = 100)
    private String wifiSsid;

    @Column(name = "wifi_password", length = 100)
    private String wifiPassword;

    @Column(name = "wifi_networks_json", columnDefinition = "text")
    private String wifiNetworksJson;

    @Column(name = "authorized_signatory", length = 150)
    private String authorizedSignatory = "StayEaze Management Authorized Signatory";

    @Column(name = "gstin", length = 20)
    private String gstin;

    @Column(name = "razorpay_key_id", length = 255)
    private String razorpayKeyId;

    @Column(name = "razorpay_key_secret", length = 255)
    private String razorpayKeySecret;

    @Column(name = "security_deposit", precision = 12, scale = 2)
    private java.math.BigDecimal securityDeposit = new java.math.BigDecimal("0");

    @Column(name = "minimum_lock_in_months")
    private Integer minimumLockInMonths = 3;

    @Column(name = "notice_period_days")
    private Integer noticePeriodDays = 30;

    @Column(name = "default_exit_cleaning_fee", precision = 12, scale = 2)
    private java.math.BigDecimal defaultExitCleaningFee = new java.math.BigDecimal("500.00");

    @Column(name = "default_electricity_rate_per_unit", precision = 12, scale = 2)
    private java.math.BigDecimal defaultElectricityRatePerUnit = new java.math.BigDecimal("10.00");

    @Column(name = "emergency_hospital_phone", length = 50)
    private String emergencyHospitalPhone = "108";

    @Column(name = "emergency_police_phone", length = 50)
    private String emergencyPolicePhone = "112";

    @Column(name = "emergency_electrician_phone", length = 50)
    private String emergencyElectricianPhone = "+91 98450 99881";

    @Column(name = "emergency_plumber_phone", length = 50)
    private String emergencyPlumberPhone = "+91 98450 99882";

    @Column(name = "curfew_time", length = 50)
    private String curfewTime = "10:30 PM";

    @Column(name = "lost_key_penalty_fee", precision = 10, scale = 2)
    private java.math.BigDecimal lostKeyPenaltyFee = new java.math.BigDecimal("200.00");

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "property_amenities", joinColumns = @JoinColumn(name = "property_id"))
    @Column(name = "amenity")
    private List<String> amenities = new ArrayList<>();

    @Column(length = 50)
    private String status = "ACTIVE";

    @Column(length = 10)
    private String currency = "INR";

    @Column(length = 50)
    private String timezone = "Asia/Kolkata";

    @Column(name = "total_buildings")
    private Integer totalBuildings = 0;

    @Column(name = "total_rooms")
    private Integer totalRooms = 0;

    @Column(name = "total_beds")
    private Integer totalBeds = 0;

    @Column(name = "occupied_beds")
    private Integer occupiedBeds = 0;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Property() {
    }

    public Property(Organization organization, String name, String address) {
        this.organization = organization;
        this.name = name;
        this.address = address;
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

    @JsonProperty("orgId")
    public UUID getOrgId() {
        return organization != null ? organization.getId() : null;
    }

    @JsonProperty("organizationName")
    public String getOrganizationName() {
        return organization != null ? organization.getName() : null;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public List<String> getAmenities() {
        return amenities;
    }

    public void setAmenities(List<String> amenities) {
        this.amenities = amenities;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status != null ? status.toUpperCase() : "ACTIVE";
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getCode() {
        return code != null ? code : "PROP";
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getWifiSsid() {
        return wifiSsid;
    }

    public void setWifiSsid(String wifiSsid) {
        this.wifiSsid = wifiSsid;
    }

    public String getWifiPassword() {
        return wifiPassword;
    }

    public void setWifiPassword(String wifiPassword) {
        this.wifiPassword = wifiPassword;
    }

    public String getType() {
        return type != null ? type : "CO_LIVING";
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCity() {
        return city != null ? city : "";
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state != null ? state : "";
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getPincode() {
        return pincode != null ? pincode : "";
    }

    public void setPincode(String pincode) {
        this.pincode = pincode;
    }

    public String getManager() {
        return manager != null ? manager : "";
    }

    public void setManager(String manager) {
        this.manager = manager;
    }

    public String getPhone() {
        return phone != null ? phone : "";
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email != null ? email : "";
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getLandlordPan() {
        return landlordPan != null ? landlordPan : "ABCDE1234F";
    }

    public void setLandlordPan(String landlordPan) {
        this.landlordPan = landlordPan;
    }

    public String getPgLicenseNo() {
        return pgLicenseNo != null ? pgLicenseNo : "PG-REG/UP/NOIDA/2024/09812";
    }

    public void setPgLicenseNo(String pgLicenseNo) {
        this.pgLicenseNo = pgLicenseNo;
    }

    public String getBankAccountName() {
        return bankAccountName != null ? bankAccountName : "StayEaze Living Solutions";
    }

    public void setBankAccountName(String bankAccountName) {
        this.bankAccountName = bankAccountName;
    }

    public String getBankName() {
        return bankName != null ? bankName : "HDFC Bank Ltd";
    }

    public void setBankName(String bankName) {
        this.bankName = bankName;
    }

    public String getBankAccountNumber() {
        return bankAccountNumber != null ? bankAccountNumber : "502000987654321";
    }

    public void setBankAccountNumber(String bankAccountNumber) {
        this.bankAccountNumber = bankAccountNumber;
    }

    public String getBankIfsc() {
        return bankIfsc != null ? bankIfsc : "HDFC0001234";
    }

    public void setBankIfsc(String bankIfsc) {
        this.bankIfsc = bankIfsc;
    }

    public String getUpiVpa() {
        return upiVpa != null ? upiVpa : "stayeaze@icici";
    }

    public void setUpiVpa(String upiVpa) {
        this.upiVpa = upiVpa;
    }

    public String getAuthorizedSignatory() {
        return authorizedSignatory != null ? authorizedSignatory : "StayEaze Management Authorized Signatory";
    }

    public void setAuthorizedSignatory(String authorizedSignatory) {
        this.authorizedSignatory = authorizedSignatory;
    }

    public String getGstin() {
        return gstin;
    }

    public void setGstin(String gstin) {
        this.gstin = gstin;
    }

    public String getRazorpayKeyId() {
        return razorpayKeyId;
    }

    public void setRazorpayKeyId(String razorpayKeyId) {
        this.razorpayKeyId = razorpayKeyId;
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    public String getRazorpayKeySecret() {
        return razorpayKeySecret;
    }

    public void setRazorpayKeySecret(String razorpayKeySecret) {
        this.razorpayKeySecret = razorpayKeySecret;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("hasRazorpaySecret")
    public boolean hasRazorpaySecret() {
        return razorpayKeySecret != null && !razorpayKeySecret.isBlank();
    }

    public Integer getTotalBuildings() {
        return totalBuildings != null ? totalBuildings : 0;
    }

    public void setTotalBuildings(Integer totalBuildings) {
        this.totalBuildings = totalBuildings;
    }

    public Integer getTotalRooms() {
        return totalRooms != null ? totalRooms : 0;
    }

    public void setTotalRooms(Integer totalRooms) {
        this.totalRooms = totalRooms;
    }

    public Integer getTotalBeds() {
        return totalBeds != null ? totalBeds : 0;
    }

    public void setTotalBeds(Integer totalBeds) {
        this.totalBeds = totalBeds;
    }

    public Integer getOccupiedBeds() {
        return occupiedBeds != null ? occupiedBeds : 0;
    }

    public void setOccupiedBeds(Integer occupiedBeds) {
        this.occupiedBeds = occupiedBeds;
    }

    public java.math.BigDecimal getSecurityDeposit() {
        return securityDeposit != null ? securityDeposit : java.math.BigDecimal.ZERO;
    }

    public void setSecurityDeposit(java.math.BigDecimal securityDeposit) {
        this.securityDeposit = securityDeposit;
    }

    public String getWifiNetworksJson() {
        return wifiNetworksJson;
    }

    public void setWifiNetworksJson(String wifiNetworksJson) {
        this.wifiNetworksJson = wifiNetworksJson;
    }

    public Integer getMinimumLockInMonths() {
        return minimumLockInMonths != null ? minimumLockInMonths : 3;
    }

    public void setMinimumLockInMonths(Integer minimumLockInMonths) {
        this.minimumLockInMonths = minimumLockInMonths;
    }

    public Integer getNoticePeriodDays() {
        return noticePeriodDays != null ? noticePeriodDays : 30;
    }

    public void setNoticePeriodDays(Integer noticePeriodDays) {
        this.noticePeriodDays = noticePeriodDays;
    }

    public java.math.BigDecimal getDefaultExitCleaningFee() {
        return defaultExitCleaningFee != null ? defaultExitCleaningFee : new java.math.BigDecimal("500.00");
    }

    public void setDefaultExitCleaningFee(java.math.BigDecimal defaultExitCleaningFee) {
        this.defaultExitCleaningFee = defaultExitCleaningFee;
    }

    public java.math.BigDecimal getDefaultElectricityRatePerUnit() {
        return defaultElectricityRatePerUnit != null ? defaultElectricityRatePerUnit : new java.math.BigDecimal("10.00");
    }

    public void setDefaultElectricityRatePerUnit(java.math.BigDecimal defaultElectricityRatePerUnit) {
        this.defaultElectricityRatePerUnit = defaultElectricityRatePerUnit;
    }

    public String getEmergencyHospitalPhone() { return emergencyHospitalPhone != null ? emergencyHospitalPhone : "108"; }
    public void setEmergencyHospitalPhone(String emergencyHospitalPhone) { this.emergencyHospitalPhone = emergencyHospitalPhone; }

    public String getEmergencyPolicePhone() { return emergencyPolicePhone != null ? emergencyPolicePhone : "112"; }
    public void setEmergencyPolicePhone(String emergencyPolicePhone) { this.emergencyPolicePhone = emergencyPolicePhone; }

    public String getEmergencyElectricianPhone() { return emergencyElectricianPhone != null ? emergencyElectricianPhone : "+91 98450 99881"; }
    public void setEmergencyElectricianPhone(String emergencyElectricianPhone) { this.emergencyElectricianPhone = emergencyElectricianPhone; }

    public String getEmergencyPlumberPhone() { return emergencyPlumberPhone != null ? emergencyPlumberPhone : "+91 98450 99882"; }
    public void setEmergencyPlumberPhone(String emergencyPlumberPhone) { this.emergencyPlumberPhone = emergencyPlumberPhone; }

    public String getCurfewTime() { return curfewTime != null ? curfewTime : "10:30 PM"; }
    public void setCurfewTime(String curfewTime) { this.curfewTime = curfewTime; }

    public java.math.BigDecimal getLostKeyPenaltyFee() { return lostKeyPenaltyFee != null ? lostKeyPenaltyFee : new java.math.BigDecimal("200.00"); }
    public void setLostKeyPenaltyFee(java.math.BigDecimal lostKeyPenaltyFee) { this.lostKeyPenaltyFee = lostKeyPenaltyFee; }
}
