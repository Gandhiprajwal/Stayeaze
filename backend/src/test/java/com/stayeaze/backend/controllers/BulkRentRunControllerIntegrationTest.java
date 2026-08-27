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
public class BulkRentRunControllerIntegrationTest {

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
    private InvoiceRepository invoiceRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("BulkRent Org " + System.currentTimeMillis());
        testOrg.setSubdomain("rentorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "rent_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "89" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Billing Admin");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Automated Billing Residency");
        testProperty.setCode("ABR-01");
        testProperty.setType("PG");
        testProperty.setAddress("Cyber City Phase 2");
        testProperty.setCity("Gurugram");
        testProperty.setState("Haryana");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);
    }

    @Test
    @DisplayName("POST /billing/monthly-rent-run - Successfully execute automated monthly invoice run")
    void testExecuteMonthlyRentRun() throws Exception {
        Tenant tenant1 = new Tenant(testOrg, "Aditya", "Roy", "9812345678");
        tenant1.setEmail("aditya@test.com");
        tenant1.setStatus("ACTIVE");
        tenant1.setRent(BigDecimal.valueOf(12000));
        tenant1.setPropertyId(testProperty.getId());
        tenant1.setRoomNumber("101");
        tenant1.setBedNumber("B1");
        tenantRepository.saveAndFlush(tenant1);

        Tenant tenant2 = new Tenant(testOrg, "Pooja", "Hegde", "9823456789");
        tenant2.setEmail("pooja@test.com");
        tenant2.setStatus("ACTIVE");
        tenant2.setRent(BigDecimal.valueOf(15000));
        tenant2.setAdvanceBalance(BigDecimal.valueOf(5000));
        tenant2.setPropertyId(testProperty.getId());
        tenant2.setRoomNumber("102");
        tenant2.setBedNumber("B1");
        tenantRepository.saveAndFlush(tenant2);

        Map<String, Object> request = new HashMap<>();
        request.put("billingMonth", LocalDate.now().getMonthValue());
        request.put("billingYear", LocalDate.now().getYear());
        request.put("dueDateDays", 7);
        request.put("propertyId", testProperty.getId().toString());

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.invoicesGenerated", is(2)))
                .andExpect(jsonPath("$.totalBillingAmount", equalTo(27000)))
                .andExpect(jsonPath("$.totalAdvanceOffset", equalTo(5000)))
                .andExpect(jsonPath("$.totalDueRemaining", equalTo(22000)));
    }

    @Test
    @DisplayName("POST /billing/monthly-rent-run - Reject invalid month number")
    void testInvalidMonth() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put("billingMonth", 13);
        request.put("billingYear", 2026);

        mockMvc.perform(post("/api/v1/billing/monthly-rent-run")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid billing month")));
    }
}
