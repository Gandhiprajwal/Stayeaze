package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.PenaltyDiscountRequest;
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
public class PenaltyDiscountControllerIntegrationTest {

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
    private PenaltyDiscountRepository penaltyDiscountRepository;

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
        testOrg.setName("Penalty Org " + System.currentTimeMillis());
        testOrg.setSubdomain("penorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "pen_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "88" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Billing Manager");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Adjustment Suites");
        testProperty.setCode("ADJ-01");
        testProperty.setType("PG");
        testProperty.setAddress("MG Road 2nd Cross");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Varun", "Dhawan", "9855667788");
        testTenant.setEmail("varun@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("201");
        testTenant.setBedNumber("B1");
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("POST /tenants/{tenantId}/penalties-discounts - Apply penalty adjustment")
    void testApplyPenalty() throws Exception {
        PenaltyDiscountRequest request = new PenaltyDiscountRequest();
        request.setType("PENALTY");
        request.setAmount(BigDecimal.valueOf(500));
        request.setDescription("Late fee for delayed payment");

        mockMvc.perform(post("/api/v1/tenants/" + testTenant.getId() + "/penalties-discounts")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type", is("PENALTY")))
                .andExpect(jsonPath("$.amount", equalTo(500)))
                .andExpect(jsonPath("$.status", is("APPLIED")));
    }

    @Test
    @DisplayName("GET /tenants/{tenantId}/penalties-discounts - Retrieve tenant adjustments")
    void testGetAdjustmentsList() throws Exception {
        PenaltyDiscount discount = new PenaltyDiscount(testTenant, "DISCOUNT", BigDecimal.valueOf(1000), "Early bird discount");
        penaltyDiscountRepository.saveAndFlush(discount);

        mockMvc.perform(get("/api/v1/tenants/" + testTenant.getId() + "/penalties-discounts")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].type", is("DISCOUNT")));
    }

    @Test
    @DisplayName("PUT /tenants/{tenantId}/penalties-discounts/{id}/reverse - Reverse adjustment")
    void testReverseAdjustment() throws Exception {
        PenaltyDiscount penalty = new PenaltyDiscount(testTenant, "PENALTY", BigDecimal.valueOf(750), "Damaged key replacement");
        penalty = penaltyDiscountRepository.saveAndFlush(penalty);

        mockMvc.perform(put("/api/v1/tenants/" + testTenant.getId() + "/penalties-discounts/" + penalty.getId() + "/reverse")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("REVERSED")));
    }
}
