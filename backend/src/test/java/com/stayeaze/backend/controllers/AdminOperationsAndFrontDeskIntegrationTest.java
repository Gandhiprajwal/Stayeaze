package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.ComplaintRequest;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.persistence.EntityManager;
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

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AdminOperationsAndFrontDeskIntegrationTest {

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
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private EntityManager entityManager;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;
    private Property testProperty;
    private Building testBuilding;
    private Tenant testTenant;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Operations Org " + System.currentTimeMillis());
        testOrg.setSubdomain("ops" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_ops_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + String.format("%08d", Math.abs(System.currentTimeMillis() % 100000000L));
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Deepak Joshi");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Emerald Greens");
        testProperty.setCode("EG-01");
        testProperty.setType("HOSTEL");
        testProperty.setAddress("Kalyani Nagar, Pune");
        testProperty.setCity("Pune");
        testProperty.setState("Maharashtra");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testBuilding = new Building();
        testBuilding.setProperty(testProperty);
        testBuilding.setName("Main Wing");
        testBuilding.setCode("MAIN-W");
        testBuilding = buildingRepository.saveAndFlush(testBuilding);

        String tenantMobile = "97" + String.format("%08d", Math.abs(System.currentTimeMillis() % 100000000L));
        testTenant = new Tenant(testOrg, "Vikas", "Patil", tenantMobile);
        testTenant.setEmail("vikas.patil." + System.currentTimeMillis() + "@gmail.com");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("204");
        testTenant.setBedNumber("B1");
        testTenant.setStatus("ACTIVE");
        testTenant.setRent(BigDecimal.valueOf(8000));
        testTenant.setLeaseStart("2026-08-01");
        testTenant = tenantRepository.saveAndFlush(testTenant);

        entityManager.flush();
    }

    @Test
    @DisplayName("Should create complaint, fetch flat list, and update status")
    void testComplaintLifecycleAndChat() throws Exception {
        // 1. Create Complaint under Tenant
        ComplaintRequest req = new ComplaintRequest();
        req.setPropertyId(testProperty.getId());
        req.setCategory("PLUMBING");
        req.setDescription("Hot water not coming in 2nd floor bathroom");

        String complaintResp = mockMvc.perform(post("/api/v1/tenants/" + testTenant.getId() + "/complaints")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category", is("PLUMBING")))
                .andReturn().getResponse().getContentAsString();

        String complaintId = objectMapper.readTree(complaintResp).get("id").asText();

        // 2. Fetch Flat Complaints via GET /api/v1/complaints
        mockMvc.perform(get("/api/v1/complaints")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));

        // 3. Update status to IN_PROGRESS via PUT /api/v1/tenants/{tenantId}/complaints/{id}/status?status=IN_PROGRESS
        mockMvc.perform(put("/api/v1/tenants/" + testTenant.getId() + "/complaints/" + complaintId + "/status")
                        .with(authentication(auth))
                        .param("status", "IN_PROGRESS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", equalToIgnoringCase("IN_PROGRESS")));
    }

    @Test
    @DisplayName("Should log visitor check-in, list visitors, and checkout")
    void testVisitorLifecycle() throws Exception {
        Map<String, Object> req = Map.of(
                "propertyId", testProperty.getId().toString(),
                "visitorName", "Sunil Verma",
                "visitorPhone", "9988776655",
                "purpose", "Family Visit",
                "tenantId", testTenant.getId().toString()
        );

        String visitorResp = mockMvc.perform(post("/api/v1/visitors")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visitorName", is("Sunil Verma")))
                .andExpect(jsonPath("$.status", is("WAITING_APPROVAL")))
                .andReturn().getResponse().getContentAsString();

        String visitorId = objectMapper.readTree(visitorResp).get("id").asText();

        // List visitors via GET /api/v1/visitors
        mockMvc.perform(get("/api/v1/visitors")
                        .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // Checkout visitor via PUT /api/v1/visitors/{id}
        mockMvc.perform(put("/api/v1/visitors/" + visitorId)
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CHECKED_OUT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CHECKED_OUT")));
    }
}
