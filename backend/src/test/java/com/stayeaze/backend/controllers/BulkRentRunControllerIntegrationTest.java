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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class BulkRentRunControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("BulkRent Org " + System.currentTimeMillis());
        testOrg.setSubdomain("rentorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "rent_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "89" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Billing Admin");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Automated Billing Residency");
        testProperty.setCode("ABR-01");
        testProperty.setType("PG");
        testProperty.setAddress("Cyber City Phase 2");
        testProperty.setCity("Gurugram");
        testProperty.setState("Haryana");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);
    }

    @Test
    @DisplayName("POST /billing/monthly-rent-run - Successfully execute automated monthly invoice run")
    void testExecuteMonthlyRentRun() throws Exception {
        Tenant tenant1 = new Tenant(testOrg, "Aditya", "Roy", "9812345678");
        tenant1.setEmail("aditya@test.com");
        tenant1.setStatus("ACTIVE");
        tenant1.setRent(BigDecimal.valueOf(12000));
        tenant1.setPropertyId(testProperty.getId());
        tenant1.setRoomNumber("101");
        tenant1.setBedNumber("B1");
        tenantRepository.saveAndFlush(tenant1);

        Tenant tenant2 = new Tenant(testOrg, "Pooja", "Hegde", "9823456789");
        tenant2.setEmail("pooja@test.com");
        tenant2.setStatus("ACTIVE");
        tenant2.setRent(BigDecimal.valueOf(15000));
        tenant2.setAdvanceBalance(BigDecimal.valueOf(5000));
        tenant2.setPropertyId(testProperty.getId());
        tenant2.setRoomNumber("102");
        tenant2.setBedNumber("B1");
        tenantRepository.saveAndFlush(tenant2);

        Map<String, Object> request = new HashMap<>();
        request.put("billingMonth", LocalDate.now().getMonthValue());
        request.put("billingYear", LocalDate.now().getYear());
        request.put("dueDateDays", 7);
        request.put("propertyId", testProperty.getId().toString());

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.invoicesGenerated", is(2)))
                .andExpect(jsonPath("$.totalBillingAmount", equalTo(27000)))
                .andExpect(jsonPath("$.totalAdvanceOffset", equalTo(5000)))
                .andExpect(jsonPath("$.totalDueRemaining", equalTo(22000)));
    }

    @Test
    @DisplayName("POST /billing/monthly-rent-run - Reject invalid month number")
    void testInvalidMonth() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put("billingMonth", 13);
        request.put("billingYear", 2026);

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid billing month")));
    }

    @Test
    @DisplayName("POST /billing/monthly-rent-run - Calculate Pro-Rata rent for mid-month move-in")
    void testMidMonthMoveInProRataRun() throws Exception {
        int targetMonth = 8; // August (31 days)
        int targetYear = 2026;
        Tenant midMonthTenant = new Tenant(testOrg, "Rahul", "Verma", "9834567890");
        midMonthTenant.setEmail("rahul@test.com");
        midMonthTenant.setStatus("ACTIVE");
        midMonthTenant.setRent(BigDecimal.valueOf(31000)); // ₹1,000/day for 31-day month
        midMonthTenant.setLeaseStart(LocalDate.of(targetYear, targetMonth, 16).toString()); // 16 days remaining (16th to 31st)
        midMonthTenant.setPropertyId(testProperty.getId());
        midMonthTenant.setRoomNumber("201");
        midMonthTenant.setBedNumber("B1");
        tenantRepository.saveAndFlush(midMonthTenant);

        Map<String, Object> request = new HashMap<>();
        request.put("billingMonth", targetMonth);
        request.put("billingYear", targetYear);
        request.put("dueDateDays", 7);
        request.put("propertyId", testProperty.getId().toString());

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.invoicesGenerated", is(1)))
                .andExpect(jsonPath("$.totalBillingAmount", equalTo(16000))); // 16 days * 1000 = 16,000
    }

    @Test
    @DisplayName("POST /tenants/{tenantId}/invoices/{invoiceId}/payments - Overpayment surplus rolled over to advance balance")
    void testOverpaymentSurplusRollover() throws Exception {
        Tenant tenant = new Tenant(testOrg, "Karan", "Mehra", "9845678901");
        tenant.setEmail("karan@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setRent(BigDecimal.valueOf(8000));
        tenant.setAdvanceBalance(BigDecimal.ZERO);
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        Invoice invoice = new Invoice();
        invoice.setTenant(tenant);
        invoice.setInvoiceNumber("INV-TEST-001");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(5));
        invoice.setAmountDue(BigDecimal.valueOf(8000));
        invoice.setAmountPaid(BigDecimal.ZERO);
        invoice.setStatus("UNPAID");
        invoice = invoiceRepository.saveAndFlush(invoice);

        Map<String, Object> paymentReq = new HashMap<>();
        paymentReq.put("amount", 10000); // Overpaying by ₹2,000
        paymentReq.put("paymentMethod", "CASH");
        paymentReq.put("transactionReference", "CASH-REC-999");

        mockMvc.perform(post("/api/v1/tenants/" + tenant.getId() + "/invoices/" + invoice.getId() + "/payments")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paymentReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.appliedToInvoice", equalTo(8000)))
                .andExpect(jsonPath("$.surplusCreditedToAdvance", equalTo(2000)))
                .andExpect(jsonPath("$.newAdvanceBalance", equalTo(2000)))
                .andExpect(jsonPath("$.invoiceStatus", is("PAID")));

        Tenant refreshed = tenantRepository.findById(tenant.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.valueOf(2000).compareTo(refreshed.getAdvanceBalance()));
    }

    @Test
    @DisplayName("PUT /invoices/{id}/cancel - Cancelling invoice rolls back ADVANCE_OFFSET payments to resident wallet")
    void testCancelInvoiceAdvanceRollback() throws Exception {
        Tenant tenant = new Tenant(testOrg, "Simran", "Kaur", "9856789012");
        tenant.setEmail("simran@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setRent(BigDecimal.valueOf(10000));
        tenant.setAdvanceBalance(BigDecimal.valueOf(1000)); // Had ₹1,000 left
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        Invoice invoice = new Invoice();
        invoice.setTenant(tenant);
        invoice.setInvoiceNumber("INV-TEST-CANCEL");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(5));
        invoice.setAmountDue(BigDecimal.valueOf(10000));
        invoice.setAmountPaid(BigDecimal.valueOf(4000)); // ₹4,000 was offset from advance
        invoice.setStatus("PARTIALLY_PAID");
        invoice = invoiceRepository.saveAndFlush(invoice);

        // Record linked advance offset payment
        Payment advPayment = new Payment(invoice, BigDecimal.valueOf(4000), "ADVANCE_OFFSET");
        paymentRepository.saveAndFlush(advPayment);

        mockMvc.perform(put("/api/v1/invoices/" + invoice.getId() + "/cancel")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.status", is("CANCELLED")))
                .andExpect(jsonPath("$.advanceRefunded", equalTo(4000)))
                .andExpect(jsonPath("$.newAdvanceBalance", equalTo(5000)));

        Tenant refreshed = tenantRepository.findById(tenant.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.valueOf(5000).compareTo(refreshed.getAdvanceBalance()));
    }

    @Test
    @DisplayName("POST /tenants/{tenantId}/payments/lump-sum - Waterfall payments across utility & rent invoices")
    void testLumpSumWaterfallPayment() throws Exception {
        Tenant tenant = new Tenant(testOrg, "Manish", "Gupta", "9867890123");
        tenant.setEmail("manish@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setRent(BigDecimal.valueOf(10000));
        tenant.setAdvanceBalance(BigDecimal.ZERO);
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        // Utility invoice: ₹1,500 due
        Invoice utilInvoice = new Invoice();
        utilInvoice.setTenant(tenant);
        utilInvoice.setInvoiceNumber("UTIL-202608-MANISH");
        utilInvoice.setIssueDate(LocalDate.now());
        utilInvoice.setDueDate(LocalDate.now().plusDays(2));
        utilInvoice.setAmountDue(BigDecimal.valueOf(1500));
        utilInvoice.setAmountPaid(BigDecimal.ZERO);
        utilInvoice.setStatus("UNPAID");
        invoiceRepository.saveAndFlush(utilInvoice);

        // Rent invoice: ₹10,000 due
        Invoice rentInvoice = new Invoice();
        rentInvoice.setTenant(tenant);
        rentInvoice.setInvoiceNumber("INV-202608-MANISH");
        rentInvoice.setIssueDate(LocalDate.now());
        rentInvoice.setDueDate(LocalDate.now().plusDays(5));
        rentInvoice.setAmountDue(BigDecimal.valueOf(10000));
        rentInvoice.setAmountPaid(BigDecimal.ZERO);
        rentInvoice.setStatus("UNPAID");
        invoiceRepository.saveAndFlush(rentInvoice);

        // Resident pays ₹12,000 lump sum (1500 util + 10000 rent + 500 advance surplus)
        Map<String, Object> req = new HashMap<>();
        req.put("amount", 12000);
        req.put("paymentMethod", "UPI");
        req.put("transactionReference", "UPI-WATERFALL-001");

        mockMvc.perform(post("/api/v1/tenants/" + tenant.getId() + "/payments/lump-sum")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.totalPaid", equalTo(12000)))
                .andExpect(jsonPath("$.totalAppliedToInvoices", equalTo(11500)))
                .andExpect(jsonPath("$.surplusCreditedToAdvance", equalTo(500)))
                .andExpect(jsonPath("$.newAdvanceBalance", equalTo(500)))
                .andExpect(jsonPath("$.settledInvoicesCount", equalTo(2)));

        Tenant refreshed = tenantRepository.findById(tenant.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.valueOf(500).compareTo(refreshed.getAdvanceBalance()));
    }

    @Test
    @DisplayName("POST /billing/evaluate-late-fees - Accrues late payment surcharge for overdue invoices")
    void testLateFeeAccrualEngine() throws Exception {
        Tenant tenant = new Tenant(testOrg, "Rahul", "Dravid", "9811223344");
        tenant.setEmail("rahul@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setRent(BigDecimal.valueOf(10000));
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        // Invoice overdue by 10 days (grace period is 5 days)
        Invoice overdueInv = new Invoice();
        overdueInv.setTenant(tenant);
        overdueInv.setInvoiceNumber("INV-OVERDUE-001");
        overdueInv.setIssueDate(LocalDate.now().minusDays(20));
        overdueInv.setDueDate(LocalDate.now().minusDays(10));
        overdueInv.setAmountDue(BigDecimal.valueOf(10000));
        overdueInv.setAmountPaid(BigDecimal.ZERO);
        overdueInv.setStatus("UNPAID");
        invoiceRepository.saveAndFlush(overdueInv);

        mockMvc.perform(post("/api/v1/billing/evaluate-late-fees")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.lateFeesAppliedCount", org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

        Invoice updatedInv = invoiceRepository.findById(overdueInv.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("OVERDUE", updatedInv.getStatus());
        org.junit.jupiter.api.Assertions.assertTrue(updatedInv.getAmountDue().compareTo(BigDecimal.valueOf(10000)) > 0);
    }

    @Test
    @DisplayName("GET /tenants/{id}/financial-statement - Aggregates certified annual HRA ledger")
    void testTenantFinancialStatement() throws Exception {
        Tenant tenant = new Tenant(testOrg, "Ananya", "Pandey", "9822334455");
        tenant.setEmail("ananya@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setRent(BigDecimal.valueOf(12000));
        tenant.setDeposit(BigDecimal.valueOf(24000));
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        Invoice inv = new Invoice();
        inv.setTenant(tenant);
        inv.setInvoiceNumber("INV-HRA-001");
        inv.setIssueDate(LocalDate.now());
        inv.setDueDate(LocalDate.now().plusDays(5));
        inv.setAmountDue(BigDecimal.valueOf(12000));
        inv.setAmountPaid(BigDecimal.valueOf(12000));
        inv.setStatus("PAID");
        invoiceRepository.saveAndFlush(inv);

        mockMvc.perform(get("/api/v1/tenants/" + tenant.getId() + "/financial-statement")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenantName", is("Ananya Pandey")))
                .andExpect(jsonPath("$.monthlyRent", equalTo(12000)))
                .andExpect(jsonPath("$.totalRentPaid", equalTo(12000)))
                .andExpect(jsonPath("$.isHraEligible", is(true)))
                .andExpect(jsonPath("$.statementNumber", notNullValue()));
    }
}
