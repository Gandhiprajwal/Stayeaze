package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.ParcelRequest;
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
public class ParcelControllerIntegrationTest {

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
    private ParcelRepository parcelRepository;

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
        testOrg.setName("Parcel Org " + System.currentTimeMillis());
        testOrg.setSubdomain("parorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "par_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "91" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Reception Desk");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Parcel Suites");
        testProperty.setCode("PAR-01");
        testProperty.setType("PG");
        testProperty.setAddress("Bellandur Outer Ring Road");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Arjun", "Kapoor", "9844556677");
        testTenant.setEmail("arjun@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("101");
        testTenant.setBedNumber("B1");
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("POST /tenants/{tenantId}/parcels - Receive incoming courier parcel")
    void testReceiveParcel() throws Exception {
        ParcelRequest request = new ParcelRequest();
        request.setCourierCompany("BlueDart");
        request.setTrackingNumber("BD123456789IN");

        mockMvc.perform(post("/api/v1/tenants/" + testTenant.getId() + "/parcels")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.courierCompany", is("BlueDart")))
                .andExpect(jsonPath("$.status", is("RECEIVED")));
    }

    @Test
    @DisplayName("GET /tenants/{tenantId}/parcels - List tenant parcels")
    void testGetTenantParcels() throws Exception {
        Parcel p = new Parcel(testTenant, "Amazon Logistics");
        p.setTrackingNumber("AMZ998877");
        parcelRepository.saveAndFlush(p);

        mockMvc.perform(get("/api/v1/tenants/" + testTenant.getId() + "/parcels")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].courierCompany", is("Amazon Logistics")));
    }

    @Test
    @DisplayName("PUT /tenants/{tenantId}/parcels/{id}/handover - Handover parcel with signature")
    void testHandoverParcel() throws Exception {
        Parcel p = new Parcel(testTenant, "DTDC");
        p.setTrackingNumber("DTDC112233");
        p = parcelRepository.saveAndFlush(p);

        mockMvc.perform(put("/api/v1/tenants/" + testTenant.getId() + "/parcels/" + p.getId() + "/handover")
                        .param("signature", "ArjunSignatureBase64")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("HANDED_OVER")))
                .andExpect(jsonPath("$.recipientSignature", is("ArjunSignatureBase64")));
    }
}
}
