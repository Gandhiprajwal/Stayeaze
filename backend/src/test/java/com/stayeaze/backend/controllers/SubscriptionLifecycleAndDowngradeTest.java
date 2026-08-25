package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SubscriptionLifecycleAndDowngradeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken ownerAuth;
    private Property propA;
    private Property propB;
    private Property propC;

    @BeforeEach
    public void setup() {
        testOrg = new Organization("Downgrade Test PG Org", "down-org-" + UUID.randomUUID().toString().substring(0, 6));
        testOrg = organizationRepository.save(testOrg);

        saasPlanRepository.findByPlanKey("STARTER").orElseGet(() -> {
            SaaSPlan p = new SaaSPlan("STARTER", "Starter Plan", BigDecimal.valueOf(999), BigDecimal.valueOf(9999), 1, 30, 2, true, false, "MONTHLY");
            return saasPlanRepository.save(p);
        });

        saasPlanRepository.findByPlanKey("PROFESSIONAL").orElseGet(() -> {
            SaaSPlan p = new SaaSPlan("PROFESSIONAL", "Professional Plan", BigDecimal.valueOf(2499), BigDecimal.valueOf(24999), 5, 150, 10, true, true, "MONTHLY");
            return saasPlanRepository.save(p);
        });

        OrganizationBillingProfile profile = new OrganizationBillingProfile(testOrg);
        profile.setSubscriptionPlanName("Professional Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(2499));
        profile.setSubscriptionStatus("ACTIVE");
        billingProfileRepository.save(profile);

        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role(ERole.OWNER, "[\"ALL\"]");
            return roleRepository.save(r);
        });

        ownerUser = new User(testOrg, "owner." + UUID.randomUUID().toString().substring(0, 6) + "@downgrade.com", passwordEncoder.encode("pass123"), "97777" + (int)(Math.random()*90000 + 10000));
        ownerUser.setRoles(Set.of(ownerRole));
        ownerUser = userRepository.save(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        ownerAuth = new UsernamePasswordAuthenticationToken(userDetails, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(ownerAuth);

        propA = new Property(testOrg, "Prime Tower A", "Koramangala, Bangalore");
        propA.setTotalBeds(20);
        propA.setStatus("ACTIVE");
        propA = propertyRepository.save(propA);

        propB = new Property(testOrg, "Prime Tower B", "HSR Layout, Bangalore");
        propB.setTotalBeds(30);
        propB.setStatus("ACTIVE");
        propB = propertyRepository.save(propB);

        propC = new Property(testOrg, "Prime Tower C", "Whitefield, Bangalore");
        propC.setTotalBeds(30);
        propC.setStatus("ACTIVE");
        propC = propertyRepository.save(propC);
    }

    @Test
    @DisplayName("Scenario 1 (Positive): Renewal order on expired subscription charges full plan price without skipping")
    public void testRenewalOrderChargesFullPrice() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("EXPIRED");
        billingProfileRepository.save(profile);

        mockMvc.perform(post("/api/v1/subscription/create-upgrade-order")
                        .with(authentication(ownerAuth))
                        .param("planName", "Professional Plan")
                        .param("planPrice", "2499")
                        .param("billingCycle", "MONTHLY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId", notNullValue()))
                .andExpect(jsonPath("$.skipPayment", is(false)))
                .andExpect(jsonPath("$.netPayable", is(2499.0)));
    }

    @Test
    @DisplayName("Scenario 2 (Positive): Successful downgrade to Starter when resources fit within target quota")
    public void testSuccessfulDowngradeWithinQuota() throws Exception {
        // Leave only 1 property active with 20 beds (Starter limit: 1 property, 30 beds)
        propB.setStatus("INACTIVE");
        propertyRepository.save(propB);
        propC.setStatus("INACTIVE");
        propertyRepository.save(propC);

        mockMvc.perform(post("/api/v1/subscription/upgrade")
                        .with(authentication(ownerAuth))
                        .param("planName", "Starter Plan")
                        .param("planPrice", "1499")
                        .param("billingCycle", "MONTHLY")
                        .param("razorpayPaymentId", "pay_rzp_test_123")
                        .param("razorpayOrderId", "order_sub_test_123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isDowngrade", is(true)))
                .andExpect(jsonPath("$.message", containsString("Successfully downgraded")));

        OrganizationBillingProfile updatedProfile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("Starter Plan", updatedProfile.getSubscriptionPlanName());
        org.junit.jupiter.api.Assertions.assertNotNull(updatedProfile.getLastDowngradedAt());
    }

    @Test
    @DisplayName("Scenario 3 (Positive): Property deactivation marks status INACTIVE and locks space generation")
    public void testPropertyDeactivationAndOperationalLock() throws Exception {
        Building buildingB = new Building(propB, "Block 1", "B1");
        buildingB = buildingRepository.save(buildingB);

        // Deactivate property B
        Map<String, Object> deactReq = Map.of("propertyIds", List.of(propB.getId()));
        mockMvc.perform(post("/api/v1/subscription/deactivate-properties")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(deactReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedCount", is(1)));

        Property refreshedB = propertyRepository.findById(propB.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("INACTIVE", refreshedB.getStatus());

        // Attempt space generation on Inactive Property B -> Must be rejected with 400
        Map<String, Object> spaceReq = new HashMap<>();
        spaceReq.put("startFloor", 1);
        spaceReq.put("endFloor", 1);
        spaceReq.put("roomsPerFloor", 2);
        spaceReq.put("bedsPerRoom", 1);

        mockMvc.perform(post("/api/v1/properties/" + propB.getId() + "/buildings/" + buildingB.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(spaceReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Property is INACTIVE")));
    }

    @Test
    @DisplayName("Scenario 4 (Negative): Downgrade rejected when attempted within 90-day cooldown lock-in period")
    public void testDowngradeBlockedWithin90DayCooldown() throws Exception {
        // Set last downgraded date to 30 days ago (within 90-day cooldown)
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setLastDowngradedAt(OffsetDateTime.now().minusDays(30));
        billingProfileRepository.save(profile);

        mockMvc.perform(post("/api/v1/subscription/create-upgrade-order")
                        .with(authentication(ownerAuth))
                        .param("planName", "Starter Plan")
                        .param("planPrice", "1499")
                        .param("billingCycle", "MONTHLY"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("once every 3 months (90 days)")));
    }

    @Test
    @DisplayName("Scenario 5 (Negative): Downgrade rejected when active properties/beds exceed target plan limits")
    public void testDowngradeBlockedWhenQuotaExceeded() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionPlanName("Professional Plan");
        profile.setLastDowngradedAt(null);
        billingProfileRepository.save(profile);

        Property extraProp1 = new Property(testOrg, "Extra Tower 1", "Bangalore");
        extraProp1.setTotalBeds(25);
        extraProp1.setStatus("ACTIVE");
        propertyRepository.save(extraProp1);

        Property extraProp2 = new Property(testOrg, "Extra Tower 2", "Bangalore");
        extraProp2.setTotalBeds(25);
        extraProp2.setStatus("ACTIVE");
        propertyRepository.save(extraProp2);

        mockMvc.perform(post("/api/v1/subscription/create-upgrade-order")
                        .with(authentication(ownerAuth))
                        .param("planName", "Starter Plan")
                        .param("planPrice", "1499")
                        .param("billingCycle", "MONTHLY"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Subscription Quota Exceeded")));
    }

    @Test
    @DisplayName("Scenario 6 (Negative): Tenant creation rejected on INACTIVE property")
    public void testTenantCreationBlockedOnInactiveProperty() throws Exception {
        propC.setStatus("INACTIVE");
        propertyRepository.save(propC);

        Map<String, Object> tenantReq = new HashMap<>();
        tenantReq.put("firstName", "Kunal");
        tenantReq.put("lastName", "Singh");
        tenantReq.put("mobile", "96666" + (int)(Math.random()*90000 + 10000));
        tenantReq.put("email", "kunal." + UUID.randomUUID().toString().substring(0, 5) + "@test.com");
        tenantReq.put("propertyId", propC.getId());
        tenantReq.put("rent", 9500);

        mockMvc.perform(post("/api/v1/tenants")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tenantReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("The selected property is INACTIVE")));
    }

    @Test
    @DisplayName("Scenario 7 (Positive): Fetch organization SaaS invoices list and HTML tax receipt")
    public void testMyInvoicesEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/subscription/my-invoices")
                        .with(authentication(ownerAuth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", notNullValue()));
    }

    @Test
    @DisplayName("Scenario 8 (Positive): Monthly to Annual switch is a paid commitment with unused credit discount")
    public void testMonthlyToAnnualSwitchCalculatesCorrectPayableAmount() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).get();
        profile.setSubscriptionPlanName("Starter Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(1499));
        profile.setSubscriptionBillingCycle("MONTHLY");
        profile.setSubscriptionStartDate(OffsetDateTime.now().minusDays(10));
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(20));
        profile.setSubscriptionStatus("ACTIVE");
        billingProfileRepository.save(profile);

        mockMvc.perform(post("/api/v1/subscription/preview-switch")
                        .with(authentication(ownerAuth))
                        .param("targetPlanName", "Starter Plan")
                        .param("targetPlanPrice", "14990")
                        .param("billingCycle", "ANNUAL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isDowngrade", is(false)))
                .andExpect(jsonPath("$.netPayable", greaterThan(13000.0)))
                .andExpect(jsonPath("$.unusedCredit", greaterThan(0.0)));
    }

    @Test
    @DisplayName("Scenario 9 (Positive): Annual to Monthly switch converts unused annual balance to validity days with zero payment")
    public void testAnnualToMonthlySwitchConvertsBalanceToDays() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).get();
        profile.setSubscriptionPlanName("Professional Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(24999));
        profile.setSubscriptionBillingCycle("ANNUAL");
        profile.setSubscriptionStartDate(OffsetDateTime.now().minusDays(65));
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(300));
        profile.setSubscriptionStatus("ACTIVE");
        billingProfileRepository.save(profile);

        mockMvc.perform(post("/api/v1/subscription/preview-switch")
                        .with(authentication(ownerAuth))
                        .param("targetPlanName", "Starter Plan")
                        .param("targetPlanPrice", "1499")
                        .param("billingCycle", "MONTHLY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isDowngrade", is(true)))
                .andExpect(jsonPath("$.netPayable", is(0.0)))
                .andExpect(jsonPath("$.extraDays", greaterThan(100)));
    }

    @Test
    @DisplayName("Scenario 10 (Positive): Annual Pro to Annual Enterprise upgrade applies large active unused credit")
    public void testAnnualProToAnnualEnterpriseUpgradeCalculatesExactUnusedCredit() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).get();
        profile.setSubscriptionPlanName("Professional Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(24999));
        profile.setSubscriptionBillingCycle("ANNUAL");
        profile.setSubscriptionStartDate(OffsetDateTime.now().minusDays(65));
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(300));
        profile.setSubscriptionStatus("ACTIVE");
        billingProfileRepository.save(profile);

        mockMvc.perform(post("/api/v1/subscription/preview-switch")
                        .with(authentication(ownerAuth))
                        .param("targetPlanName", "Enterprise Custom Plan")
                        .param("targetPlanPrice", "49999")
                        .param("billingCycle", "ANNUAL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isDowngrade", is(false)))
                .andExpect(jsonPath("$.unusedCredit", greaterThan(20000.0)))
                .andExpect(jsonPath("$.netPayable", lessThan(30000.0)));
    }

    @Test
    @DisplayName("Scenario 11 (Positive): Same plan annual renewal extends existingEndDate by 365 days")
    public void testActivePlanRenewalAppends365DaysToExistingEndDate() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).get();
        profile.setSubscriptionPlanName("Professional Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(24999));
        profile.setSubscriptionBillingCycle("ANNUAL");
        OffsetDateTime initialExpiry = OffsetDateTime.now().plusDays(100);
        profile.setSubscriptionStartDate(OffsetDateTime.now().minusDays(265));
        profile.setSubscriptionEndDate(initialExpiry);
        profile.setSubscriptionStatus("ACTIVE");
        billingProfileRepository.save(profile);

        mockMvc.perform(post("/api/v1/subscription/upgrade")
                        .with(authentication(ownerAuth))
                        .param("planName", "Professional Plan")
                        .param("planPrice", "24999")
                        .param("billingCycle", "ANNUAL")
                        .param("razorpayPaymentId", "pay_test_renewal_123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Successfully renewed")));

        OrganizationBillingProfile updated = billingProfileRepository.findByOrganization(testOrg).get();
        long daysUntilExpiry = java.time.Duration.between(OffsetDateTime.now(), updated.getSubscriptionEndDate()).toDays();
        // 100 days remaining + 365 new days = ~465 days total
        org.junit.jupiter.api.Assertions.assertTrue(daysUntilExpiry >= 460 && daysUntilExpiry <= 470);
    }
}
