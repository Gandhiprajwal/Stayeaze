package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.InquiryRequest;
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

import java.time.LocalDate;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class InquiryControllerIntegrationTest {

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
    private InquiryRepository inquiryRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Inquiry Org " + System.currentTimeMillis());
        testOrg.setSubdomain("inqorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "inq_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "90" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Lead Manager");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Urban Nest PG");
        testProperty.setCode("UNP-01");
        testProperty.setType("PG");
        testProperty.setAddress("Koramangala 5th Block");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);
    }

    @Test
    @DisplayName("POST /inquiries - Capture walk-in prospective tenant lead")
    void testCreateInquiry() throws Exception {
        InquiryRequest request = new InquiryRequest();
        request.setName("Karan Johar");
        request.setMobile("9876501234");
        request.setEmail("karan@test.com");
        request.setGender("MALE");
        request.setPreferredSharing("SINGLE");
        request.setExpectedMoveInDate(LocalDate.now().plusDays(7));
        request.setSource("WALK_IN");
        request.setStatus("NEW");
        request.setPropertyId(testProperty.getId());

        mockMvc.perform(post("/api/v1/inquiries")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name", is("Karan Johar")))
                .andExpect(jsonPath("$.source", is("WALK_IN")));
    }

    @Test
    @DisplayName("GET /inquiries - Retrieve list of inquiries")
    void testGetInquiriesList() throws Exception {
        Inquiry inquiry = new Inquiry(testOrg, "Deepika Padukone", "9811223344");
        inquiry.setEmail("deepika@test.com");
        inquiry.setProperty(testProperty);
        inquiry.setStatus("VISITED");
        inquiryRepository.saveAndFlush(inquiry);

        mockMvc.perform(get("/api/v1/inquiries")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].name", is("Deepika Padukone")));
    }

    @Test
    @DisplayName("PUT /inquiries/{id} - Update inquiry status to CONVERTED")
    void testUpdateInquiryStatus() throws Exception {
        Inquiry inquiry = new Inquiry(testOrg, "Ranveer Singh", "9822334455");
        inquiry.setEmail("ranveer@test.com");
        inquiry.setStatus("NEW");
        inquiry = inquiryRepository.saveAndFlush(inquiry);

        InquiryRequest updateReq = new InquiryRequest();
        updateReq.setName("Ranveer Singh");
        updateReq.setMobile("9822334455");
        updateReq.setEmail("ranveer@test.com");
        updateReq.setStatus("CONVERTED");

        mockMvc.perform(put("/api/v1/inquiries/" + inquiry.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CONVERTED")));
    }
}
