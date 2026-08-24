package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.PropertyRequest;
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

import java.util.Collections;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AdminOwnerWorkflowIntegrationTest {

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

    private Organization testOrg;
    private User adminUser;

    @BeforeEach
    void setUp() {
        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ADMIN", "{}")));

        testOrg = new Organization("Apex Co-Living Systems", "apex" + System.currentTimeMillis());
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.save(testOrg);

        String email = "admin_apex_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "97766" + (System.currentTimeMillis() % 100000);
        adminUser = new User(testOrg, email, "password123", mobile);
        adminUser.setFirstName("Apex Admin");
        adminUser.setRoles(new java.util.HashSet<>(Collections.singleton(adminRole)));
        adminUser = userRepository.save(adminUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(adminUser);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("POST /api/v1/properties - Create property under Admin/Owner organization")
    void testCreatePropertyByAdmin() throws Exception {
        PropertyRequest req = new PropertyRequest();
        req.setName("Apex Cyber City PG");
        req.setCode("APX-01");
        req.setType("PG");
        req.setAddress("DLF Phase 3, Gurugram");
        req.setCity("Gurugram");
        req.setState("Haryana");
        req.setPincode("122002");
        req.setPhone("9811223344");
        req.setEmail("contact@apexpg.com");

        mockMvc.perform(post("/api/v1/properties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name", is("Apex Cyber City PG")));
    }

    @Test
    @DisplayName("GET /api/v1/properties/minimal - Return lightweight DTOs for fast dropdown rendering")
    void testGetMinimalProperties() throws Exception {
        Property prop = new Property();
        prop.setName("Apex Executive Residency");
        prop.setCode("APX-02");
        prop.setOrganization(testOrg);
        prop.setAddress("Cyber Hub, Gurugram");
        prop.setCity("Gurugram");
        prop.setState("Haryana");
        propertyRepository.save(prop);

        mockMvc.perform(get("/api/v1/properties/minimal")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }
}
