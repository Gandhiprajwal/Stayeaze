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

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ComplaintChatControllerIntegrationTest {

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
    private TenantRepository tenantRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private ComplaintChatMessageRepository chatMessageRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Tenant testTenant;
    private Complaint testComplaint;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Chat Org " + System.currentTimeMillis());
        testOrg.setSubdomain("chatorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "chat_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "85" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Support Agent");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Chat Support Residency");
        testProperty.setCode("CSR-01");
        testProperty.setType("PG");
        testProperty.setAddress("Whitefield Main Road");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Ishan", "Kishan", "9866778899");
        testTenant.setEmail("ishan@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("301");
        testTenant = tenantRepository.saveAndFlush(testTenant);

        testComplaint = new Complaint(testTenant, "WIFI", "Wi-Fi not connecting on 3rd floor");
        testComplaint = complaintRepository.saveAndFlush(testComplaint);
    }

    @Test
    @DisplayName("POST & GET /complaints/{id}/messages - Send ticket message and retrieve chat history")
    void testSendAndGetComplaintMessages() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("message", "Our technician is inspecting the router right now.");

        mockMvc.perform(post("/api/v1/complaints/" + testComplaint.getId() + "/messages")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("Our technician is inspecting the router right now.")))
                .andExpect(jsonPath("$.senderRole", is("OWNER")));

        mockMvc.perform(get("/api/v1/complaints/" + testComplaint.getId() + "/messages")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].message", is("Our technician is inspecting the router right now.")));
    }
}
