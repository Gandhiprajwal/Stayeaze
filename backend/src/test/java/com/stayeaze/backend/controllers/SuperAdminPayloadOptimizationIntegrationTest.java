package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
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
import java.util.Collections;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminPayloadOptimizationIntegrationTest {

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

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private SaaSInvoiceRepository saasInvoiceRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private VisitorRepository visitorRepository;

    private Organization testOrg;
    private User testUser;
    private Tenant testTenant;
    private OnboardingLead testLead;
    private SupportTicket testTicket;
    private SaaSInvoice testInvoice;
    private Visitor testVisitor;

    @BeforeEach
    void setUp() {
        Role superAdminRole = roleRepository.findByName(ERole.SUPER_ADMIN).orElseGet(() -> {
            Role r = new Role("ROLE_SUPER_ADMIN", "[]");
            return roleRepository.save(r);
        });

        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[]");
            return roleRepository.save(r);
        });

        testOrg = new Organization();
        testOrg.setName("Payload Optimization PG");
        testOrg.setSubdomain("payload-opt-pg");
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.saveAndFlush(testOrg);

        testUser = new User(testOrg, "payload_owner@test.com", "SecretPass123!", "9887766554");
        testUser.setFirstName("Payload Owner");
        testUser.setRoles(Collections.singleton(ownerRole));
        testUser = userRepository.saveAndFlush(testUser);

        testTenant = new Tenant();
        testTenant.setOrganization(testOrg);
        testTenant.setFirstName("Opt");
        testTenant.setLastName("Tenant");
        testTenant.setEmail("tenant_opt@test.com");
        testTenant.setMobile("9123456789");
        testTenant = tenantRepository.saveAndFlush(testTenant);

        OrganizationBillingProfile profile = new OrganizationBillingProfile(testOrg);
        profile.setSubscriptionPlanName("Starter PG Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(2999.00));
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionPaymentId("pay_payload_opt_123");
        profile.setSubscriptionOrderId("order_payload_opt_123");
        profile.setGstin("29AAACG1234H1Z5");
        profile.setBrandName("Trimmed Brand Name");
        profile.setBrandLogoUrl("https://example.com/logo.png");
        profile.setBrandPrimaryColor("#123456");
        profile.setRefundId("rfnd_opt_123");
        profile.setRefundStatus("SETTLED_TO_SOURCE");
        profile.setRefundAmount(BigDecimal.valueOf(2999.00));
        profile.setRefundArn("998877665544");
        profile.setRefundSpeed("optimum");
        profile.setRefundErrorCode("ERR_NONE");
        profile.setRefundErrorDescription("Refund settled cleanly");
        profile.setRefundCreatedAt(OffsetDateTime.now());
        profile.setRefundSettledAt(OffsetDateTime.now());
        profileRepository.saveAndFlush(profile);

        testLead = new OnboardingLead();
        testLead.setOwnerName("Lead Owner");
        testLead.setOwnerEmail("lead_owner@test.com");
        testLead.setOwnerPhone("9988776655");
        testLead.setPropertyName("Lead Luxury Residency");
        testLead.setPropertyCode("LUX-001");
        testLead.setStatus("FAILED_ONBOARDING");
        testLead.setPaymentStatus("FAILED");
        testLead.setPaymentFailureCode("BAD_CVV");
        testLead.setPaymentFailureDescription("Card security code invalid");
        testLead.setRecoveryCheckoutUrl("https://stayeaze.com/checkout/recover/lead_123");
        testLead.setPasswordHash("hashed_secret_password");
        testLead = leadRepository.saveAndFlush(testLead);

        testTicket = new SupportTicket("TKT-OPT001", testOrg, testUser, "Optimization Query", "Need clarification on payload size", "TECHNICAL_BUG", "HIGH");
        testTicket.setStatus("OPEN");
        testTicket = supportTicketRepository.saveAndFlush(testTicket);

        testInvoice = new SaaSInvoice(testOrg, "INV-OPT-001", "Starter PG Plan", 2999.0, 539.82, 3538.82, "UNPAID");
        testInvoice = saasInvoiceRepository.saveAndFlush(testInvoice);

        testVisitor = new Visitor(testTenant, "Optimization Visitor", "9876543210");
        testVisitor.setOrganization(testOrg);
        testVisitor = visitorRepository.saveAndFlush(testVisitor);

        for (Organization o : organizationRepository.findAll()) {
            Visitor v = new Visitor(testTenant, "Optimization Visitor", "9876543210");
            v.setOrganization(o);
            visitorRepository.saveAndFlush(v);
        }
    }

    @Test
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    @DisplayName("Verify Refunds Audit endpoint trims unused fields")
    void testRefundsAuditPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/refunds/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].organizationId").exists())
                .andExpect(jsonPath("$.data[0].organizationName").exists())
                .andExpect(jsonPath("$.data[0].refundArn").value("998877665544"))
                // Assert trimmed fields are ABSENT
                .andExpect(jsonPath("$.data[0].subdomain").doesNotExist())
                .andExpect(jsonPath("$.data[0].subscriptionStatus").doesNotExist())
                .andExpect(jsonPath("$.data[0].orderId").doesNotExist())
                .andExpect(jsonPath("$.data[0].refundSpeed").doesNotExist())
                .andExpect(jsonPath("$.data[0].refundErrorCode").doesNotExist())
                .andExpect(jsonPath("$.data[0].refundCreatedAt").doesNotExist())
                .andExpect(jsonPath("$.data[0].refundSettledAt").doesNotExist());
    }

    @Test
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    @DisplayName("Verify Subscribers List endpoint excludes branding and gstin fields")
    void testSubscribersListPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").exists())
                .andExpect(jsonPath("$.data[0].ownerEmail").exists())
                .andExpect(jsonPath("$.data[0].paymentId").exists())
                // Assert branding & enterprise order fields are ABSENT
                .andExpect(jsonPath("$.data[0].orderId").doesNotExist())
                .andExpect(jsonPath("$.data[0].gstin").doesNotExist())
                .andExpect(jsonPath("$.data[0].customBrandingEnabled").doesNotExist())
                .andExpect(jsonPath("$.data[0].brandName").doesNotExist())
                .andExpect(jsonPath("$.data[0].brandLogoUrl").doesNotExist())
                .andExpect(jsonPath("$.data[0].brandPrimaryColor").doesNotExist())
                .andExpect(jsonPath("$.data[0].allowCustomBranding").doesNotExist());
    }

    @Test
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    @DisplayName("Verify Leads endpoint uses LeadSummaryDTO and excludes internal diagnostics")
    void testLeadsPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/leads"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].ownerName").value("Lead Owner"))
                .andExpect(jsonPath("$.data[0].ownerEmail").value("lead_owner@test.com"))
                .andExpect(jsonPath("$.data[0].propertyName").value("Lead Luxury Residency"))
                // Assert internal failure diagnostics & password hash are ABSENT
                .andExpect(jsonPath("$.data[0].paymentFailureCode").doesNotExist())
                .andExpect(jsonPath("$.data[0].paymentFailureDescription").doesNotExist())
                .andExpect(jsonPath("$.data[0].recoveryCheckoutUrl").doesNotExist())
                .andExpect(jsonPath("$.data[0].passwordHash").doesNotExist());
    }

    @Test
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    @DisplayName("Verify Support Tickets List endpoint uses SupportTicketSummaryDTO and excludes nested User password")
    void testSupportTicketsListPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].ticketNumber").value("TKT-OPT001"))
                .andExpect(jsonPath("$.data[0].createdByName").exists())
                .andExpect(jsonPath("$.data[0].createdByEmail").value("payload_owner@test.com"))
                // Assert nested user entity and password are ABSENT
                .andExpect(jsonPath("$.data[0].createdBy").doesNotExist())
                .andExpect(jsonPath("$.data[0].organization").doesNotExist());
    }

    @Test
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    @DisplayName("Verify Support Ticket Detail endpoint uses SupportTicketDetailDTO and excludes nested JPA relationships")
    void testSupportTicketDetailPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets/" + testTicket.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticketNumber").value("TKT-OPT001"))
                .andExpect(jsonPath("$.description").value("Need clarification on payload size"))
                .andExpect(jsonPath("$.createdByName").exists())
                // Assert nested entities are ABSENT
                .andExpect(jsonPath("$.createdBy").doesNotExist())
                .andExpect(jsonPath("$.organization").doesNotExist());
    }

    @Test
    @WithMockUser(username = "superadmin@stayeaze.com", roles = {"SUPER_ADMIN"})
    @DisplayName("Verify SaaS Invoices List endpoint uses SaaSInvoiceSummaryDTO and excludes nested Organization entity")
    void testSaaSInvoiceListPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/invoices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].invoiceNumber").value("INV-OPT-001"))
                .andExpect(jsonPath("$.data[0].organizationName").value("Payload Optimization PG"))
                // Assert nested Organization entity is ABSENT
                .andExpect(jsonPath("$.data[0].organization").doesNotExist());
    }

    @Test
    @WithMockUser(username = "payload_owner@test.com", roles = {"OWNER"})
    @DisplayName("Verify Visitors List endpoint uses VisitorSummaryDTO and excludes nested Organization entity")
    void testVisitorListPayloadTrimming() throws Exception {
        mockMvc.perform(get("/api/v1/visitors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].organization").doesNotExist())
                .andExpect(jsonPath("$.data[0].tenant").doesNotExist())
                .andExpect(jsonPath("$.data[0].property").doesNotExist());
    }
}
