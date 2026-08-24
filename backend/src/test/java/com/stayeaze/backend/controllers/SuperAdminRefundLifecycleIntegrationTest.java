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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminRefundLifecycleIntegrationTest {

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
    private OnboardingLeadRepository leadRepository;

    private Organization testOrg;
    private OrganizationBillingProfile testProfile;
    private OnboardingLead failedLead;

    @BeforeEach
    void setUp() {
        Role roleOwner = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[]");
            return roleRepository.save(r);
        });

        testOrg = new Organization();
        testOrg.setName("Silver Oaks Co-Living");
        testOrg.setSubdomain("silver-oaks");
        testOrg.setStatus("REJECTED");
        testOrg = organizationRepository.save(testOrg);

        testProfile = new OrganizationBillingProfile(testOrg);
        testProfile.setLegalName("Silver Oaks Co-Living LLP");
        testProfile.setSubscriptionPlanName("Starter PG Plan");
        testProfile.setSubscriptionPlanPrice(BigDecimal.valueOf(1499.0));
        testProfile.setSubscriptionPaymentId("pay_test_silver_9988");
        testProfile.setSubscriptionOrderId("order_test_silver_7766");
        testProfile.setSubscriptionStatus("REFUNDED_AND_REJECTED");
        testProfile.setRefundId("rfnd_test_silver_5544");
        testProfile.setRefundStatus("PROCESSING_BY_BANK");
        testProfile.setRefundAmount(BigDecimal.valueOf(1499.0));
        testProfile.setRefundSpeed("optimum");
        testProfile.setRefundCreatedAt(OffsetDateTime.now());
        testProfile = profileRepository.save(testProfile);

        User owner = new User();
        owner.setEmail("silver.owner@stayeaze.com");
        owner.setPassword("SecureOwnerPass1!");
        owner.setFirstName("Kavita Nair");
        owner.setMobile("9876543209");
        owner.setStatus("INACTIVE");
        owner.setOrganization(testOrg);
        owner.setRoles(new HashSet<>(Collections.singletonList(roleOwner)));
        userRepository.save(owner);

        failedLead = new OnboardingLead(
                "Manoj Sharma",
                "manoj.pg@example.com",
                "9876543210",
                "Manoj PG Residency",
                "MANOJ-01",
                "FAILED_ONBOARDING",
                "FAILED",
                "Card declined by issuing bank"
        );
        failedLead.setPaymentFailureCode("BAD_REQUEST_PAYMENT_DECLINED");
        failedLead.setPaymentFailureDescription("Transaction declined by bank server");
        failedLead = leadRepository.save(failedLead);
    }

    @Test
    @DisplayName("Super Admin Fetches Complete Subscription Refund & Payment Audit Ledger")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testGetRefundsAndPaymentAudit() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/audit")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].refundStatus").exists())
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin Triggers Live Razorpay Status Synchronization")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testSyncLiveRefundStatus() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/refunds/" + testOrg.getId() + "/sync-live-status")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundStatus").exists());
    }

    @Test
    @DisplayName("Super Admin Retries Gateway Refund Execution")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testRetryRefund() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/refunds/" + testOrg.getId() + "/retry")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("Super Admin Retrieves Onboarding Payment Failure Leads")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testGetOnboardingPaymentFailures() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/onboarding-failures")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].failureCode").exists())
                .andExpect(jsonPath("$.data[0].recoveryUrl").exists());
    }

    @Test
    @DisplayName("Super Admin Dispatches 1-Click Payment Recovery Link Email")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testSendPaymentRecoveryLink() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/refunds/send-recovery-link/" + failedLead.getId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(containsString("Payment recovery checkout link emailed")))
                .andExpect(jsonPath("$.recoveryUrl").exists());

        OnboardingLead updated = leadRepository.findById(failedLead.getId()).orElseThrow();
        assertThat(updated.getLastContactedAt()).isNotNull();
    }

    @Test
    @DisplayName("Super Admin Emails Official Settlement & ARN Certificate to Customer")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    void testSendRefundArnReceipt() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/refunds/" + testOrg.getId() + "/send-arn-receipt")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(containsString("Official Settlement & ARN Certificate emailed")));
    }
}
