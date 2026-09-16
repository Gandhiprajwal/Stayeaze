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
public class OwnerWorkflowIntegrationTest {

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
    private FloorRepository floorRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken ownerAuth;
    private Property testProperty;
    private Building testBuilding;

    @BeforeEach
    public void setup() {
        testOrg = new Organization("StayEaze Grand PG", "grand-pg-" + UUID.randomUUID().toString().substring(0, 6));
        testOrg = organizationRepository.save(testOrg);

        saasPlanRepository.findByPlanKey("GROWTH").orElseGet(() -> {
            SaaSPlan p = new SaaSPlan("GROWTH", "Growth Plan", BigDecimal.valueOf(2499), BigDecimal.valueOf(24999), 5, 200, 10, true, true, "MONTHLY");
            return saasPlanRepository.save(p);
        });

        OrganizationBillingProfile profile = new OrganizationBillingProfile(testOrg);
        profile.setSubscriptionPlanName("GROWTH");
        profile.setSubscriptionStatus("ACTIVE");
        billingProfileRepository.save(profile);

        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role(ERole.OWNER, "[\"ALL\"]");
            return roleRepository.save(r);
        });

        ownerUser = new User(testOrg, "owner." + UUID.randomUUID().toString().substring(0, 6) + "@grandpg.com", passwordEncoder.encode("pass123"), "987654" + (int)(Math.random()*9000 + 1000));
        ownerUser.setRoles(Set.of(ownerRole));
        ownerUser = userRepository.save(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        ownerAuth = new UsernamePasswordAuthenticationToken(userDetails, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(ownerAuth);

        testProperty = new Property(testOrg, "Grand Palace Residency", "123 Outer Ring Road, Bangalore");
        testProperty.setCode("GPR-01");
        testProperty.setType("PG");
        testProperty = propertyRepository.save(testProperty);

        testBuilding = new Building(testProperty, "Tower Alpha", "BLK-A");
        testBuilding = buildingRepository.save(testBuilding);
    }

    @Test
    @DisplayName("Scenario 1: Fast Batch Space Generation Creates Floors, Rooms, and Beds Atomically")
    public void testBatchSpaceGenerationSuccess() throws Exception {
        Map<String, Object> req = new HashMap<>();
        req.put("startFloor", 1);
        req.put("endFloor", 3);
        req.put("roomsPerFloor", 4);
        req.put("sharingType", "DOUBLE");
        req.put("bedsPerRoom", 2);
        req.put("baseRent", 8500);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.floorsCreated", is(3)))
                .andExpect(jsonPath("$.roomsCreated", is(12)))
                .andExpect(jsonPath("$.bedsCreated", is(24)))
                .andExpect(jsonPath("$.buildingName", is("Tower Alpha")));

        List<Floor> floors = floorRepository.findByBuilding(testBuilding);
        org.junit.jupiter.api.Assertions.assertEquals(3, floors.size());
    }

    @Test
    @DisplayName("Scenario 2: Batch Space Generation Blocked When Exceeding Subscribed Plan Bed Limits")
    public void testBatchSpaceGenerationPlanLimitExceeded() throws Exception {
        Map<String, Object> req = new HashMap<>();
        req.put("startFloor", 1);
        req.put("endFloor", 5);
        req.put("roomsPerFloor", 25);
        req.put("sharingType", "DOUBLE");
        req.put("bedsPerRoom", 2); // 5 * 25 * 2 = 250 beds (Growth plan allows 200)

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Subscription Limit Reached")));
    }

    @Test
    @DisplayName("Scenario 3: Monthly Rent Run Generates Invoices for All Active Tenants")
    public void testMonthlyRentRunGeneratesInvoices() throws Exception {
        Tenant t1 = new Tenant(testOrg, "Rahul", "Verma", "9111" + (int)(Math.random()*900000 + 100000));
        t1.setEmail("rahul.v." + UUID.randomUUID().toString().substring(0, 5) + "@test.com");
        t1.setRent(BigDecimal.valueOf(9000));
        t1.setStatus("ACTIVE");
        t1.setPropertyId(testProperty.getId());
        t1.setRoomNumber("101");
        t1.setBedNumber("A");
        tenantRepository.save(t1);

        Tenant t2 = new Tenant(testOrg, "Priya", "Sharma", "9222" + (int)(Math.random()*900000 + 100000));
        t2.setEmail("priya.s." + UUID.randomUUID().toString().substring(0, 5) + "@test.com");
        t2.setRent(BigDecimal.valueOf(11000));
        t2.setStatus("ACTIVE");
        t2.setPropertyId(testProperty.getId());
        t2.setRoomNumber("102");
        t2.setBedNumber("B");
        tenantRepository.save(t2);

        Map<String, Object> req = new HashMap<>();
        req.put("billingMonth", 10);
        req.put("billingYear", 2026);
        req.put("dueDateDays", 5);

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.invoicesGenerated", is(2)))
                .andExpect(jsonPath("$.totalBillingAmount", is(20000)))
                .andExpect(jsonPath("$.totalDueRemaining", is(20000)));
    }

    @Test
    @DisplayName("Scenario 4: Monthly Rent Run Applies Partial Greedy Advance Settlement")
    public void testMonthlyRentRunGreedyAdvanceSettlementPartial() throws Exception {
        Tenant t = new Tenant(testOrg, "Amit", "Kumar", "9333" + (int)(Math.random()*900000 + 100000));
        t.setEmail("amit.k." + UUID.randomUUID().toString().substring(0, 5) + "@test.com");
        t.setRent(BigDecimal.valueOf(10000));
        t.setAdvanceBalance(BigDecimal.valueOf(4000));
        t.setStatus("ACTIVE");
        t.setPropertyId(testProperty.getId());
        t = tenantRepository.save(t);

        Map<String, Object> req = new HashMap<>();
        req.put("billingMonth", 11);
        req.put("billingYear", 2026);
        req.put("dueDateDays", 5);

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.totalAdvanceOffset", is(4000)))
                .andExpect(jsonPath("$.totalDueRemaining", is(6000)));

        Tenant refreshed = tenantRepository.findById(t.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.ZERO.compareTo(refreshed.getAdvanceBalance()));
    }

    @Test
    @DisplayName("Scenario 5: Monthly Rent Run Applies Full Greedy Advance Settlement and Marks PAID")
    public void testMonthlyRentRunGreedyAdvanceSettlementFull() throws Exception {
        Tenant t = new Tenant(testOrg, "Sneha", "Reddy", "9444" + (int)(Math.random()*900000 + 100000));
        t.setEmail("sneha.r." + UUID.randomUUID().toString().substring(0, 5) + "@test.com");
        t.setRent(BigDecimal.valueOf(8000));
        t.setAdvanceBalance(BigDecimal.valueOf(12000));
        t.setStatus("ACTIVE");
        t.setPropertyId(testProperty.getId());
        t = tenantRepository.save(t);

        Map<String, Object> req = new HashMap<>();
        req.put("billingMonth", 12);
        req.put("billingYear", 2026);
        req.put("dueDateDays", 5);

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.totalAdvanceOffset", is(8000)))
                .andExpect(jsonPath("$.totalDueRemaining", is(0)));

        Tenant refreshed = tenantRepository.findById(t.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.valueOf(4000).compareTo(refreshed.getAdvanceBalance()));
    }

    @Test
    @DisplayName("Scenario 6: PAYMENT_LOCKED Organization Status Intercepts Mutations with 402 Payment Required")
    public void testPaymentLockedRestrictsMutations() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("PAYMENT_LOCKED");
        billingProfileRepository.save(profile);

        Map<String, Object> req = new HashMap<>();
        req.put("startFloor", 1);
        req.put("endFloor", 2);
        req.put("roomsPerFloor", 2);
        req.put("sharingType", "SINGLE");
        req.put("bedsPerRoom", 1);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message", containsString("Payment Required")));
    }

    @Test
    @DisplayName("Scenario 7: SUSPENDED Organization Status Intercepts Operations with 402 Payment Required")
    public void testSuspendedSubscriptionRestrictsMutations() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("SUSPENDED");
        billingProfileRepository.save(profile);

        Map<String, Object> req = new HashMap<>();
        req.put("startFloor", 1);
        req.put("endFloor", 2);
        req.put("roomsPerFloor", 2);
        req.put("sharingType", "SINGLE");
        req.put("bedsPerRoom", 1);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message", containsString("suspended")));
    }

    @Test
    @DisplayName("Scenario 8: EXPIRED Organization Status Intercepts Operations with 402 Payment Required")
    public void testExpiredSubscriptionRestrictsMutations() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("EXPIRED");
        billingProfileRepository.save(profile);

        Map<String, Object> req = new HashMap<>();
        req.put("startFloor", 1);
        req.put("endFloor", 2);
        req.put("roomsPerFloor", 2);
        req.put("sharingType", "SINGLE");
        req.put("bedsPerRoom", 1);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message", containsString("Subscription Expired")));
    }

    @Test
    @DisplayName("Scenario 9: Past Expiration Timestamp Intercepts Operations with 402 Payment Required")
    public void testExpiredTimestampRestrictsMutations() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(1));
        billingProfileRepository.save(profile);

        Map<String, Object> req = new HashMap<>();
        req.put("startFloor", 1);
        req.put("endFloor", 2);
        req.put("roomsPerFloor", 2);
        req.put("sharingType", "SINGLE");
        req.put("bedsPerRoom", 1);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message", containsString("Subscription Expired")));
    }

    @Test
    @DisplayName("Scenario 10: Centralized Interceptor Blocks All Property Mutations on Expired Subscription")
    public void testCentralInterceptorBlocksPropertyMutations() throws Exception {
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("EXPIRED");
        billingProfileRepository.save(profile);

        Map<String, Object> propReq = new HashMap<>();
        propReq.put("name", "Unauthorized Property");
        propReq.put("address", "Bangalore");
        propReq.put("type", "PG");

        mockMvc.perform(post("/api/v1/properties")
                        .with(authentication(ownerAuth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(propReq)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message", containsString("Subscription Expired")));
    }

    @Test
    @DisplayName("Scenario 11: Non-Admin Staff User Login Blocked After Grace Period Expiry")
    public void testStaffLoginBlockedAfterGracePeriod() throws Exception {
        // Set organization subscription to 5 days ago (past 3-day grace period)
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(5));
        billingProfileRepository.save(profile);

        Role managerRole = roleRepository.findByName(ERole.PROPERTY_MANAGER).orElseGet(() -> {
            Role r = new Role(ERole.PROPERTY_MANAGER, "[\"READ\", \"WRITE\"]");
            return roleRepository.save(r);
        });

        String staffEmail = "manager." + UUID.randomUUID().toString().substring(0, 5) + "@grandpg.com";
        User staffUser = new User(testOrg, staffEmail, passwordEncoder.encode("secretPass123"), "9888888888");
        staffUser.setRoles(Set.of(managerRole));
        userRepository.save(staffUser);

        Map<String, String> loginReq = Map.of("email", staffEmail, "password", "secretPass123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsString("grace period has expired")));
    }

    @Test
    @DisplayName("Scenario 12: Owner Login Allowed After Grace Period Expiry for Renewal Payment")
    public void testOwnerLoginAllowedAfterGracePeriodToRenew() throws Exception {
        // Set organization subscription to 5 days ago (past 3-day grace period)
        OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(testOrg).orElseThrow();
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(5));
        billingProfileRepository.save(profile);

        Map<String, String> loginReq = Map.of("email", ownerUser.getEmail(), "password", "pass123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.email", is(ownerUser.getEmail())));
    }
}
