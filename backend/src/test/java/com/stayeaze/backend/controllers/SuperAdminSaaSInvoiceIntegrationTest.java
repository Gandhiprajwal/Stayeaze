package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SaaSInvoice;
import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import com.stayeaze.backend.repository.SaaSPlanRepository;
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
import java.util.HashMap;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminSaaSInvoiceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Organization testOrg;
    private SaaSPlan testPlan;
    private SaaSInvoice testInvoice;

    @BeforeEach
    void setUp() {
        testPlan = saasPlanRepository.findAll().stream().findFirst().orElseGet(() -> {
            SaaSPlan plan = new SaaSPlan();
            plan.setName("Standard Tier");
            plan.setPlanKey("STANDARD");
            plan.setMonthlyPrice(BigDecimal.valueOf(1999.0));
            plan.setAnnualPrice(BigDecimal.valueOf(19990.0));
            plan.setMaxProperties(3);
            plan.setMaxBeds(75);
            plan.setMaxStaffUsers(5);
            plan.setIsActive(true);
            return saasPlanRepository.save(plan);
        });

        testOrg = new Organization();
        testOrg.setName("Serene Heights Co-Living");
        testOrg.setSubdomain("serene-heights");
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.save(testOrg);

        testInvoice = new SaaSInvoice();
        testInvoice.setInvoiceNumber("INV-202608-9999");
        testInvoice.setOrganization(testOrg);
        testInvoice.setPlanName(testPlan.getName());
        testInvoice.setAmount(1000.0);
        testInvoice.setGstAmount(180.0); // 18% GST
        testInvoice.setTotalAmount(1180.0);
        testInvoice.setStatus("PAID");
        testInvoice.setInvoiceDate(OffsetDateTime.now());
        testInvoice.setDueDate(OffsetDateTime.now().plusDays(15));
        testInvoice = invoiceRepository.save(testInvoice);
    }

    @Test
    @DisplayName("Super Admin should list SaaS subscription invoices with server-side pagination")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetInvoicesList() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/invoices")
                        .param("search", "INV-202608-9999")
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", notNullValue()))
                .andExpect(jsonPath("$.data[0].invoiceNumber", is("INV-202608-9999")))
                .andExpect(jsonPath("$.page", is(1)))
                .andExpect(jsonPath("$.pageSize", is(10)))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalPages", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin should filter invoices by date range")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetInvoicesWithDateRangeFilter() throws Exception {
        String fromDate = OffsetDateTime.now().minusDays(2).toString();
        String toDate = OffsetDateTime.now().plusDays(2).toString();

        mockMvc.perform(get("/api/v1/super-admin/invoices")
                        .param("fromDate", fromDate)
                        .param("toDate", toDate)
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", notNullValue()))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)));

        // Future date range should return 0 results
        String futureFrom = OffsetDateTime.now().plusDays(10).toString();
        String futureTo = OffsetDateTime.now().plusDays(20).toString();

        mockMvc.perform(get("/api/v1/super-admin/invoices")
                        .param("fromDate", futureFrom)
                        .param("toDate", futureTo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)))
                .andExpect(jsonPath("$.total", is(0)));
    }

    @Test
    @DisplayName("Super Admin should retrieve aggregated financial and GST ledger stats")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetInvoiceStats() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/invoices/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRevenue", greaterThanOrEqualTo(0.0)))
                .andExpect(jsonPath("$.totalGstLiability", greaterThanOrEqualTo(0.0)))
                .andExpect(jsonPath("$.paidInvoicesCount", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin duplicate check endpoint should detect existing active invoice")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testCheckDuplicateInvoice() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/invoices/check-duplicate/" + testOrg.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasDuplicate", is(true)))
                .andExpect(jsonPath("$.invoiceNumber", is("INV-202608-9999")));
    }

    @Test
    @DisplayName("Super Admin should block duplicate invoice creation without force flag")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testBlockDuplicateInvoiceWithoutForce() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("customAmount", 2000.0);
        payload.put("force", false);

        mockMvc.perform(post("/api/v1/super-admin/invoices/generate/" + testOrg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already exists")));
    }

    @Test
    @DisplayName("Super Admin should REJECT negative custom amount with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectNegativeCustomAmount() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("customAmount", -500.0);
        payload.put("force", true);

        mockMvc.perform(post("/api/v1/super-admin/invoices/generate/" + testOrg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("must be greater than 0")));
    }

    @Test
    @DisplayName("Super Admin should force generate supplementary invoice with 18% GST calculation")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGenerateInvoiceWithForceAndGstCalculation() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("customAmount", 2000.0); // Base price
        payload.put("status", "UNPAID");
        payload.put("planName", "Standard Tier");
        payload.put("force", true);
        payload.put("billingCycle", "MONTHLY");

        mockMvc.perform(post("/api/v1/super-admin/invoices/generate/" + testOrg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount", is(2000.0)))
                .andExpect(jsonPath("$.gstAmount", is(360.0))) // 18% of 2000 = 360
                .andExpect(jsonPath("$.totalAmount", is(2360.0))) // 2000 + 360 = 2360
                .andExpect(jsonPath("$.status", is("UNPAID")))
                .andExpect(jsonPath("$.paymentLink", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should run 1-Click Monthly Batch Billing Run")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRunBatchBilling() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/invoices/batch-generate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSubscribers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.skippedCount", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin should update invoice status")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testUpdateInvoiceStatus() throws Exception {
        Map<String, String> payload = new HashMap<>();
        payload.put("status", "PAID");

        mockMvc.perform(put("/api/v1/super-admin/invoices/" + testInvoice.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("PAID")));
    }

    @Test
    @DisplayName("Super Admin should REJECT invalid status update with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectInvalidStatusUpdate() throws Exception {
        Map<String, String> payload = new HashMap<>();
        payload.put("status", "INVALID_STATUS");

        mockMvc.perform(put("/api/v1/super-admin/invoices/" + testInvoice.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid invoice status")));
    }

    @Test
    @DisplayName("Non-Super-Admin (ROLE_PROPERTY_MANAGER) should be BLOCKED with 403 Forbidden")
    @WithMockUser(roles = "PROPERTY_MANAGER")
    void testNonSuperAdminBlocked() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/invoices"))
                .andExpect(status().isForbidden());
    }
}
