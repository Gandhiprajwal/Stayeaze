package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.SaaSPlan;
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
import java.util.HashMap;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminSaaSPlanIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private SaaSPlan existingPlan;

    @BeforeEach
    void setUp() {
        existingPlan = new SaaSPlan();
        existingPlan.setName("Professional Scale");
        existingPlan.setPlanKey("PRO_SCALE");
        existingPlan.setMonthlyPrice(BigDecimal.valueOf(2999.0));
        existingPlan.setAnnualPrice(BigDecimal.valueOf(29990.0));
        existingPlan.setMaxProperties(5);
        existingPlan.setMaxBeds(150);
        existingPlan.setMaxStaffUsers(10);
        existingPlan.setAllowWhatsApp(true);
        existingPlan.setAllowRazorpayOnline(true);
        existingPlan.setAllowCustomBranding(true);
        existingPlan.setIsActive(true);
        existingPlan.setDescription("High capacity plan for multi-property operators");
        existingPlan = saasPlanRepository.save(existingPlan);
    }

    @Test
    @DisplayName("Super Admin should retrieve all SaaS plans")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetAllPlans() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", notNullValue()))
                .andExpect(jsonPath("$[*].planKey", hasItem("PRO_SCALE")));
    }

    @Test
    @DisplayName("Super Admin should create a new SaaS plan tier")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testCreateNewPlan() throws Exception {
        Map<String, Object> newPlanPayload = new HashMap<>();
        newPlanPayload.put("name", "Ultra Enterprise Global");
        newPlanPayload.put("planKey", "ULTRA_GLOBAL");
        newPlanPayload.put("monthlyPrice", 9999.0);
        newPlanPayload.put("annualPrice", 99990.0);
        newPlanPayload.put("maxProperties", 50);
        newPlanPayload.put("maxBeds", 2000);
        newPlanPayload.put("maxStaffUsers", 100);
        newPlanPayload.put("allowWhatsApp", true);
        newPlanPayload.put("allowRazorpayOnline", true);
        newPlanPayload.put("allowCustomBranding", true);
        newPlanPayload.put("isActive", true);
        newPlanPayload.put("description", "Unlimited scaling for enterprise co-living chains");

        mockMvc.perform(post("/api/v1/super-admin/plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newPlanPayload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.planKey", is("ULTRA_GLOBAL")));
    }

    @Test
    @DisplayName("Super Admin should REJECT negative monthly price with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectNegativePrice() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", "Invalid Price Plan");
        payload.put("planKey", "INVALID_PRICE");
        payload.put("monthlyPrice", -500.0);

        mockMvc.perform(post("/api/v1/super-admin/plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("cannot be negative")));
    }

    @Test
    @DisplayName("Super Admin should REJECT zero or negative quotas with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectZeroQuota() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", "Zero Bed Plan");
        payload.put("planKey", "ZERO_BEDS");
        payload.put("maxBeds", 0);

        mockMvc.perform(post("/api/v1/super-admin/plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("quota must be at least 1")));
    }

    @Test
    @DisplayName("Super Admin should REJECT duplicate planKey with 400 Bad Request")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testRejectDuplicatePlanKey() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", "Duplicate Key Plan");
        payload.put("planKey", "PRO_SCALE"); // Already exists

        mockMvc.perform(post("/api/v1/super-admin/plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already exists")));
    }

    @Test
    @DisplayName("Super Admin should update an existing SaaS plan")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testUpdatePlan() throws Exception {
        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("name", "Professional Scale Plus");
        updatePayload.put("monthlyPrice", 3499.0);
        updatePayload.put("annualPrice", 34990.0);
        updatePayload.put("maxProperties", 8);
        updatePayload.put("maxBeds", 200);

        mockMvc.perform(put("/api/v1/super-admin/plans/" + existingPlan.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Super Admin should deactivate a SaaS plan")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testDeletePlan() throws Exception {
        mockMvc.perform(delete("/api/v1/super-admin/plans/" + existingPlan.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("deactivated successfully")));
    }

    @Test
    @DisplayName("Non-Super-Admin (ROLE_PROPERTY_MANAGER) should be BLOCKED with 403 Forbidden")
    @WithMockUser(roles = "PROPERTY_MANAGER")
    void testNonSuperAdminBlocked() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }
}
