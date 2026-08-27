package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.AgreementRequest;
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
public class AgreementControllerIntegrationTest {

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
    private AgreementRepository agreementRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Tenant testTenant;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Agreement Org " + System.currentTimeMillis());
        testOrg.setSubdomain("agreeorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "agree_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "80" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Legal Compliance");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Legal Residency");
        testProperty.setCode("LGL-01");
        testProperty.setType("PG");
        testProperty.setAddress("MG Road 5th Phase");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Hardik", "Pandya", "9877889900");
        testTenant.setEmail("hardik@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("401");
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("POST /tenants/{tenantId}/agreements - Draft digital lease agreement")
    void testDraftAgreement() throws Exception {
        AgreementRequest request = new AgreementRequest();
        request.setTerms("Standard 11-month rental agreement with 1-month notice period.");
        request.setStartDate(LocalDate.now());
        request.setEndDate(LocalDate.now().plusMonths(11));
        request.setStatus("DRAFT");

        mockMvc.perform(post("/api/v1/tenants/" + testTenant.getId() + "/agreements")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.terms", containsString("Standard 11-month")))
                .andExpect(jsonPath("$.status", is("DRAFT")));
    }

    @Test
    @DisplayName("GET /tenants/{tenantId}/agreements - List tenant agreements")
    void testGetTenantAgreements() throws Exception {
        Agreement agreement = new Agreement(testTenant, "Terms & Conditions", LocalDate.now(), LocalDate.now().plusMonths(11));
        agreement.setStatus("DRAFT");
        agreementRepository.saveAndFlush(agreement);

        mockMvc.perform(get("/api/v1/tenants/" + testTenant.getId() + "/agreements")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].status", is("DRAFT")));
    }

    @Test
    @DisplayName("PUT /tenants/{tenantId}/agreements/{id}/sign - Sign digital agreement")
    void testSignAgreement() throws Exception {
        Agreement agreement = new Agreement(testTenant, "Terms", LocalDate.now(), LocalDate.now().plusMonths(11));
        agreement.setStatus("DRAFT");
        agreement = agreementRepository.saveAndFlush(agreement);

        mockMvc.perform(put("/api/v1/tenants/" + testTenant.getId() + "/agreements/" + agreement.getId() + "/sign")
                        .param("signatureUrl", "https://cdn.stayeaze.com/signatures/hardik.png")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SIGNED")))
                .andExpect(jsonPath("$.signatureUrl", is("https://cdn.stayeaze.com/signatures/hardik.png")));
    }
}
