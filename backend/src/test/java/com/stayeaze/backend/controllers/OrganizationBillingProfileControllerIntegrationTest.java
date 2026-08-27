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

import java.math.BigDecimal;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class OrganizationBillingProfileControllerIntegrationTest {

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
    private OrganizationBillingProfileRepository profileRepository;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Billing Profile Org " + System.currentTimeMillis());
        testOrg.setSubdomain("bp_org" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "bp_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "86" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Org Owner");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("GET /organization-billing-profile - Retrieve organization billing profile")
    void testGetBillingProfile() throws Exception {
        mockMvc.perform(get("/api/v1/organization-billing-profile")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PUT /organization-billing-profile - Update tax and bank details in billing profile")
    void testUpdateBillingProfile() throws Exception {
        OrganizationBillingProfile profileReq = new OrganizationBillingProfile();
        profileReq.setGstin("29ABCDE1234F1Z5");
        profileReq.setPan("ABCDE1234F");
        profileReq.setBankName("HDFC Bank");
        profileReq.setBankAccountNumber("50100012345678");
        profileReq.setBankIfsc("HDFC0001234");
        profileReq.setDefaultSecurityDeposit(BigDecimal.valueOf(25000));

        mockMvc.perform(put("/api/v1/organization-billing-profile")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(profileReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstin", is("29ABCDE1234F1Z5")))
                .andExpect(jsonPath("$.pan", is("ABCDE1234F")))
                .andExpect(jsonPath("$.bankName", is("HDFC Bank")));
    }

    @Test
    @DisplayName("GET /organization-billing-profile/default-deposit - Retrieve default security deposit")
    void testGetDefaultSecurityDeposit() throws Exception {
        OrganizationBillingProfile bp = new OrganizationBillingProfile(testOrg);
        bp.setDefaultSecurityDeposit(BigDecimal.valueOf(20000));
        profileRepository.saveAndFlush(bp);

        mockMvc.perform(get("/api/v1/organization-billing-profile/default-deposit")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultSecurityDeposit", notNullValue()));
    }
}
