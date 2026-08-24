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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SupportRoleIntegrationTest {

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
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private SubscriptionExtensionRequestRepository extensionRequestRepository;

    private Organization testOrg;
    private User testOwner;
    private User testSupportUser;
    private Tenant testTenant;

    @BeforeEach
    void setupData() {
        Organization systemOrg = organizationRepository.findBySubdomain("system").orElseGet(() -> {
            Organization so = new Organization("StayEaze Platform", "system");
            return organizationRepository.save(so);
        });

        testOrg = organizationRepository.findBySubdomain("zenith-pg").orElseGet(() -> {
            Organization o = new Organization("Zenith Living PG", "zenith-pg");
            return organizationRepository.save(o);
        });

        Role ownerRole = roleRepository.findByName("OWNER").orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));
        Role supportRole = roleRepository.findByName("SUPPORT").orElseGet(() -> roleRepository.save(new Role("SUPPORT", "{}")));

        testOwner = userRepository.findByEmail("owner.zenith@test.com").orElseGet(() -> {
            User u = new User(testOrg, "owner.zenith@test.com", "pass123", "97" + (System.currentTimeMillis() % 100000000L));
            u.setFirstName("Zenith Owner");
            Set<Role> roles = new HashSet<>();
            roles.add(ownerRole);
            u.setRoles(roles);
            return userRepository.save(u);
        });

        testSupportUser = userRepository.findByEmail("support.agent@test.com").orElseGet(() -> {
            User u = new User(systemOrg, "support.agent@test.com", "pass123", "96" + (System.currentTimeMillis() % 100000000L));
            u.setFirstName("Support Agent");
            Set<Role> roles = new HashSet<>();
            roles.add(supportRole);
            u.setRoles(roles);
            return userRepository.save(u);
        });

        testTenant = tenantRepository.findAll().stream()
                .filter(t -> t.getOrganization().getId().equals(testOrg.getId()))
                .findFirst()
                .orElseGet(() -> {
                    Tenant t = new Tenant(testOrg, "Rahul", "Sharma", "9876543212");
                    t.setEmail("rahul.sharma@test.com");
                    return tenantRepository.save(t);
                });
    }

    @Test
    @DisplayName("Owner should raise Application Support Ticket against Platform")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testOwnerCanRaiseSupportTicket() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", "Razorpay webhook signature verification failing");
        payload.put("description", "Auto-debit rent payment webhooks are intermittently failing for Koramangala branch.");
        payload.put("category", "PAYMENT_GATEWAY");
        payload.put("priority", "HIGH");
        payload.put("contactEmail", "owner.zenith@test.com");
        payload.put("contactPhone", "9876543210");

        mockMvc.perform(post("/api/v1/support/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.ticketNumber", startsWith("APP-")))
                .andExpect(jsonPath("$.status", is("OPEN")))
                .andExpect(jsonPath("$.priority", is("HIGH")))
                .andExpect(jsonPath("$.category", is("PAYMENT_GATEWAY")));
    }

    @Test
    @DisplayName("Support role should list and filter all Application Support Tickets across organizations")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanSearchAndListAllSupportTickets() throws Exception {
        SupportTicket ticket = new SupportTicket(
                "APP-202608-9999",
                testOrg,
                testOwner,
                "Need help configuring GSTIN for automated invoice receipts",
                "How to enable 18% GST calculation on deluxe rooms?",
                "BILLING_ISSUE",
                "MEDIUM"
        );
        supportTicketRepository.save(ticket);

        mockMvc.perform(get("/api/v1/support/tickets")
                        .param("search", "GSTIN")
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].ticketNumber", is("APP-202608-9999")))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Support role should triage, assign, and resolve Application Support Ticket with notes")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanTriageAndResolveSupportTicket() throws Exception {
        SupportTicket ticket = new SupportTicket(
                "APP-202608-7777",
                testOrg,
                testOwner,
                "Staff permission issue on room allocation",
                "Receptionist unable to edit floor 2 beds",
                "TECHNICAL_BUG",
                "HIGH"
        );
        SupportTicket saved = supportTicketRepository.save(ticket);

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("status", "RESOLVED");
        updatePayload.put("priority", "HIGH");
        updatePayload.put("resolutionNotes", "Fixed role permissions for Receptionist on Floor 2. Validated and working.");
        updatePayload.put("assignedAgent", "Support Specialist Anita");

        mockMvc.perform(put("/api/v1/support/tickets/" + saved.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("RESOLVED")))
                .andExpect(jsonPath("$.resolutionNotes", containsString("Fixed role permissions")))
                .andExpect(jsonPath("$.assignedAgent", is("Support Specialist Anita")))
                .andExpect(jsonPath("$.resolvedAt", notNullValue()));
    }

    @Test
    @DisplayName("PG Staff (Owner, PM, Receptionist) should manage property tenant complaints")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testOwnerAndStaffCanAccessAndResolveTenantComplaints() throws Exception {
        Complaint complaint = new Complaint(testTenant, "PLUMBING", "Water tap leaking in room 204");
        complaint.setStatus("OPEN");
        Complaint saved = complaintRepository.save(complaint);

        mockMvc.perform(get("/api/v1/complaints"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", notNullValue()));

        Map<String, Object> updateBody = new HashMap<>();
        updateBody.put("status", "RESOLVED");
        updateBody.put("assignedTo", "Building Plumber Ramesh");

        mockMvc.perform(put("/api/v1/complaints/" + saved.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", equalToIgnoringCase("RESOLVED")));
    }

    @Test
    @DisplayName("SECURITY GUARDRAIL: Platform Support should be FORBIDDEN from accessing tenant property complaints")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportForbiddenFromAccessingTenantComplaints() throws Exception {
        Complaint complaint = new Complaint(testTenant, "WIFI", "High latency on 5GHz band");
        complaint.setStatus("OPEN");
        Complaint saved = complaintRepository.save(complaint);

        mockMvc.perform(get("/api/v1/complaints"))
                .andExpect(status().isForbidden());

        Map<String, Object> updateBody = new HashMap<>();
        updateBody.put("status", "RESOLVED");

        mockMvc.perform(put("/api/v1/complaints/" + saved.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Support role should list SaaS subscribers and access overview")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanAccessSubscribersListAndOverview() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers")
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", notNullValue()))
                .andExpect(jsonPath("$.page", is(1)));

        mockMvc.perform(get("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organization.id", notNullValue()));
    }

    @Test
    @DisplayName("Support role validity extension should be ESCALATED to Super Admin as PENDING approval")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportRoleExtensionEscalatedToSuperAdminAsPending() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("additionalDays", 15);
        body.put("reason", "Customer requested courtesy extension during bank reconciliation");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status", is("PENDING_APPROVAL")))
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("escalated to Super Admin for approval")))
                .andExpect(jsonPath("$.request.id", notNullValue()))
                .andExpect(jsonPath("$.request.additionalDays", is(15)));
    }

    @Test
    @DisplayName("Super Admin should review and APPROVE escalated subscription extension request")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = "SUPER_ADMIN")
    void testSuperAdminCanApproveExtensionRequest() throws Exception {
        // 1. Support agent escalates a request
        SubscriptionExtensionRequest request = new SubscriptionExtensionRequest(
                testOrg,
                testSupportUser,
                20,
                "Support grace period request for migration",
                java.time.OffsetDateTime.now()
        );
        SubscriptionExtensionRequest savedReq = extensionRequestRepository.save(request);

        // 2. Super Admin views queue
        mockMvc.perform(get("/api/v1/super-admin/subscribers/extension-requests")
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // 3. Super Admin approves
        Map<String, Object> approveBody = new HashMap<>();
        approveBody.put("notes", "Approved 20 days courtesy extension");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/extension-requests/" + savedReq.getId() + "/approve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(approveBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("approved successfully")))
                .andExpect(jsonPath("$.request.status", is("APPROVED")))
                .andExpect(jsonPath("$.newEndDate", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should review and REJECT escalated subscription extension request")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = "SUPER_ADMIN")
    void testSuperAdminCanRejectExtensionRequest() throws Exception {
        SubscriptionExtensionRequest request = new SubscriptionExtensionRequest(
                testOrg,
                testSupportUser,
                60,
                "Overly long extension request without invoice payment",
                java.time.OffsetDateTime.now()
        );
        SubscriptionExtensionRequest savedReq = extensionRequestRepository.save(request);

        Map<String, Object> rejectBody = new HashMap<>();
        rejectBody.put("notes", "Rejected: Subscriber must clear outstanding invoice first");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/extension-requests/" + savedReq.getId() + "/reject")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rejectBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("rejected")))
                .andExpect(jsonPath("$.request.status", is("REJECTED")));
    }

    @Test
    @DisplayName("SECURITY GUARDRAIL: Support role should be FORBIDDEN from approving extension requests")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportForbiddenFromApprovingExtensions() throws Exception {
        SubscriptionExtensionRequest request = new SubscriptionExtensionRequest(
                testOrg,
                testSupportUser,
                15,
                "Unauthorized self-approval attempt",
                java.time.OffsetDateTime.now()
        );
        SubscriptionExtensionRequest savedReq = extensionRequestRepository.save(request);

        mockMvc.perform(post("/api/v1/super-admin/subscribers/extension-requests/" + savedReq.getId() + "/approve"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Super Admin should directly extend subscriber validity immediately")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = "SUPER_ADMIN")
    void testSuperAdminDirectExtensionImmediate() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("additionalDays", 30);
        body.put("reason", "Direct extension by Super Admin");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ACTIVE")))
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("extended by 30 days successfully")));
    }

    @Test
    @DisplayName("Support role should generate diagnostic impersonation token for troubleshooting")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanImpersonateSubscriberForDiagnostics() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/impersonate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.roles", notNullValue()));
    }

    @Test
    @DisplayName("Support role should view onboarding leads, log sales notes, and send VIP invites")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanAccessLeadsAndLogNotes() throws Exception {
        OnboardingLead lead = new OnboardingLead(
                "Rajesh Verma",
                "rajesh.verma@test.com",
                "9876543299",
                "Orchid PG Suites",
                "PROP-ORCHID-01",
                "DEMO_REQUESTED",
                "UNPAID",
                null
        );
        OnboardingLead savedLead = leadRepository.save(lead);

        mockMvc.perform(get("/api/v1/super-admin/leads")
                        .param("search", "Orchid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        Map<String, String> noteBody = new HashMap<>();
        noteBody.put("note", "Called proprietor Rajesh, scheduled 1-on-1 walkthrough for tomorrow 11 AM.");

        mockMvc.perform(post("/api/v1/super-admin/leads/" + savedLead.getId() + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noteBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salesNotes", containsString("Rajesh")));
    }

    @Test
    @DisplayName("Support role should view API telemetry metrics snapshot and system health")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanViewApiMetricsAndHealth() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/api-metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRequests", notNullValue()));

        mockMvc.perform(get("/api/v1/system/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jvm", notNullValue()));
    }

    @Test
    @DisplayName("Support role should access backend system audit logs")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportCanAccessSystemAuditLogs() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/system-logs"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("SECURITY GUARDRAIL: Support role should be FORBIDDEN from generating SaaS tax invoices")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportForbiddenFromGeneratingSaaSInvoices() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("planName", "ENTERPRISE");
        body.put("amount", 9999.0);

        mockMvc.perform(post("/api/v1/super-admin/invoices/generate/" + testOrg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("SECURITY GUARDRAIL: Support role should be FORBIDDEN from creating SaaS plans")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportForbiddenFromModifyingSaaSPlans() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "UNAUTHORIZED_TIER");
        body.put("monthlyPrice", 5000.0);

        mockMvc.perform(post("/api/v1/super-admin/plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("SECURITY GUARDRAIL: Support role should be FORBIDDEN from triggering database backups")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportForbiddenFromTriggeringBackups() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/backup/export-org/" + testOrg.getId()))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // INPUT DATA VALIDATION & ERROR SCENARIO TESTS (NEGATIVE & POSITIVE)
    // =========================================================================

    @Test
    @DisplayName("DATA VALIDATION: Support extension should REJECT 0 or negative days")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportExtensionRejectsZeroOrNegativeDays() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("additionalDays", 0);
        body.put("reason", "Trying to grant zero days extension");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("between 1 and 365")));

        body.put("additionalDays", -10);
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("DATA VALIDATION: Support extension should REJECT excessive days (>365)")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportExtensionRejectsExcessiveDays() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("additionalDays", 500);
        body.put("reason", "Trying to grant excessive multi-year extension");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("between 1 and 365")));
    }

    @Test
    @DisplayName("DATA VALIDATION: Support extension should REJECT blank or short justification reasons")
    @WithMockUser(username = "support.agent@test.com", roles = "SUPPORT")
    void testSupportExtensionRejectsBlankOrShortReason() throws Exception {
        // Blank reason
        Map<String, Object> body = new HashMap<>();
        body.put("additionalDays", 15);
        body.put("reason", "");

        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("justification reason")));

        // Short reason (< 5 chars)
        body.put("reason", "ok");
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + testOrg.getId() + "/extend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("at least 5 characters")));
    }

    @Test
    @DisplayName("DATA VALIDATION: Ticket creation should REJECT blank title or description")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testSupportTicketRejectsBlankTitleAndDescription() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("title", "");
        body.put("description", "Valid description text");

        mockMvc.perform(post("/api/v1/support/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("title is required")));

        body.put("title", "Valid Title");
        body.put("description", "");
        mockMvc.perform(post("/api/v1/support/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("description is required")));
    }

    @Test
    @DisplayName("STATE VALIDATION: Super Admin should REJECT approving or rejecting already finalized requests")
    @WithMockUser(username = "superadmin@stayeaze.com", roles = "SUPER_ADMIN")
    void testSuperAdminRejectsDoubleActionOnFinalizedRequest() throws Exception {
        // Create an approved request
        SubscriptionExtensionRequest request = new SubscriptionExtensionRequest(
                testOrg,
                testSupportUser,
                15,
                "Request for idempotency test",
                java.time.OffsetDateTime.now()
        );
        request.setStatus("APPROVED");
        SubscriptionExtensionRequest savedReq = extensionRequestRepository.save(request);

        // Attempting to approve again should fail with 400
        mockMvc.perform(post("/api/v1/super-admin/subscribers/extension-requests/" + savedReq.getId() + "/approve"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("already APPROVED")));

        // Attempting to reject already approved should fail with 400
        mockMvc.perform(post("/api/v1/super-admin/subscribers/extension-requests/" + savedReq.getId() + "/reject"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("already APPROVED")));
    }

    @Test
    @DisplayName("USER OWNERSHIP: Customer should ONLY see tickets created by their specific user account")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testCustomerCanOnlySeeTheirOwnCreatedTickets() throws Exception {
        // Create a second customer user
        Role ownerRole = roleRepository.findByName("OWNER").orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));
        User otherOwner = userRepository.findByEmail("other.owner@test.com").orElseGet(() -> {
            User u = new User(testOrg, "other.owner@test.com", "pass123", "9876543299");
            u.setFirstName("Other Owner");
            u.setRoles(Set.of(ownerRole));
            return userRepository.save(u);
        });

        // Ticket 1 by testOwner
        SupportTicket ticket1 = new SupportTicket("APP-TEST-001", testOrg, testOwner, "Zenith Owner Ticket", "Desc 1", "TECHNICAL_BUG", "HIGH");
        supportTicketRepository.save(ticket1);

        // Ticket 2 by otherOwner
        SupportTicket ticket2 = new SupportTicket("APP-TEST-002", testOrg, otherOwner, "Other Owner Ticket", "Desc 2", "BILLING_ISSUE", "LOW");
        supportTicketRepository.save(ticket2);

        // Querying as testOwner should ONLY return ticket1, never ticket2
        mockMvc.perform(get("/api/v1/support/tickets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].ticketNumber", hasItem("APP-TEST-001")))
                .andExpect(jsonPath("$.data[*].ticketNumber", not(hasItem("APP-TEST-002"))));
    }

    @Test
    @DisplayName("SECURITY & ISOLATION: Foreign user is FORBIDDEN (403) from viewing or messaging another user's ticket")
    @WithMockUser(username = "other.owner@test.com", roles = "OWNER")
    void testForeignCustomerForbiddenFromAccessingOrMessagingTicket() throws Exception {
        Organization foreignOrg = organizationRepository.findBySubdomain("foreign-org")
                .orElseGet(() -> organizationRepository.save(new Organization("Foreign Org", "foreign-org")));

        Role ownerRole = roleRepository.findByName("OWNER").orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));
        userRepository.findByEmail("other.owner@test.com").orElseGet(() -> {
            User u = new User(foreignOrg, "other.owner@test.com", "pass123", "9876543298");
            u.setFirstName("Other Owner 2");
            u.setRoles(Set.of(ownerRole));
            return userRepository.save(u);
        });

        // Ticket created by testOwner
        SupportTicket ticket = new SupportTicket("APP-TEST-003", testOrg, testOwner, "Private Issue", "Private Desc", "TECHNICAL_BUG", "MEDIUM");
        SupportTicket savedTicket = supportTicketRepository.save(ticket);

        // other.owner attempts GET -> 403
        mockMvc.perform(get("/api/v1/support/tickets/" + savedTicket.getId()))
                .andExpect(status().isForbidden());

        // other.owner attempts GET messages -> 403
        mockMvc.perform(get("/api/v1/support/tickets/" + savedTicket.getId() + "/messages"))
                .andExpect(status().isForbidden());

        // other.owner attempts POST message -> 403
        Map<String, Object> msg = Map.of("message", "Intruder message");
        mockMvc.perform(post("/api/v1/support/tickets/" + savedTicket.getId() + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(msg)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TWO-WAY CHAT: Support and Ticket Creator can exchange real-time messages in thread")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testTwoWayChatMessagingBetweenSupportAndTicketCreator() throws Exception {
        SupportTicket ticket = new SupportTicket("APP-TEST-004", testOrg, testOwner, "Gateway Webhook Error", "Need help with webhook", "PAYMENT_GATEWAY", "HIGH");
        SupportTicket savedTicket = supportTicketRepository.save(ticket);

        // 1. Owner posts follow-up message
        Map<String, Object> ownerMsg = Map.of("message", "Attaching webhook payload logs for review.");
        mockMvc.perform(post("/api/v1/support/tickets/" + savedTicket.getId() + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ownerMsg)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.senderRole", is("CUSTOMER")))
                .andExpect(jsonPath("$.message", is("Attaching webhook payload logs for review.")));

        // 2. Fetch messages as owner
        mockMvc.perform(get("/api/v1/support/tickets/" + savedTicket.getId() + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("24-HOUR GRACE PERIOD: Ticket creator replying within 24 hours of resolution REOPENS ticket to IN_PROGRESS")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testTicketCreatorCanReplyWithin24HoursOfResolutionReopeningTicket() throws Exception {
        SupportTicket ticket = new SupportTicket("APP-TEST-005", testOrg, testOwner, "Invoice Discrepancy", "Issue with invoice", "BILLING_ISSUE", "MEDIUM");
        ticket.setStatus("RESOLVED");
        ticket.setResolvedAt(java.time.OffsetDateTime.now().minusHours(2)); // Resolved 2 hours ago
        SupportTicket savedTicket = supportTicketRepository.save(ticket);

        Map<String, Object> replyMsg = Map.of("message", "Still seeing duplicate line item on the invoice.");
        mockMvc.perform(post("/api/v1/support/tickets/" + savedTicket.getId() + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(replyMsg)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message", is("Still seeing duplicate line item on the invoice.")));

        // Verify ticket automatically transitioned back to IN_PROGRESS
        SupportTicket reloaded = supportTicketRepository.findById(savedTicket.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("IN_PROGRESS", reloaded.getStatus());
    }

    @Test
    @DisplayName("24-HOUR GRACE PERIOD: Replying AFTER 24 hours of resolution is REJECTED (400) as permanently locked")
    @WithMockUser(username = "owner.zenith@test.com", roles = "OWNER")
    void testTicketCreatorCannotReplyAfter24HoursOfResolution() throws Exception {
        SupportTicket ticket = new SupportTicket("APP-TEST-006", testOrg, testOwner, "Old Resolved Issue", "Old problem", "TECHNICAL_BUG", "LOW");
        ticket.setStatus("RESOLVED");
        ticket.setResolvedAt(java.time.OffsetDateTime.now().minusHours(26)); // Resolved 26 hours ago
        SupportTicket savedTicket = supportTicketRepository.save(ticket);

        Map<String, Object> replyMsg = Map.of("message", "Trying to reply after 26 hours.");
        mockMvc.perform(post("/api/v1/support/tickets/" + savedTicket.getId() + "/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(replyMsg)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("resolved more than 24 hours ago")));
    }

    @Test
    @DisplayName("UNIVERSAL ACCESS: Tenant can raise Application Support Ticket for technical/payment issues")
    @WithMockUser(username = "tenant.rahul@test.com", roles = "TENANT")
    void testTenantCanRaiseApplicationSupportTicket() throws Exception {
        Role tenantRole = roleRepository.findByName("TENANT").orElseGet(() -> roleRepository.save(new Role("TENANT", "{}")));
        User tenantUser = userRepository.findByEmail("tenant.rahul@test.com").orElseGet(() -> {
            User u = new User(testOrg, "tenant.rahul@test.com", "pass123", "9876543299");
            u.setFirstName("Rahul Tenant");
            u.setRoles(Set.of(tenantRole));
            return userRepository.save(u);
        });

        Map<String, Object> payload = Map.of(
                "title", "Mobile Payment Deducted but Booking not Confirmed",
                "description", "UPI payment of Rs 8500 deducted via Razorpay but receipt didn't download.",
                "category", "PAYMENT_GATEWAY",
                "priority", "HIGH"
        );

        mockMvc.perform(post("/api/v1/support/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticketNumber", startsWith("APP-")))
                .andExpect(jsonPath("$.category", is("PAYMENT_GATEWAY")));
    }

    @Test
    @DisplayName("UNIVERSAL ACCESS: Receptionist / Staff can raise Application Support Ticket for app errors")
    @WithMockUser(username = "receptionist.priya@test.com", roles = "RECEPTIONIST")
    void testStaffMemberCanRaiseSupportTicket() throws Exception {
        Role staffRole = roleRepository.findByName("RECEPTIONIST").orElseGet(() -> roleRepository.save(new Role("RECEPTIONIST", "{}")));
        User staffUser = userRepository.findByEmail("receptionist.priya@test.com").orElseGet(() -> {
            User u = new User(testOrg, "receptionist.priya@test.com", "pass123", "9876543297");
            u.setFirstName("Priya Receptionist");
            u.setRoles(Set.of(staffRole));
            return userRepository.save(u);
        });

        Map<String, Object> payload = Map.of(
                "title", "Check-in Visitor QR Scanner Error",
                "description", "Camera stream not initiating on Samsung Galaxy Tab during visitor entry.",
                "category", "TECHNICAL_BUG",
                "priority", "MEDIUM"
        );

        mockMvc.perform(post("/api/v1/support/tickets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticketNumber", startsWith("APP-")))
                .andExpect(jsonPath("$.title", is("Check-in Visitor QR Scanner Error")));
    }
}
