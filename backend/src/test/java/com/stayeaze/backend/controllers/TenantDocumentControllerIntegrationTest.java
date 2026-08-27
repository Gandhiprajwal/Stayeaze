package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.TenantDocumentRequest;
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
public class TenantDocumentControllerIntegrationTest {

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
    private TenantDocumentRepository tenantDocumentRepository;

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
        testOrg.setName("Doc Org " + System.currentTimeMillis());
        testOrg.setSubdomain("docorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "doc_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "79" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("KYC Officer");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Verification Residency");
        testProperty.setCode("VRF-01");
        testProperty.setType("PG");
        testProperty.setAddress("Koramangala 4th Block");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Jasprit", "Bumrah", "9899001122");
        testTenant.setEmail("jasprit@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("501");
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("POST /tenants/{tenantId}/documents - Upload metadata and document details")
    void testUploadDocument() throws Exception {
        TenantDocumentRequest request = new TenantDocumentRequest();
        request.setDocumentType("AADHAAR");
        request.setDocumentNumber("987654321012");
        request.setFileUrl("https://cdn.stayeaze.com/docs/aadhaar.pdf");

        mockMvc.perform(post("/api/v1/tenants/" + testTenant.getId() + "/documents")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.documentType", is("AADHAAR")))
                .andExpect(jsonPath("$.documentNumber", is("987654321012")));
    }

    @Test
    @DisplayName("GET /tenants/{tenantId}/documents - Retrieve tenant documents")
    void testGetTenantDocuments() throws Exception {
        TenantDocument doc = new TenantDocument(testTenant, "PAN", "ABCDE1234F");
        doc.setFileUrl("https://cdn.stayeaze.com/docs/pan.pdf");
        tenantDocumentRepository.saveAndFlush(doc);

        mockMvc.perform(get("/api/v1/tenants/" + testTenant.getId() + "/documents")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("PUT /tenants/{tenantId}/documents/{id}/verify - Verify KYC document")
    void testVerifyDocument() throws Exception {
        TenantDocument doc = new TenantDocument(testTenant, "PASSPORT", "Z1234567");
        doc = tenantDocumentRepository.saveAndFlush(doc);

        mockMvc.perform(put("/api/v1/tenants/" + testTenant.getId() + "/documents/" + doc.getId() + "/verify")
                        .param("status", "VERIFIED")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus", is("VERIFIED")));
    }
}
