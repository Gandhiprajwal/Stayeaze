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
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class OfflinePaymentApprovalWorkflowIntegrationTest {

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

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;
    private Property testProperty;
    private Tenant testTenant;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Billing Org " + System.currentTimeMillis());
        testOrg.setSubdomain("bill" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_billing_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + (System.currentTimeMillis() % 100000000L);
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Pooja Mehta");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Zenith Palace");
        testProperty.setCode("ZP-01");
        testProperty.setType("HOSTEL");
        testProperty.setAddress("Marine Drive, Nariman Point");
        testProperty.setCity("Mumbai");
        testProperty.setState("Maharashtra");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant();
        testTenant.setOrganization(testOrg);
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setFirstName("Sameer");
        testTenant.setLastName("Verma");
        testTenant.setEmail("sameer.verma." + System.currentTimeMillis() + "@gmail.com");
        testTenant.setMobile("97" + (System.currentTimeMillis() % 100000000L));
        testTenant.setRoomNumber("201");
        testTenant.setBedNumber("B1");
        testTenant.setStatus("VERIFICATION_PENDING");
        testTenant.setRent(BigDecimal.valueOf(12000));
        testTenant.setLeaseStart("2026-08-01");
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("Should fetch pending approval invoices, approve offline UTR payment, update tenant status, and generate receipt")
    void testApproveOfflinePaymentWorkflow() throws Exception {
        // Create an invoice with PENDING_APPROVAL status and UTR reference
        Invoice invoice = new Invoice();
        invoice.setTenant(testTenant);
        invoice.setInvoiceNumber("INV-202608-TEST01");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(5));
        invoice.setAmountDue(BigDecimal.valueOf(12000));
        invoice.setAmountPaid(BigDecimal.ZERO);
        invoice.setStatus("PENDING_APPROVAL");
        invoice.setPaymentMethod("UPI");
        invoice.setPaymentReference("UTR: 98765432109876543210");
        invoice = invoiceRepository.saveAndFlush(invoice);

        // 1. Verify GET /api/v1/invoices/pending-approvals lists this invoice
        mockMvc.perform(get("/api/v1/invoices/pending-approvals")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].invoiceNumber", notNullValue()));

        // 2. Perform Approval via POST /api/v1/invoices/{id}/approve-payment
        mockMvc.perform(post("/api/v1/invoices/" + invoice.getId() + "/approve-payment")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("PAID")))
                .andExpect(jsonPath("$.paidAmount", is(12000)));

        // 3. Verify Database entity state
        Invoice updatedInvoice = invoiceRepository.findById(invoice.getId()).get();
        assertEquals("PAID", updatedInvoice.getStatus());
        assertEquals(0, BigDecimal.valueOf(12000).compareTo(updatedInvoice.getAmountPaid()));

        Tenant updatedTenant = tenantRepository.findById(testTenant.getId()).get();
        assertTrue("READY_FOR_CHECKIN".equalsIgnoreCase(updatedTenant.getStatus()));
    }

    @Test
    @DisplayName("Should reject offline UTR payment, revert status to UNPAID, and record rejection reason")
    void testRejectOfflinePaymentWorkflow() throws Exception {
        Invoice invoice = new Invoice();
        invoice.setTenant(testTenant);
        invoice.setInvoiceNumber("INV-202608-TEST02");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(5));
        invoice.setAmountDue(BigDecimal.valueOf(12000));
        invoice.setAmountPaid(BigDecimal.ZERO);
        invoice.setStatus("PENDING_APPROVAL");
        invoice.setPaymentMethod("UPI");
        invoice.setPaymentReference("UTR: INVALID12345");
        invoice = invoiceRepository.saveAndFlush(invoice);

        // Perform Rejection via POST /api/v1/invoices/{id}/reject-payment
        Map<String, String> payload = Map.of("reason", "Bank statement does not reflect credited amount");

        mockMvc.perform(post("/api/v1/invoices/" + invoice.getId() + "/reject-payment")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UNPAID")));

        Invoice updatedInvoice = invoiceRepository.findById(invoice.getId()).get();
        assertEquals("UNPAID", updatedInvoice.getStatus());
        assertTrue(updatedInvoice.getPaymentReference().contains("REJECTED"));
    }
}
