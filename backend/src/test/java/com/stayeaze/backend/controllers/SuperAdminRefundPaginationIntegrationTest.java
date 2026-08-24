package com.stayeaze.backend.controllers;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminRefundPaginationIntegrationTest {

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

    private Organization org1;
    private Organization org2;

    @BeforeEach
    void setUp() {
        Role roleOwner = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[]");
            return roleRepository.save(r);
        });

        // Org 1: Settled Refund
        org1 = new Organization();
        org1.setName("Pagination Test Alpha " + System.currentTimeMillis());
        org1.setSubdomain("pagealpha" + System.currentTimeMillis());
        org1.setStatus("REJECTED");
        org1 = organizationRepository.save(org1);

        User u1 = new User();
        u1.setFirstName("Alpha Owner");
        u1.setEmail("alpha." + System.currentTimeMillis() + "@test.com");
        u1.setPassword("Password@123");
        u1.setMobile("98111" + (int)(Math.random() * 89999 + 10000));
        u1.setOrganization(org1);
        u1.setRoles(new HashSet<>(Collections.singletonList(roleOwner)));
        userRepository.save(u1);

        OrganizationBillingProfile p1 = new OrganizationBillingProfile();
        p1.setOrganization(org1);
        p1.setSubscriptionPlanName("Starter PG Plan");
        p1.setSubscriptionPlanPrice(BigDecimal.valueOf(2999.0));
        p1.setSubscriptionStatus("REFUNDED_AND_REJECTED");
        p1.setSubscriptionPaymentId("pay_page_alpha");
        p1.setRefundId("rfnd_page_alpha");
        p1.setRefundStatus("SETTLED_TO_SOURCE");
        p1.setRefundAmount(BigDecimal.valueOf(2999.0));
        p1.setRefundArn("ARN240824000192837482918");
        p1.setRefundSettledAt(OffsetDateTime.now());
        profileRepository.save(p1);

        // Org 2: Active (No Refund)
        org2 = new Organization();
        org2.setName("Pagination Test Beta " + System.currentTimeMillis());
        org2.setSubdomain("pagebeta" + System.currentTimeMillis());
        org2.setStatus("ACTIVE");
        org2 = organizationRepository.save(org2);

        User u2 = new User();
        u2.setFirstName("Beta Owner");
        u2.setEmail("beta." + System.currentTimeMillis() + "@test.com");
        u2.setPassword("Password@123");
        u2.setMobile("98222" + (int)(Math.random() * 89999 + 10000));
        u2.setOrganization(org2);
        u2.setRoles(new HashSet<>(Collections.singletonList(roleOwner)));
        userRepository.save(u2);

        OrganizationBillingProfile p2 = new OrganizationBillingProfile();
        p2.setOrganization(org2);
        p2.setSubscriptionPlanName("Enterprise Plan");
        p2.setSubscriptionPlanPrice(BigDecimal.valueOf(5999.0));
        p2.setSubscriptionStatus("ACTIVE");
        p2.setSubscriptionPaymentId("pay_page_beta");
        p2.setRefundStatus("NO_REFUND");
        profileRepository.save(p2);

        // Failed Lead
        OnboardingLead lead = new OnboardingLead();
        lead.setOwnerName("Dropped Checkout Lead");
        lead.setOwnerEmail("lead." + System.currentTimeMillis() + "@test.com");
        lead.setOwnerPhone("9833312345");
        lead.setPropertyName("Dropped PG Palace");
        lead.setPropertyCode("PG_DROP_" + System.currentTimeMillis());
        lead.setOnboardingFee(BigDecimal.valueOf(1499.0));
        lead.setPaymentStatus("PAYMENT_FAILED");
        lead.setPaymentFailureCode("BAD_REQUEST_PAYMENT_DECLINED");
        lead.setPaymentFailureDescription("Insufficient funds in bank account");
        lead.setStatus("PAYMENT_FAILED");
        leadRepository.save(lead);
    }

    @Test
    @DisplayName("Summary Stats - Returns aggregated metrics correctly")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetRefundsSummaryStats() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/summary-stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscriptionRevenue", greaterThanOrEqualTo(5999.0)))
                .andExpect(jsonPath("$.refundsOnRejection", greaterThanOrEqualTo(2999.0)))
                .andExpect(jsonPath("$.settledToSource", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.droppedCheckouts", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Audit Pagination - Returns PageResponse with content slice and total metadata")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetRefundsAndPaymentAuditPaginated() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/audit")
                        .param("page", "0")
                        .param("size", "5")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", isA(List.class)))
                .andExpect(jsonPath("$.page", is(1)))
                .andExpect(jsonPath("$.pageSize", is(5)))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.totalPages", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Audit Status Filter - Filters records by SETTLED_TO_SOURCE")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetRefundsAndPaymentAuditStatusFilter() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/audit")
                        .param("status", "SETTLED_TO_SOURCE")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", isA(List.class)))
                .andExpect(jsonPath("$.data[0].refundStatus", is("SETTLED_TO_SOURCE")));
    }

    @Test
    @DisplayName("Onboarding Failures Pagination - Returns paginated dropped checkouts")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetOnboardingPaymentFailuresPaginated() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/onboarding-failures")
                        .param("page", "0")
                        .param("size", "10")
                        .param("search", "Dropped")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", isA(List.class)))
                .andExpect(jsonPath("$.data[0].ownerName", containsString("Dropped Checkout Lead")))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Fast-Path Live Sync - Returns settled status instantly without blocking")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testFastPathSyncLiveRefundStatus() throws Exception {
        long start = System.currentTimeMillis();
        mockMvc.perform(post("/api/v1/super-admin/subscribers/refunds/" + org1.getId() + "/sync-live-status")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundStatus", is("SETTLED_TO_SOURCE")))
                .andExpect(jsonPath("$.refundArn", is("ARN240824000192837482918")));
        long elapsed = System.currentTimeMillis() - start;
        org.junit.jupiter.api.Assertions.assertTrue(elapsed < 2000, "Fast-path took too long: " + elapsed + "ms");
    }
}
