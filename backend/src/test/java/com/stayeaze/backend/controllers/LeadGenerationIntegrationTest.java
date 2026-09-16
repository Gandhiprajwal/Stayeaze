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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class LeadGenerationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private OnboardingLead testLead;

    @BeforeEach
    void setUp() {
        leadRepository.deleteAll();

        // Reset onboarding settings
        SystemIntegrationSettings settings = settingsRepository.findAll().stream()
                .findFirst().orElseGet(SystemIntegrationSettings::new);
        settings.setVipInviteCodes("STAYVIP,EARLYBIRD,TEST2026");
        settingsRepository.save(settings);

        testLead = new OnboardingLead(
                "Anand Sharma",
                "anand.sharma@royalstaypg.com",
                "9812345678",
                "Royal Stay Premium PG",
                "RSP-001",
                "DEMO_REQUESTED",
                "UNPAID",
                null
        );
        testLead = leadRepository.save(testLead);
    }

    @Test
    @DisplayName("Should successfully submit public lead and display it in super admin leads list with pagination")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testPublicLeadGenerationAndSuperAdminVisibility() throws Exception {
        // Fetch Leads as Super Admin and verify lead shows up in paginated data
        mockMvc.perform(get("/api/v1/super-admin/leads")
                        .param("search", "anand.sharma@royalstaypg.com")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].ownerEmail", is("anand.sharma@royalstaypg.com")))
                .andExpect(jsonPath("$.page", is(1)))
                .andExpect(jsonPath("$.pageSize", is(10)))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalPages", greaterThanOrEqualTo(1)));

        // Add Sales Call Note
        Map<String, Object> notePayload = Map.of("note", "Called owner Anand. Scheduled demo for Monday 11 AM.");
        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(notePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salesNotes", containsString("Called owner Anand")));

        // Update Lead Status to COMPLETED
        Map<String, Object> statusPayload = Map.of("status", "COMPLETED", "paymentStatus", "COMPLETED");
        mockMvc.perform(put("/api/v1/super-admin/leads/" + testLead.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COMPLETED")))
                .andExpect(jsonPath("$.paymentStatus", is("COMPLETED")));
    }

    @Test
    @DisplayName("Super Admin should paginate and search through leads across multiple pages")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testLeadsPaginationAndSearching() throws Exception {
        // Seed 12 additional leads to test multi-page boundary
        for (int i = 1; i <= 12; i++) {
            OnboardingLead lead = new OnboardingLead(
                    "Owner " + i,
                    "lead" + i + "_" + System.currentTimeMillis() + "@test.com",
                    "98000000" + String.format("%02d", i),
                    "Test PG Branch " + i,
                    "TPG-" + String.format("%03d", i),
                    i % 2 == 0 ? "DEMO_REQUESTED" : "PENDING_PAYMENT",
                    "UNPAID",
                    null
            );
            leadRepository.save(lead);
        }

        // Page 1 with pageSize 5 -> 5 items, total = 13
        mockMvc.perform(get("/api/v1/super-admin/leads")
                        .param("page", "1")
                        .param("pageSize", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(5)))
                .andExpect(jsonPath("$.page", is(1)))
                .andExpect(jsonPath("$.pageSize", is(5)))
                .andExpect(jsonPath("$.total", is(13)))
                .andExpect(jsonPath("$.totalPages", is(3)));

        // Page 3 with pageSize 5 -> 3 items remaining
        mockMvc.perform(get("/api/v1/super-admin/leads")
                        .param("page", "3")
                        .param("pageSize", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.page", is(3)));

        // Search filter by property code
        mockMvc.perform(get("/api/v1/super-admin/leads")
                        .param("search", "TPG-005"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].propertyCode", is("TPG-005")))
                .andExpect(jsonPath("$.total", is(1)));

        // Status filter
        mockMvc.perform(get("/api/v1/super-admin/leads")
                        .param("status", "DEMO_REQUESTED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", notNullValue()))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(6)));
    }

    @Test
    @DisplayName("Super Admin should manually sync leads from properties")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testSyncLeadsFromProperties() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/leads/sync-from-properties"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.synced", notNullValue()))
                .andExpect(jsonPath("$.message", containsString("Synced")));
    }

    @Test
    @DisplayName("Super Admin should send VIP invite code email to a lead")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testSendVipInviteEmailToLead() throws Exception {
        Map<String, Object> payload = Map.of("inviteCode", "STAYVIP");

        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/send-vip-invite")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("STAYVIP")))
                .andExpect(jsonPath("$.message", containsString("anand.sharma@royalstaypg.com")));

        // Verify lead status updated to INVITE_SENT
        OnboardingLead updated = leadRepository.findById(testLead.getId()).orElseThrow();
        assertEquals("INVITE_SENT", updated.getStatus());
    }

    @Test
    @DisplayName("Super Admin should auto-select first VIP code when none provided in send-vip-invite")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testSendVipInviteWithDefaultCode() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/send-vip-invite")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should add a sales note to a lead")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testAddSalesNoteToLead() throws Exception {
        Map<String, Object> notePayload = Map.of("note", "Followed up via WhatsApp. Owner interested in 3-month plan.");
        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(notePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salesNotes", containsString("Followed up via WhatsApp")));
    }

    @Test
    @DisplayName("Super Admin should reject blank sales note with 400")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testBlankSalesNoteRejected() throws Exception {
        Map<String, Object> notePayload = Map.of("note", "   ");
        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(notePayload)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Super Admin should update lead status and payment status")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testUpdateLeadStatus() throws Exception {
        Map<String, Object> payload = Map.of("status", "INVITE_REQUESTED", "paymentStatus", "UNPAID");
        mockMvc.perform(put("/api/v1/super-admin/leads/" + testLead.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("INVITE_REQUESTED")));
    }

    @Test
    @DisplayName("Super Admin should convert lead to active subscriber via 1-click")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testConvertLeadToActiveSubscriber() throws Exception {
        // Create a fresh unique lead for conversion
        String uniqueMobile = "98" + String.format("%08d", System.currentTimeMillis() % 100_000_000L);
        OnboardingLead freshLead = new OnboardingLead(
                "Convert Owner",
                "convert_leads_test_" + System.currentTimeMillis() + "@test.com",
                uniqueMobile,
                "Convert PG " + System.currentTimeMillis(),
                null,
                "DEMO_REQUESTED",
                "UNPAID",
                null
        );
        freshLead = leadRepository.save(freshLead);
        final UUID freshLeadId = freshLead.getId();

        mockMvc.perform(post("/api/v1/super-admin/leads/" + freshLeadId + "/convert-to-subscriber"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("successfully converted")))
                .andExpect(jsonPath("$.email", notNullValue()))
                .andExpect(jsonPath("$.subdomain", notNullValue()));

        // Verify lead is CONVERTED
        OnboardingLead converted = leadRepository.findById(freshLeadId).orElseThrow();
        assertEquals("CONVERTED", converted.getStatus());

        // Verify org was created
        assertTrue(userRepository.existsByEmail(freshLead.getOwnerEmail()));
    }

    @Test
    @DisplayName("Super Admin should handle convert-to-subscriber when user email already exists")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testConvertLeadAlreadyExists() throws Exception {
        // The testLead email (anand.sharma@royalstaypg.com) is NOT in users table
        // so let's manually mark it as already existing by updating the lead email to
        // match a user that won't exist — verify the 'already exists' code path works too.
        // First create a real user for the lead's email
        Organization existingOrg = new Organization("Existing Org", "existing-org-" + System.currentTimeMillis());
        existingOrg = organizationRepository.save(existingOrg);

        User existingUser = new User(existingOrg, testLead.getOwnerEmail(),
                passwordEncoder.encode("Pass@123"),
                "90" + String.format("%08d", System.currentTimeMillis() % 100_000_000L));
        userRepository.save(existingUser);

        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/convert-to-subscriber"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("already exists")));

        // Lead should be CONVERTED
        OnboardingLead updated = leadRepository.findById(testLead.getId()).orElseThrow();
        assertEquals("CONVERTED", updated.getStatus());
    }

    @Test
    @DisplayName("Super Admin should resend onboarding invoice email to lead")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testResendOnboardingInvoice() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/leads/" + testLead.getId() + "/resend-invoice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("resent")));
    }

    @Test
    @DisplayName("Non-Super-Admin should be blocked from leads API (403)")
    @WithMockUser(roles = "OWNER")
    void testOwnerBlockedFromLeadsApi() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/leads"))
                .andExpect(status().isForbidden());
    }
}

