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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminSubscriberApprovalIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Organization pendingOrg1;
    private Organization pendingOrg2;
    private User owner1;
    private User owner2;

    @BeforeEach
    void setUp() {
        Role roleOwner = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[]");
            return roleRepository.save(r);
        });

        // 1. Pending Organization with paid Razorpay fee
        pendingOrg1 = new Organization();
        pendingOrg1.setName("Serene Heights Co-Living");
        pendingOrg1.setSubdomain("serene-heights");
        pendingOrg1.setStatus("PENDING_APPROVAL");
        pendingOrg1 = organizationRepository.save(pendingOrg1);

        OrganizationBillingProfile bp1 = new OrganizationBillingProfile(pendingOrg1);
        bp1.setLegalName("Serene Heights Co-Living Pvt Ltd");
        bp1.setSubscriptionPlanName("Starter PG Plan");
        bp1.setSubscriptionPlanPrice(BigDecimal.valueOf(1499.0));
        bp1.setSubscriptionBillingCycle("MONTHLY");
        bp1.setSubscriptionStatus("PENDING_APPROVAL");
        bp1.setSubscriptionPaymentId("pay_test_serene_12345");
        bp1.setSubscriptionOrderId("order_test_serene_67890");
        profileRepository.save(bp1);

        owner1 = new User();
        owner1.setEmail("serene.owner@stayeaze.com");
        owner1.setPassword("SecureOwnerPass1!");
        owner1.setFirstName("Ramesh Iyer");
        owner1.setMobile("9876543201");
        owner1.setStatus("PENDING");
        owner1.setOrganization(pendingOrg1);
        owner1.setRoles(new HashSet<>(Collections.singletonList(roleOwner)));
        owner1 = userRepository.save(owner1);

        // 2. Pending Organization without payment
        pendingOrg2 = new Organization();
        pendingOrg2.setName("Urban Nest PG");
        pendingOrg2.setSubdomain("urban-nest");
        pendingOrg2.setStatus("PENDING_APPROVAL");
        pendingOrg2 = organizationRepository.save(pendingOrg2);

        OrganizationBillingProfile bp2 = new OrganizationBillingProfile(pendingOrg2);
        bp2.setLegalName("Urban Nest PG");
        bp2.setSubscriptionPlanName("Starter PG Plan");
        bp2.setSubscriptionPlanPrice(BigDecimal.valueOf(1499.0));
        bp2.setSubscriptionStatus("PENDING_APPROVAL");
        profileRepository.save(bp2);

        owner2 = new User();
        owner2.setEmail("urban.owner@stayeaze.com");
        owner2.setPassword("SecureOwnerPass2!");
        owner2.setFirstName("Ananya Deshmukh");
        owner2.setMobile("9876543202");
        owner2.setStatus("PENDING");
        owner2.setOrganization(pendingOrg2);
        owner2.setRoles(new HashSet<>(Collections.singletonList(roleOwner)));
        owner2 = userRepository.save(owner2);
    }

    @Test
    @DisplayName("Super Admin Approves Organization with Default 30-day Validity")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testApproveSubscriberDefault30Days() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + pendingOrg1.getId() + "/approve")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.validityDays").value(30))
                .andExpect(jsonPath("$.subdomain").value("serene-heights"));

        Organization updatedOrg = organizationRepository.findById(pendingOrg1.getId()).orElseThrow();
        assertThat(updatedOrg.getStatus()).isEqualTo("ACTIVE");

        User updatedOwner = userRepository.findById(owner1.getId()).orElseThrow();
        assertThat(updatedOwner.getStatus()).isEqualTo("ACTIVE");

        OrganizationBillingProfile updatedBp = profileRepository.findByOrganization(updatedOrg).orElseThrow();
        assertThat(updatedBp.getSubscriptionStatus()).isEqualTo("ACTIVE");
        assertThat(updatedBp.getSubscriptionEndDate()).isAfter(OffsetDateTime.now().plusDays(28));
    }

    @Test
    @DisplayName("Super Admin Approves Organization with Custom Plan and 90-day Validity")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testApproveSubscriberCustomPlanAndValidity() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("validityDays", 90);
        payload.put("planName", "Enterprise Co-Living");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + pendingOrg2.getId() + "/approve")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.validityDays").value(90))
                .andExpect(jsonPath("$.planName").value("Enterprise Co-Living"));

        Organization updatedOrg = organizationRepository.findById(pendingOrg2.getId()).orElseThrow();
        assertThat(updatedOrg.getStatus()).isEqualTo("ACTIVE");

        OrganizationBillingProfile updatedBp = profileRepository.findByOrganization(updatedOrg).orElseThrow();
        assertThat(updatedBp.getSubscriptionStatus()).isEqualTo("ACTIVE");
        assertThat(updatedBp.getSubscriptionPlanName()).isEqualTo("Enterprise Co-Living");
        assertThat(updatedBp.getSubscriptionEndDate()).isAfter(OffsetDateTime.now().plusDays(85));
    }

    @Test
    @DisplayName("Super Admin Rejects Organization Without Fee (Status REJECTED, User INACTIVE)")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testRejectSubscriberWithoutPayment() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("reason", "Incomplete trade license and fire safety certificate");
        payload.put("autoRefund", false);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + pendingOrg2.getId() + "/reject")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reason").value(containsString("Incomplete trade license")));

        Organization updatedOrg = organizationRepository.findById(pendingOrg2.getId()).orElseThrow();
        assertThat(updatedOrg.getStatus()).isEqualTo("REJECTED");

        User updatedOwner = userRepository.findById(owner2.getId()).orElseThrow();
        assertThat(updatedOwner.getStatus()).isEqualTo("INACTIVE");
    }

    @Test
    @DisplayName("Super Admin Rejects Organization with Razorpay Auto-Refund Handling (Graceful Fallback on test env)")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testRejectSubscriberWithAutomatedRazorpayRefund() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("reason", "Duplicate subdomain registration and applicant request");
        payload.put("autoRefund", true);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + pendingOrg1.getId() + "/reject")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.refundStatus").exists());

        Organization updatedOrg = organizationRepository.findById(pendingOrg1.getId()).orElseThrow();
        assertThat(updatedOrg.getStatus()).isEqualTo("REJECTED");

        User updatedOwner = userRepository.findById(owner1.getId()).orElseThrow();
        assertThat(updatedOwner.getStatus()).isEqualTo("INACTIVE");
    }

    @Test
    @DisplayName("Super Admin Performs Bulk Approval of Multiple Pending Organizations")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testBulkApproveSubscribers() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orgIds", Arrays.asList(pendingOrg1.getId().toString(), pendingOrg2.getId().toString()));
        payload.put("validityDays", 30);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/bulk-approve")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvedCount").value(2))
                .andExpect(jsonPath("$.message").value(containsString("approved and activated 2 organization")));

        Organization org1 = organizationRepository.findById(pendingOrg1.getId()).orElseThrow();
        Organization org2 = organizationRepository.findById(pendingOrg2.getId()).orElseThrow();
        assertThat(org1.getStatus()).isEqualTo("ACTIVE");
        assertThat(org2.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("Super Admin Performs Bulk Rejection of Organizations")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testBulkRejectSubscribers() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orgIds", Arrays.asList(pendingOrg1.getId().toString(), pendingOrg2.getId().toString()));
        payload.put("reason", "Batch KYC deadline elapsed");
        payload.put("autoRefund", true);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/bulk-reject")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejectedCount").value(2))
                .andExpect(jsonPath("$.message").value(containsString("rejected 2 organization")));

        Organization org1 = organizationRepository.findById(pendingOrg1.getId()).orElseThrow();
        Organization org2 = organizationRepository.findById(pendingOrg2.getId()).orElseThrow();
        assertThat(org1.getStatus()).isEqualTo("REJECTED");
        assertThat(org2.getStatus()).isEqualTo("REJECTED");
    }
}
