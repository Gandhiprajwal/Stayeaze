package com.stayeaze.backend.models;

import jakarta.persistence.*;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "saas_plans")
@Cacheable
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class SaaSPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "plan_key", nullable = false, length = 50)
    private String planKey; // STARTER, PROFESSIONAL, ENTERPRISE, CUSTOM

    @Column(name = "monthly_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal monthlyPrice;

    @Column(name = "annual_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal annualPrice;

    @Column(name = "max_properties", nullable = false)
    private Integer maxProperties = 1;

    @Column(name = "max_beds", nullable = false)
    private Integer maxBeds = 25;

    @Column(name = "max_staff_users", nullable = false)
    private Integer maxStaffUsers = 2;

    @Column(name = "allow_whatsapp", nullable = false)
    private Boolean allowWhatsApp = false;

    @Column(name = "allow_razorpay_online", nullable = false)
    private Boolean allowRazorpayOnline = true;

    @Column(name = "allow_custom_branding", nullable = false)
    private Boolean allowCustomBranding = false;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(length = 255)
    private String description;

    public SaaSPlan() {}

    public SaaSPlan(String name, String planKey, BigDecimal monthlyPrice, BigDecimal annualPrice,
                    Integer maxProperties, Integer maxBeds, Integer maxStaffUsers,
                    Boolean allowWhatsApp, Boolean allowCustomBranding, String description) {
        this.name = name;
        this.planKey = planKey;
        this.monthlyPrice = monthlyPrice;
        this.annualPrice = annualPrice;
        this.maxProperties = maxProperties;
        this.maxBeds = maxBeds;
        this.maxStaffUsers = maxStaffUsers;
        this.allowWhatsApp = allowWhatsApp;
        this.allowCustomBranding = allowCustomBranding;
        this.description = description;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPlanKey() { return planKey; }
    public void setPlanKey(String planKey) { this.planKey = planKey; }

    public BigDecimal getMonthlyPrice() { return monthlyPrice; }
    public void setMonthlyPrice(BigDecimal monthlyPrice) { this.monthlyPrice = monthlyPrice; }

    public BigDecimal getAnnualPrice() { return annualPrice; }
    public void setAnnualPrice(BigDecimal annualPrice) { this.annualPrice = annualPrice; }

    public Integer getMaxProperties() { return maxProperties; }
    public void setMaxProperties(Integer maxProperties) { this.maxProperties = maxProperties; }

    public Integer getMaxBeds() { return maxBeds; }
    public void setMaxBeds(Integer maxBeds) { this.maxBeds = maxBeds; }

    public Integer getMaxStaffUsers() { return maxStaffUsers; }
    public void setMaxStaffUsers(Integer maxStaffUsers) { this.maxStaffUsers = maxStaffUsers; }

    public Boolean getAllowWhatsApp() { return allowWhatsApp; }
    public void setAllowWhatsApp(Boolean allowWhatsApp) { this.allowWhatsApp = allowWhatsApp; }

    public Boolean getAllowRazorpayOnline() { return allowRazorpayOnline; }
    public void setAllowRazorpayOnline(Boolean allowRazorpayOnline) { this.allowRazorpayOnline = allowRazorpayOnline; }

    public Boolean getAllowCustomBranding() { return allowCustomBranding; }
    public void setAllowCustomBranding(Boolean allowCustomBranding) { this.allowCustomBranding = allowCustomBranding; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
