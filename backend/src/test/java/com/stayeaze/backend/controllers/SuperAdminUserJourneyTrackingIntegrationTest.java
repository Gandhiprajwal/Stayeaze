package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.ERole;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.models.UserJourneyAudit;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserJourneyAuditRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.services.UserJourneyAuditService;
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
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SuperAdminUserJourneyTrackingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserJourneyAuditRepository auditRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserJourneyAuditService auditService;

    @Autowired
    private ObjectMapper objectMapper;

    private Organization testOrg;
    private User testUser;
    private UserJourneyAudit anomalyAudit;

    @BeforeEach
    void setUp() {
        testOrg = new Organization();
        testOrg.setName("Nexus Stay Spaces");
        testOrg.setSubdomain("nexus-stay");
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.save(testOrg);

        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElseGet(() -> {
            Role r = new Role("ROLE_OWNER", "[]");
            return roleRepository.save(r);
        });

        testUser = new User();
        testUser.setEmail("owner.nexus@stayeaze.com");
        testUser.setPassword("Password123!");
        testUser.setMobile("95" + (System.currentTimeMillis() % 100000000L) + (new java.util.Random().nextInt(90) + 10));
        testUser.setOrganization(testOrg);
        testUser.getRoles().add(ownerRole);
        userRepository.save(testUser);

        // 1. Regular auth log
        UserJourneyAudit authAudit = new UserJourneyAudit();
        authAudit.setCategory("AUTH");
        authAudit.setAction("LOGIN_SUCCESS");
        authAudit.setStatus("SUCCESS");
        authAudit.setUserEmail("owner.nexus@stayeaze.com");
        authAudit.setOrganization(testOrg);
        authAudit.setClientIp("192.168.1.50");
        authAudit.setDevice("Chrome 128 / Windows");
        auditRepository.save(authAudit);

        // 2. Critical payment anomaly log
        anomalyAudit = new UserJourneyAudit();
        anomalyAudit.setCategory("SAAS_BILLING");
        anomalyAudit.setAction("PAYMENT_DEDUCTION_ANOMALY");
        anomalyAudit.setStatus("CRITICAL");
        anomalyAudit.setUserEmail("owner.nexus@stayeaze.com");
        anomalyAudit.setOrganization(testOrg);
        anomalyAudit.setResourceId("order_Nx94920492");
        anomalyAudit.setAmount(BigDecimal.valueOf(2999.00));
        anomalyAudit.setDetails("{\"error\":\"Webhook timeout before invoice capture\",\"code\":\"GATEWAY_TIMEOUT\"}");
        anomalyAudit.setClientIp("192.168.1.50");
        anomalyAudit.setDevice("Safari / iPhone iOS 17");
        anomalyAudit = auditRepository.save(anomalyAudit);
    }

    @Test
    @DisplayName("Super Admin can query telemetry events with filters")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetEventsSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/user-tracking/events")
                .param("page", "1")
                .param("pageSize", "20")
                .param("category", "SAAS_BILLING")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].action", is("PAYMENT_DEDUCTION_ANOMALY")))
                .andExpect(jsonPath("$.data[0].status", is("CRITICAL")));
    }

    @Test
    @DisplayName("Super Admin can view telemetry stats counters")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetTelemetryStats() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/user-tracking/stats")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalEvents", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.criticalAnomalies", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Super Admin can fetch critical anomalies list")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetAnomalies() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/user-tracking/anomalies")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].status", is("CRITICAL")));
    }

    @Test
    @DisplayName("Super Admin can trace individual user journey timeline")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testGetUserTimeline() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/user-tracking/user-timeline")
                .param("email", "owner.nexus@stayeaze.com")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    @DisplayName("Super Admin can reconcile and resolve payment transaction anomaly")
    @WithMockUser(roles = "SUPER_ADMIN")
    void testReconcilePayment() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/user-tracking/reconcile/" + anomalyAudit.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("notes", "Verified via Razorpay API"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.audit.status", is("SUCCESS")));
    }

    @Test
    @DisplayName("Unauthorized users cannot access telemetry tracking API")
    @WithMockUser(roles = "TENANT")
    void testAccessDeniedForNonSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/user-tracking/events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}
