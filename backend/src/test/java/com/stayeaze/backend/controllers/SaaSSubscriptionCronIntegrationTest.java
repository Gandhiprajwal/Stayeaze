package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.SaaSInvoice;
import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import com.stayeaze.backend.services.SaaSSubscriptionCronService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SaaSSubscriptionCronIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SaaSSubscriptionCronService cronService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private SaaSPlanRepository planRepository;

    private Organization expiringOrg;
    private OrganizationBillingProfile expiringProfile;

    @BeforeEach
    void setUp() {
        SaaSPlan plan = planRepository.findAll().stream().findFirst().orElseGet(() -> {
            SaaSPlan p = new SaaSPlan();
            p.setName("Enterprise Growth");
            p.setPlanKey("ENTERPRISE");
            p.setMonthlyPrice(BigDecimal.valueOf(2999.0));
            p.setAnnualPrice(BigDecimal.valueOf(29990.0));
            p.setMaxProperties(10);
            p.setMaxBeds(250);
            p.setMaxStaffUsers(20);
            p.setIsActive(true);
            return planRepository.save(p);
        });

        expiringOrg = new Organization();
        expiringOrg.setName("Zenith Living Spaces");
        expiringOrg.setSubdomain("zenith-living");
        expiringOrg.setStatus("ACTIVE");
        expiringOrg = organizationRepository.save(expiringOrg);

        expiringProfile = new OrganizationBillingProfile(expiringOrg);
        expiringProfile.setLegalName("Zenith Living Spaces LLP");
        expiringProfile.setSubscriptionPlanName(plan.getName());
        expiringProfile.setSubscriptionPlanPrice(plan.getMonthlyPrice());
        expiringProfile.setSubscriptionBillingCycle("MONTHLY");
        expiringProfile.setSubscriptionStatus("ACTIVE");
        // Expiring in exactly 4 days (within T-5 window)
        expiringProfile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(4));
        expiringProfile = profileRepository.save(expiringProfile);
    }

    @Test
    @DisplayName("Cron should auto-generate UNPAID invoice for subscriber within T-5 window")
    void testCronGeneratesT5Invoice() {
        Map<String, Object> result = cronService.processDailySubscriptionLifecycle();

        assertNotNull(result);
        assertTrue((int) result.get("generatedInvoices") >= 1);

        // Check invoice was generated for expiringOrg
        var invoices = invoiceRepository.findByOrganization(expiringOrg);
        assertFalse(invoices.isEmpty());
        SaaSInvoice inv = invoices.get(0);
        assertEquals("UNPAID", inv.getStatus());
        assertNotNull(inv.getPaymentLink());
        assertTrue(inv.getTotalAmount() > 0);
    }

    @Test
    @DisplayName("Cron should suspend organization when grace period has expired (> 3 days past end date)")
    void testCronSuspendsExpiredOrganizationPastGracePeriod() {
        // Set end date to 5 days ago (past 3 days grace period)
        expiringProfile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(5));
        expiringProfile.setSubscriptionStatus("EXPIRED");
        profileRepository.save(expiringProfile);

        Map<String, Object> result = cronService.processDailySubscriptionLifecycle();

        assertNotNull(result);
        assertTrue((int) result.get("suspendedWorkspaces") >= 1);

        OrganizationBillingProfile updated = profileRepository.findByOrganization(expiringOrg).orElseThrow();
        assertEquals("SUSPENDED", updated.getSubscriptionStatus());
    }

    @Test
    @DisplayName("Reconciling paid invoice should extend subscription end date and restore ACTIVE status")
    void testReconcilePaidSubscription() {
        SaaSInvoice inv = new SaaSInvoice(
                expiringOrg,
                "INV-202608-TEST",
                "Enterprise Growth",
                2999.0,
                539.82,
                3538.82,
                "PAID",
                "MONTHLY",
                OffsetDateTime.now(),
                OffsetDateTime.now().plusMonths(1)
        );
        inv = invoiceRepository.save(inv);

        // Set status suspended
        expiringProfile.setSubscriptionStatus("SUSPENDED");
        profileRepository.save(expiringProfile);

        cronService.reconcilePaidSubscription(inv.getId());

        OrganizationBillingProfile updated = profileRepository.findByOrganization(expiringOrg).orElseThrow();
        assertEquals("ACTIVE", updated.getSubscriptionStatus());
        assertTrue(updated.getSubscriptionEndDate().isAfter(OffsetDateTime.now().plusDays(25)));
    }

    @Test
    @DisplayName("Super Admin should trigger subscription lifecycle cron via REST API")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testTriggerCronEndpoint() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/invoices/trigger-subscription-cron"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evaluatedSubscribers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.timestamp", notNullValue()));
    }
}
