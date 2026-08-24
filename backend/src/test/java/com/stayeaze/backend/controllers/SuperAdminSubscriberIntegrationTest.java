package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminSubscriberIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Organization testOrg;
    private User testOwner;

    @BeforeEach
    void setUp() {
        testOrg = new Organization();
        testOrg.setName("Zenith Living Spaces LLP");
        testOrg.setSubdomain("zenith-living");
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.save(testOrg);

        OrganizationBillingProfile profile = new OrganizationBillingProfile(testOrg);
        profile.setLegalName("Zenith Living Spaces LLP");
        profile.setSubscriptionPlanName("Professional PG Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(2999.0));
        profile.setSubscriptionBillingCycle("MONTHLY");
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(25));
        profileRepository.save(profile);

        Property property = new Property();
        property.setName("Zenith Residency Koramangala");
        property.setAddress("123 Koramangala 4th Block, Bengaluru, Karnataka");
        property.setOrganization(testOrg);
        property.setTotalBeds(120);
        property.setOccupiedBeds(85);
        propertyRepository.save(property);

        Role roleOwner = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[]");
            return roleRepository.save(r);
        });

        testOwner = new User();
        testOwner.setEmail("owner.zenith@stayeaze.com");
        testOwner.setPassword("SecurePass123!");
        testOwner.setFirstName("Vikram Malhotra");
        testOwner.setMobile("9876543219");
        testOwner.setOrganization(testOrg);
        Set<Role> roles = new HashSet<>();
        roles.add(roleOwner);
        testOwner.setRoles(roles);
        userRepository.save(testOwner);
    }

    @Test
    @DisplayName("Super Admin should list subscribers with pagination and search")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetSubscribersList() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers")
                        .param("search", "Zenith")
                        .param("status", "ACTIVE")
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", notNullValue()))
                .andExpect(jsonPath("$.data[0].name", containsString("Zenith Living")))
                .andExpect(jsonPath("$.page", is(1)))
                .andExpect(jsonPath("$.pageSize", is(10)))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalPages", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin should retrieve Organization Intelligence Overview")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetOrganizationOverview() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organization.id", is(testOrg.getId().toString())))
                .andExpect(jsonPath("$.properties", notNullValue()))
                .andExpect(jsonPath("$.quotas", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should update organization status lifecycle")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testUpdateOrganizationStatus() throws Exception {
        Map<String, String> statusPayload = new HashMap<>();
        statusPayload.put("status", "SUSPENDED");

        mockMvc.perform(put("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("SUSPENDED")));
    }

    @Test
    @DisplayName("Super Admin should REJECT invalid status update with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectInvalidSubscriberStatus() throws Exception {
        Map<String, String> statusPayload = new HashMap<>();
        statusPayload.put("status", "NOT_A_VALID_STATUS");

        mockMvc.perform(put("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusPayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid subscriber status")));
    }

    @Test
    @DisplayName("Super Admin should return 404 for non-existent subscriber organization")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testNonExistentSubscriberReturns404() throws Exception {
        UUID nonExistent = UUID.randomUUID();
        mockMvc.perform(get("/api/v1/super-admin/subscribers/" + nonExistent + "/export"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Super Admin should override plan limits for an organization")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testOverrideOrganizationPlan() throws Exception {
        Map<String, Object> overridePayload = new HashMap<>();
        overridePayload.put("planName", "Enterprise PG Plan");
        overridePayload.put("planPrice", 5999.0);
        overridePayload.put("billingCycle", "ANNUAL");
        overridePayload.put("status", "ACTIVE");

        mockMvc.perform(put("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overridePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("overridden successfully")));
    }

    @Test
    @DisplayName("Super Admin should update white-label branding configuration")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testUpdateWhiteLabelBranding() throws Exception {
        Map<String, Object> brandingPayload = new HashMap<>();
        brandingPayload.put("customBrandingEnabled", true);
        brandingPayload.put("brandName", "Zenith Luxury Living");
        brandingPayload.put("brandPrimaryColor", "#6366f1");
        brandingPayload.put("brandLogoUrl", "https://zenithliving.in/logo.png");

        mockMvc.perform(put("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/branding")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(brandingPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("updated successfully")));
    }

    @Test
    @DisplayName("Super Admin should generate support impersonation session")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testSupportImpersonation() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/impersonate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.email", is("owner.zenith@stayeaze.com")));
    }

    @Test
    @DisplayName("Super Admin should export subscriber portfolio to JSON")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testExportSubscriber() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("application/json")));
    }

    @Test
    @DisplayName("Non-Super-Admin (ROLE_OWNER) should be BLOCKED with 403 Forbidden")
    @WithMockUser(roles = "OWNER")
    void testNonSuperAdminBlocked() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/overview"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Super Admin should approve a PENDING_APPROVAL (waitlisted) subscriber and activate it")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testApproveWaitlistedSubscriber() throws Exception {
        // Set org to PENDING_APPROVAL (waitlisted state)
        testOrg.setStatus("PENDING_APPROVAL");
        organizationRepository.save(testOrg);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/approve"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.message", containsString("approved")));

        // Verify org is now ACTIVE
        Organization refreshed = organizationRepository.findById(testOrg.getId()).orElseThrow();
        assert "ACTIVE".equals(refreshed.getStatus());
    }

    @Test
    @DisplayName("Super Admin should reject a subscriber application and mark it REJECTED")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectSubscriberApplication() throws Exception {
        testOrg.setStatus("PENDING_APPROVAL");
        organizationRepository.save(testOrg);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/reject"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.message", containsString("rejected")));

        Organization refreshed = organizationRepository.findById(testOrg.getId()).orElseThrow();
        assert "REJECTED".equals(refreshed.getStatus());
    }

    @Test
    @DisplayName("Super Admin should extend subscriber subscription by specified days")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testExtendSubscription() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .param("days", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.newEndDate", notNullValue()));
    }
}
