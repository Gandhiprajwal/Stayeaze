package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.LoginRequest;
import com.stayeaze.backend.payload.request.RegisterRequest;
import com.stayeaze.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class SuperAdminOnboardingPolicyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private com.stayeaze.backend.security.jwt.JwtUtils jwtUtils;

    private String superAdminToken;

    @BeforeEach
    public void setup() throws Exception {
        // Ensure Super Admin Role & User
        Role superAdminRole = roleRepository.findByName(ERole.SUPER_ADMIN)
                .orElseGet(() -> roleRepository.save(new Role(ERole.SUPER_ADMIN, "[\"ALL\"]")));

        Organization sysOrg = organizationRepository.findBySubdomain("master")
                .orElseGet(() -> organizationRepository.save(new Organization("StayEaze Master Platform", "master")));

        User superAdmin = userRepository.findByEmail("superadmin@stayeaze.com")
                .orElseGet(() -> new User(sysOrg, "superadmin@stayeaze.com", passwordEncoder.encode("Friend@2010"), "0000000000"));
        superAdmin.setPassword(passwordEncoder.encode("Friend@2010"));
        superAdmin.setRoles(Set.of(superAdminRole));
        superAdmin.setIsTwoFactorEnabled(false);
        superAdmin.setStatus("ACTIVE");
        userRepository.save(superAdmin);

        superAdminToken = "Bearer " + jwtUtils.generateTokenFromUsername("superadmin@stayeaze.com");

        // Reset Settings to default
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElseGet(SystemIntegrationSettings::new);
        settings.setOnboardingMode("ENABLED");
        settings.setVipInviteCodes("STAYVIP,EARLYBIRD,TEST2026");
        settingsRepository.save(settings);
    }

    @Test
    @DisplayName("Scenario 1: ENABLED Mode -> Open Signup creates ACTIVE org and allows instant login")
    public void testEnabledMode_DirectActiveRegistrationAndLogin() throws Exception {
        String testEmail = "owner_open_" + System.currentTimeMillis() + "@test.com";

        RegisterRequest req = new RegisterRequest();
        req.setOrgName("Open PG Group " + System.currentTimeMillis());
        req.setOwnerName("John Open");
        req.setEmail(testEmail);
        req.setMobile("98" + String.format("%08d", System.currentTimeMillis() % 100_000_000L));
        req.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.mode").value("ENABLED"));

        // Login succeeds immediately
        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail(testEmail);
        loginReq.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists());
    }

    @Test
    @DisplayName("Scenario 2: WAITLIST Mode -> Creates PENDING_APPROVAL and blocks login until approved")
    public void testWaitlistMode_CreatesPendingApprovalAndBlocksLogin() throws Exception {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElseGet(SystemIntegrationSettings::new);
        settings.setOnboardingMode("WAITLIST");
        settingsRepository.save(settings);

        String testEmail = "owner_waitlist_" + System.currentTimeMillis() + "@test.com";

        RegisterRequest req = new RegisterRequest();
        req.setOrgName("Waitlist PG " + System.currentTimeMillis());
        req.setOwnerName("Alice Waitlist");
        req.setEmail(testEmail);
        req.setMobile("97" + String.format("%08d", (System.currentTimeMillis() + 1) % 100_000_000L));
        req.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WAITLISTED"))
                .andExpect(jsonPath("$.mode").value("WAITLIST"));

        // Login is blocked with 403
        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail(testEmail);
        loginReq.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("waitlist")));
    }

    @Test
    @DisplayName("Scenario 3: Super-Admin Approves Waitlisted Subscriber -> Activates Account and Allows Login")
    public void testSuperAdminApproveWaitlistedSubscriber() throws Exception {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElseGet(SystemIntegrationSettings::new);
        settings.setOnboardingMode("WAITLIST");
        settingsRepository.save(settings);

        String testEmail = "owner_to_approve_" + System.currentTimeMillis() + "@test.com";

        RegisterRequest req = new RegisterRequest();
        req.setOrgName("Approval Target PG " + System.currentTimeMillis());
        req.setOwnerName("Bob Approval");
        req.setEmail(testEmail);
        req.setMobile("96" + String.format("%08d", (System.currentTimeMillis() + 2) % 100_000_000L));
        req.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        User waitlistedUser = userRepository.findByEmail(testEmail).orElseThrow();
        UUID orgId = waitlistedUser.getOrganization().getId();

        // Super-Admin approves subscriber
        mockMvc.perform(post("/api/v1/super-admin/subscribers/" + orgId + "/approve")
                        .header("Authorization", superAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // Login now succeeds!
        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail(testEmail);
        loginReq.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists());
    }

    @Test
    @DisplayName("Scenario 4: DISABLED Mode -> Captures OnboardingLead interactively without 403")
    public void testDisabledMode_CapturesLeadAndDoesNotThrow403() throws Exception {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElseGet(SystemIntegrationSettings::new);
        settings.setOnboardingMode("DISABLED");
        settingsRepository.save(settings);

        String testEmail = "vip_lead_" + System.currentTimeMillis() + "@test.com";

        RegisterRequest req = new RegisterRequest();
        req.setOrgName("VIP Hostels Group " + System.currentTimeMillis());
        req.setOwnerName("Charlie VIP");
        req.setEmail(testEmail);
        req.setMobile("95" + String.format("%08d", (System.currentTimeMillis() + 3) % 100_000_000L));
        req.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LEAD_CAPTURED"))
                .andExpect(jsonPath("$.mode").value("DISABLED"))
                .andExpect(jsonPath("$.leadCode").exists());

        // Verify lead was stored in database
        List<OnboardingLead> leads = leadRepository.findAllByOrderByCreatedAtDesc();
        boolean leadExists = leads.stream().anyMatch(l -> testEmail.equalsIgnoreCase(l.getOwnerEmail()));
        assertTrue(leadExists, "OnboardingLead must be created in database");
    }

    @Test
    @DisplayName("Scenario 5: VIP Invite Code -> Bypasses DISABLED Mode and activates workspace instantly")
    public void testVipInviteCode_BypassesDisabledMode() throws Exception {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElseGet(SystemIntegrationSettings::new);
        settings.setOnboardingMode("DISABLED");
        settings.setVipInviteCodes("STAYVIP,EARLYBIRD");
        settingsRepository.save(settings);

        String testEmail = "vip_bypass_" + System.currentTimeMillis() + "@test.com";

        RegisterRequest req = new RegisterRequest();
        req.setOrgName("VIP Fast Track PG " + System.currentTimeMillis());
        req.setOwnerName("David FastTrack");
        req.setEmail(testEmail);
        req.setMobile("94" + String.format("%08d", (System.currentTimeMillis() + 4) % 100_000_000L));
        req.setPassword("Password123!");
        req.setInviteCode("STAYVIP"); // Fast-track code

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.mode").value("ENABLED"));

        // Login works immediately
        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail(testEmail);
        loginReq.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists());
    }

    @Test
    @DisplayName("Scenario 6: 1-Click Convert Lead to Subscriber in Super-Admin and Login with Chosen Password")
    public void testConvertLeadToSubscriber() throws Exception {
        String testEmail = "convert_lead_" + System.currentTimeMillis() + "@test.com";
        String uniqueMobile = "93" + String.format("%08d", System.currentTimeMillis() % 100_000_000L);
        OnboardingLead lead = new OnboardingLead(
                "Lead Convert Owner",
                testEmail,
                uniqueMobile,
                "Converted Luxury PG " + System.currentTimeMillis(),
                "CONV-" + System.currentTimeMillis(),
                "INVITE_REQUESTED",
                "UNPAID",
                null
        );
        lead.setPasswordHash(passwordEncoder.encode("Password123!"));
        lead = leadRepository.save(lead);

        mockMvc.perform(post("/api/v1/super-admin/leads/" + lead.getId() + "/convert-to-subscriber")
                        .header("Authorization", superAdminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("successfully converted")));

        // Verify lead is marked CONVERTED
        OnboardingLead reloaded = leadRepository.findById(lead.getId()).orElseThrow();
        assertEquals("CONVERTED", reloaded.getStatus());

        // Verify owner can log in immediately with their chosen password!
        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail(testEmail);
        loginReq.setPassword("Password123!");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists());
    }
}
