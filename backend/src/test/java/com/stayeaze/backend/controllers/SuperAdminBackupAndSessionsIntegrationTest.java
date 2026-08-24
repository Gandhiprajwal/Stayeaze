package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.RefreshToken;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RefreshTokenRepository;
import com.stayeaze.backend.repository.UserRepository;
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

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminBackupAndSessionsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Organization testOrg;
    private User testUser;
    private RefreshToken testToken;

    @BeforeEach
    void setUp() {
        testOrg = new Organization();
        testOrg.setName("Metro Stays PG");
        testOrg.setSubdomain("metro-stays");
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.save(testOrg);

        testUser = new User();
        testUser.setEmail("staff.metro@stayeaze.com");
        testUser.setPassword("SecureStaff123!");
        testUser.setFirstName("Ramesh Kumar");
        testUser.setMobile("9876543218");
        testUser.setOrganization(testOrg);
        testUser = userRepository.save(testUser);

        testToken = new RefreshToken();
        testToken.setUser(testUser);
        testToken.setToken(UUID.randomUUID().toString());
        testToken.setExpiryDate(OffsetDateTime.now().plusDays(7));
        testToken = refreshTokenRepository.save(testToken);
    }

    @Test
    @DisplayName("Super Admin should export single tenant dataset as JSON")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testExportOrganizationBackup() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/backup/export-org/" + testOrg.getId()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("application/json")))
                .andExpect(jsonPath("$.version", is("1.0")))
                .andExpect(jsonPath("$.organization.name", is("Metro Stays PG")));
    }

    @Test
    @DisplayName("Super Admin should export system-wide snapshot JSON")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testExportSystemSnapshot() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/backup/export-system"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("application/json")))
                .andExpect(jsonPath("$.version", is("1.0")))
                .andExpect(jsonPath("$.totalOrganizations", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin should retrieve all active security sessions")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetActiveSessions() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/sessions")
                        .param("search", "staff.metro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", notNullValue()))
                .andExpect(jsonPath("$[0].userEmail", is("staff.metro@stayeaze.com")));
    }

    @Test
    @DisplayName("Super Admin should revoke an individual active session")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRevokeSession() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/sessions/" + testToken.getId() + "/revoke"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("revoked")));
    }

    @Test
    @DisplayName("Super Admin should execute emergency organization-wide lockout")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testEmergencyLockout() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/sessions/revoke-org/" + testOrg.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Emergency lockout complete")));
    }

    @Test
    @DisplayName("Non-Super-Admin (ROLE_OWNER) should be BLOCKED with 403 Forbidden")
    @WithMockUser(roles = "OWNER")
    void testNonSuperAdminBlocked() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/sessions"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/super-admin/backup/export-system"))
                .andExpect(status().isForbidden());
    }
}
