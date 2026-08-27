package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.SafetyIncidentRequest;
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

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SafetyIncidentControllerIntegrationTest {

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
    private SafetyIncidentRepository safetyIncidentRepository;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Safety Org " + System.currentTimeMillis());
        testOrg.setSubdomain("safeorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "safe_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "83" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Safety Officer");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("POST /safety-incidents - Log safety incident")
    void testLogSafetyIncident() throws Exception {
        SafetyIncidentRequest request = new SafetyIncidentRequest();
        request.setReportedBy("Security Guard Ramesh");
        request.setDescription("Minor water leakage near main electrical panel on Ground Floor");
        request.setSeverity("HIGH");

        mockMvc.perform(post("/api/v1/safety-incidents")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reportedBy", is("Security Guard Ramesh")))
                .andExpect(jsonPath("$.severity", is("HIGH")));
    }

    @Test
    @DisplayName("GET /safety-incidents - Retrieve safety incidents")
    void testGetSafetyIncidents() throws Exception {
        SafetyIncident incident = new SafetyIncident(testOrg, "Tenant Neha", "Smoke alarm battery beeping in 4th floor corridor");
        safetyIncidentRepository.saveAndFlush(incident);

        mockMvc.perform(get("/api/v1/safety-incidents")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].reportedBy", is("Tenant Neha")));
    }

    @Test
    @DisplayName("PUT /safety-incidents/{id}/status - Update incident status to RESOLVED")
    void testUpdateIncidentStatus() throws Exception {
        SafetyIncident incident = new SafetyIncident(testOrg, "Warden", "Fire extinguisher pin check");
        incident = safetyIncidentRepository.saveAndFlush(incident);

        mockMvc.perform(put("/api/v1/safety-incidents/" + incident.getId() + "/status")
                        .param("status", "RESOLVED")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("RESOLVED")));
    }
}
