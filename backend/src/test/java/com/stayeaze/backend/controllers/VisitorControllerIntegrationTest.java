package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
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

import java.time.OffsetDateTime;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class VisitorControllerIntegrationTest {

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
    private VisitorRepository visitorRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private UsernamePasswordAuthenticationToken auth;

    @Autowired
    private TenantRepository tenantRepository;

    private Tenant testTenant;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Visitor Org " + System.currentTimeMillis());
        testOrg.setSubdomain("visorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "vis_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "92" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Gate Admin");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Security Gate Residency");
        testProperty.setCode("SGR-01");
        testProperty.setType("PG");
        testProperty.setAddress("HSR Layout Sector 2");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Rahul", "Dravid", "9911223344");
        testTenant.setEmail("rahul_vis@test.com");
        testTenant.setPropertyId(testProperty.getId());
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("POST /visitors - Log visitor entry at gate")
    void testLogVisitorEntry() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("visitorName", "Amitabh Bachchan");
        payload.put("visitorPhone", "9812345678");
        payload.put("purpose", "Delivery / Meeting");
        payload.put("propertyId", testProperty.getId().toString());
        payload.put("tenantId", testTenant.getId().toString());

        mockMvc.perform(post("/api/v1/visitors")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visitorName", is("Amitabh Bachchan")))
                .andExpect(jsonPath("$.passCode", notNullValue()));
    }

    @Test
    @DisplayName("GET /visitors - Retrieve list of visitors")
    void testGetFlatVisitorsList() throws Exception {
        Visitor v = new Visitor();
        v.setOrganization(testOrg);
        v.setProperty(testProperty);
        v.setTenant(testTenant);
        v.setVisitorName("Sachin Tendulkar");
        v.setMobileNumber("9876543210");
        v.setPurpose("Personal");
        v.setStatus("CHECKED_IN");
        v.setPassCode("654321");
        v.setCheckInTime(OffsetDateTime.now());
        visitorRepository.saveAndFlush(v);

        mockMvc.perform(get("/api/v1/visitors")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("PUT /visitors/{id}/approve & reject - Approve and reject visitor entry")
    void testApproveAndRejectVisitorEntry() throws Exception {
        Visitor v = new Visitor();
        v.setOrganization(testOrg);
        v.setProperty(testProperty);
        v.setTenant(testTenant);
        v.setVisitorName("Sourav Ganguly");
        v.setMobileNumber("9822334455");
        v.setStatus("WAITING_APPROVAL");
        v.setPassCode("123456");
        v = visitorRepository.saveAndFlush(v);

        mockMvc.perform(put("/api/v1/visitors/" + v.getId() + "/approve")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("APPROVED")));

        Map<String, Object> rejectPayload = new HashMap<>();
        rejectPayload.put("reason", "Not available at room");

        mockMvc.perform(put("/api/v1/visitors/" + v.getId() + "/reject")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rejectPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("REJECTED")));
    }

    @Test
    @DisplayName("POST /visitors/verify-pass - Verify gate pass code")
    void testVerifyGatePass() throws Exception {
        Visitor v = new Visitor();
        v.setOrganization(testOrg);
        v.setProperty(testProperty);
        v.setTenant(testTenant);
        v.setVisitorName("Virat Kohli");
        v.setMobileNumber("9833445566");
        v.setStatus("PRE_REGISTERED");
        v.setPassCode("998877");
        v.setQrCodeData("SE-VP-998877");
        visitorRepository.saveAndFlush(v);

        Map<String, String> verifyReq = new HashMap<>();
        verifyReq.put("code", "998877");

        mockMvc.perform(post("/api/v1/visitors/verify-pass")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isValid", is(true)))
                .andExpect(jsonPath("$.visitorName", is("Virat Kohli")));
    }
}
