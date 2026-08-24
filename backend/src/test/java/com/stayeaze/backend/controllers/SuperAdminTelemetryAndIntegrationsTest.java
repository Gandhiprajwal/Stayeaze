package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
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

import java.util.HashMap;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminTelemetryAndIntegrationsTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        settingsRepository.findAll().stream().findFirst().orElseGet(() -> {
            SystemIntegrationSettings s = new SystemIntegrationSettings();
            s.setRedisEnabled(true);
            s.setRedisHost("localhost");
            s.setRedisPort(6379);
            s.setAwsS3Enabled(false);
            s.setRateLimitingEnabled(true);
            s.setMaxRequestsPerSec(100);
            return settingsRepository.save(s);
        });
    }

    @Test
    @DisplayName("Super Admin should retrieve live API Hit Metrics snapshot")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetApiMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/api-metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRequests", notNullValue()))
                .andExpect(jsonPath("$.avgLatencyMs", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should reset API Hit Metrics counters")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testResetApiMetrics() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/api-metrics/reset"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("reset successfully")));
    }

    @Test
    @DisplayName("Super Admin should retrieve System Resource Telemetry & Health")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetSystemTelemetryMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/system/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jvm", notNullValue()))
                .andExpect(jsonPath("$.dbPool", notNullValue()))
                .andExpect(jsonPath("$.services", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should successfully update Settings with valid GSTIN, PAN, Email, Phone, and Tax Rate")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetAndUpdateIntegrationSettingsValid() throws Exception {
        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("saasCompanyName", "StayEaze Technologies India Pvt Ltd");
        updatePayload.put("saasGstin", "29AABCU9603R1ZM"); // Valid 15-char Indian GSTIN
        updatePayload.put("saasPan", "AABCU9603R"); // Valid 10-char PAN
        updatePayload.put("saasSupportEmail", "support@stayeaze.com");
        updatePayload.put("saasSupportPhone", "+919876543210");
        updatePayload.put("saasSacCode", "998314");
        updatePayload.put("invoicePrefix", "SE-INV");
        updatePayload.put("defaultTaxRate", 18.0);
        updatePayload.put("gracePeriodDays", 5);

        mockMvc.perform(put("/api/v1/super-admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saasGstin", is("29AABCU9603R1ZM")))
                .andExpect(jsonPath("$.defaultTaxRate", is(18.0)))
                .andExpect(jsonPath("$.gracePeriodDays", is(5)));
    }

    @Test
    @DisplayName("Super Admin should REJECT malformed GSTIN with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectInvalidGstin() throws Exception {
        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("saasGstin", "INVALID_GSTIN_123");

        mockMvc.perform(put("/api/v1/super-admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid Indian GSTIN format")));
    }

    @Test
    @DisplayName("Super Admin should REJECT malformed PAN with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectInvalidPan() throws Exception {
        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("saasPan", "12345ABCDE");

        mockMvc.perform(put("/api/v1/super-admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid PAN format")));
    }

    @Test
    @DisplayName("Super Admin should REJECT out-of-range tax rate with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectInvalidTaxRate() throws Exception {
        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("defaultTaxRate", 150.0); // > 100%

        mockMvc.perform(put("/api/v1/super-admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("tax rate must be between")));
    }

    @Test
    @DisplayName("Super Admin should REJECT out-of-range grace period with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectInvalidGracePeriod() throws Exception {
        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("gracePeriodDays", 45); // > 30 days

        mockMvc.perform(put("/api/v1/super-admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Grace period must be between")));
    }

    @Test
    @DisplayName("Super Admin should fetch system runtime console log stream")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetSystemLogs() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/system-logs")
                        .param("limit", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin should flush Redis and In-Memory application caches")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testClearAllCaches() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/clear-cache"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("flushed")));
    }

    @Test
    @DisplayName("Non-Super-Admin (ROLE_TENANT) should be BLOCKED with 403 Forbidden")
    @WithMockUser(roles = "TENANT")
    void testNonSuperAdminBlocked() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/settings"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/super-admin/api-metrics"))
                .andExpect(status().isForbidden());
    }
}
