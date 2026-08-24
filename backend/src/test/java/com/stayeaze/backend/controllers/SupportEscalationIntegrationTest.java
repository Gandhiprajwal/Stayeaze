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

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class SupportEscalationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private SupportTicketMessageRepository supportTicketMessageRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private UserJourneyAuditRepository userJourneyAuditRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    private Organization testOrg;
    private User testOwner;
    private SupportTicket testTicket;

    @BeforeEach
    public void setup() {
        Role roleOwner = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[\"ALL\"]");
            return roleRepository.save(r);
        });

        testOrg = new Organization();
        testOrg.setName("Aura Living Coliving " + System.currentTimeMillis());
        testOrg.setSubdomain("aura-" + System.currentTimeMillis());
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.save(testOrg);

        OrganizationBillingProfile profile = new OrganizationBillingProfile(testOrg);
        profile.setLegalName("Aura Coliving Pvt Ltd");
        profile.setSubscriptionPlanName("Enterprise Growth Plan");
        profile.setSubscriptionPlanPrice(BigDecimal.valueOf(4999.0));
        profile.setSubscriptionBillingCycle("MONTHLY");
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(28));
        billingProfileRepository.save(profile);

        Property property = new Property();
        property.setName("Aura Residency HSR");
        property.setAddress("45 HSR Layout Sector 2, Bangalore");
        property.setOrganization(testOrg);
        property.setTotalBeds(80);
        property.setOccupiedBeds(65);
        propertyRepository.save(property);

        testOwner = new User();
        testOwner.setEmail("owner." + testOrg.getSubdomain() + "@test.com");
        testOwner.setPassword("Secure123!");
        testOwner.setMobile("98" + (System.currentTimeMillis() % 100000000L) + (new Random().nextInt(90) + 10));
        testOwner.setOrganization(testOrg);
        testOwner.setStatus("ACTIVE");
        testOwner.setRoles(Set.of(roleOwner));
        testOwner = userRepository.save(testOwner);

        // Record a sample telemetry log for diagnostics
        UserJourneyAudit audit = new UserJourneyAudit();
        audit.setUserId(testOwner.getId());
        audit.setUserEmail(testOwner.getEmail());
        audit.setOrgId(testOrg.getId());
        audit.setOrgName(testOrg.getName());
        audit.setAction("PAYMENT_ORDER_CREATED");
        audit.setCategory("SAAS_BILLING");
        audit.setStatus("SUCCESS");
        audit.setClientIp("127.0.0.1");
        audit.setUserAgent("Mozilla/5.0");
        audit.setResourceId("order_12345");
        audit.setDetails("Razorpay order initialized");
        audit.setCreatedAt(OffsetDateTime.now());
        userJourneyAuditRepository.save(audit);

        testTicket = new SupportTicket(
                "APP-" + System.currentTimeMillis(),
                testOrg,
                testOwner,
                "Payment Webhook Timeout Issue",
                "We paid via UPI but our workspace was not credited with 30 days.",
                "PAYMENT_GATEWAY",
                "HIGH"
        );
        testTicket = supportTicketRepository.save(testTicket);
    }

    @Test
    @DisplayName("Support agent can fetch comprehensive diagnostics for a subscriber ticket")
    @WithMockUser(roles = "SUPPORT")
    public void testGetTicketDiagnosticsAsSupport() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets/" + testTicket.getId() + "/diagnostics")
                        .header("X-Stress-Test", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organization.id", is(testOrg.getId().toString())))
                .andExpect(jsonPath("$.organization.name", is(testOrg.getName())))
                .andExpect(jsonPath("$.subscription.planName", is("Enterprise Growth Plan")))
                .andExpect(jsonPath("$.subscription.daysLeft", notNullValue()))
                .andExpect(jsonPath("$.quotas.totalProperties", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.quotas.totalBeds", is(80)))
                .andExpect(jsonPath("$.quotas.occupiedBeds", is(65)))
                .andExpect(jsonPath("$.telemetryLogs", isA(List.class)));
    }

    @Test
    @DisplayName("Customer/Owner CANNOT access diagnostic data (403 Forbidden)")
    @WithMockUser(roles = "OWNER")
    public void testCustomerCannotAccessDiagnostics() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets/" + testTicket.getId() + "/diagnostics")
                        .header("X-Stress-Test", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Support agent can escalate ticket to Super Admin")
    @WithMockUser(roles = "SUPPORT")
    public void testSupportEscalateTicket() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("escalationCategory", "GATEWAY_RECONCILIATION");
        payload.put("escalationNotes", "Payment confirmed in Razorpay dashboard. Webhook signature failed on receipt.");
        payload.put("requestedAction", "Manually sync payment order pay_XYZ and grant 30 days validity.");

        mockMvc.perform(post("/api/v1/support/tickets/" + testTicket.getId() + "/escalate")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ESCALATED")))
                .andExpect(jsonPath("$.escalated", is(true)))
                .andExpect(jsonPath("$.escalationCategory", is("GATEWAY_RECONCILIATION")));

        // Verify Escalation Marker Message exists in thread
        List<SupportTicketMessage> messages = supportTicketMessageRepository.findByTicketOrderByCreatedAtAsc(testTicket);
        assertFalse(messages.isEmpty());
        assertTrue(messages.stream().anyMatch(m -> m.getMessage().contains("[ESCALATED TO SUPER ADMIN]")));
    }

    @Test
    @DisplayName("Escalation requires non-empty diagnostic notes (400 Bad Request)")
    @WithMockUser(roles = "SUPPORT")
    public void testEscalateFailsWithoutNotes() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("escalationCategory", "CRITICAL_SYSTEM_BUG");
        payload.put("escalationNotes", "   ");

        mockMvc.perform(post("/api/v1/support/tickets/" + testTicket.getId() + "/escalate")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Customer/Owner CANNOT escalate tickets directly (403 Forbidden)")
    @WithMockUser(roles = "OWNER")
    public void testCustomerCannotEscalateTicket() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("escalationCategory", "CRITICAL_SYSTEM_BUG");
        payload.put("escalationNotes", "Hacking attempt");

        mockMvc.perform(post("/api/v1/support/tickets/" + testTicket.getId() + "/escalate")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Super Admin can execute action on escalated ticket")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSuperAdminActionOnEscalatedTicket() throws Exception {
        // Escalate first
        testTicket.setStatus("ESCALATED");
        testTicket.setEscalated(true);
        testTicket.setEscalatedAt(OffsetDateTime.now());
        testTicket.setEscalationCategory("GATEWAY_RECONCILIATION");
        testTicket.setEscalationNotes("Payment captured in Razorpay.");
        supportTicketRepository.save(testTicket);

        Map<String, Object> actionPayload = new HashMap<>();
        actionPayload.put("status", "RESOLVED");
        actionPayload.put("actionNotes", "Verified Razorpay payment ID pay_998877. 30 days added to Aura Coliving.");
        actionPayload.put("resolutionNotes", "Payment successfully reconciled and account renewed.");

        mockMvc.perform(put("/api/v1/support/tickets/" + testTicket.getId() + "/super-admin-action")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(actionPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("RESOLVED")))
                .andExpect(jsonPath("$.superAdminActionNotes", containsString("Verified Razorpay payment ID")));

        // Verify Super Admin Resolution Marker Message exists in thread
        List<SupportTicketMessage> messages = supportTicketMessageRepository.findByTicketOrderByCreatedAtAsc(testTicket);
        assertTrue(messages.stream().anyMatch(m -> m.getMessage().contains("[SUPER ADMIN ACTION EXECUTED]")));
    }

    @Test
    @DisplayName("Non-Super Admin (Support agent) CANNOT execute super-admin-action (403 Forbidden)")
    @WithMockUser(roles = "SUPPORT")
    public void testSupportCannotExecuteSuperAdminAction() throws Exception {
        Map<String, Object> actionPayload = new HashMap<>();
        actionPayload.put("status", "RESOLVED");
        actionPayload.put("actionNotes", "Unauthorized override");

        mockMvc.perform(put("/api/v1/support/tickets/" + testTicket.getId() + "/super-admin-action")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(actionPayload)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Stats endpoint reflects escalatedTickets count")
    @WithMockUser(roles = "SUPPORT")
    public void testStatsIncludesEscalatedTickets() throws Exception {
        testTicket.setStatus("ESCALATED");
        supportTicketRepository.save(testTicket);

        mockMvc.perform(get("/api/v1/support/tickets/stats")
                        .header("X-Stress-Test", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.escalatedTickets", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin can view all tickets in the global centralized queue")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSuperAdminCanViewGlobalTicketQueue() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets")
                        .header("X-Stress-Test", "true")
                        .param("status", "ALL")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[?(@.ticketNumber == '" + testTicket.getTicketNumber() + "')]", not(empty())));
    }

    @Test
    @DisplayName("User with mineOnly=true fetches ONLY tickets created by their account")
    @WithMockUser(username = "nobody.test.user@stayeaze.com", roles = "SUPER_ADMIN")
    public void testStaffWithMineOnlyRetrievesOnlyOwnTickets() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets")
                        .header("X-Stress-Test", "true")
                        .param("mineOnly", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0))); // No tickets created by nobody.test.user@stayeaze.com
    }
}
