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
public class CheckInControllerIntegrationTest {

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
    private CheckInRepository checkInRepository;

    @Autowired
    private TenantRepository tenantRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("CheckIn Org " + System.currentTimeMillis());
        testOrg.setSubdomain("checkin" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "checkin_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "95" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("FrontDesk Manager");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("FrontDesk Residency");
        testProperty.setCode("FDR-01");
        testProperty.setType("PG");
        testProperty.setAddress("MG Road");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);
    }

    @Test
    @DisplayName("POST /check-ins - Create a pending check-in record")
    void testCreateCheckIn() throws Exception {
        CheckIn checkIn = new CheckIn();
        checkIn.setTenantName("Rohan Verma");
        checkIn.setPropertyId(testProperty.getId());
        checkIn.setRoomNumber("101");
        checkIn.setBedNumber("B1");
        checkIn.setCheckInDate(LocalDate.now());
        checkIn.setRent(BigDecimal.valueOf(11000));
        checkIn.setDepositPaid(BigDecimal.valueOf(22000));
        checkIn.setStatus("pending");

        mockMvc.perform(post("/api/v1/check-ins")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(checkIn)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tenantName", is("Rohan Verma")))
                .andExpect(jsonPath("$.status", is("pending")));
    }

    @Test
    @DisplayName("GET /check-ins - Retrieve list of check-in records")
    void testGetCheckInsList() throws Exception {
        CheckIn checkIn = new CheckIn();
        checkIn.setOrganization(testOrg);
        checkIn.setTenantName("Sneha Roy");
        checkIn.setPropertyId(testProperty.getId());
        checkIn.setRoomNumber("201");
        checkIn.setBedNumber("B2");
        checkIn.setCheckInDate(LocalDate.now());
        checkIn.setRent(BigDecimal.valueOf(12500));
        checkIn.setStatus("pending");
        checkInRepository.saveAndFlush(checkIn);

        mockMvc.perform(get("/api/v1/check-ins")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("POST /check-ins/{id}/mark-completed - Complete check-in and activate tenant")
    void testMarkCheckInCompleted() throws Exception {
        Tenant tenant = new Tenant(testOrg, "Vikram", "Mehta", "9876543210");
        tenant.setEmail("vikram@test.com");
        tenant.setStatus("PENDING_CHECKIN");
        tenant.setPropertyId(testProperty.getId());
        tenant.setRoomNumber("301");
        tenant.setBedNumber("B1");
        tenant = tenantRepository.saveAndFlush(tenant);

        CheckIn checkIn = new CheckIn();
        checkIn.setOrganization(testOrg);
        checkIn.setTenantName("Vikram Mehta");
        checkIn.setPropertyId(testProperty.getId());
        checkIn.setRoomNumber("301");
        checkIn.setBedNumber("B1");
        checkIn.setCheckInDate(LocalDate.now());
        checkIn.setStatus("pending");
        checkIn = checkInRepository.saveAndFlush(checkIn);

        mockMvc.perform(post("/api/v1/check-ins/" + checkIn.getId() + "/mark-completed")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("completed")));
    }
}
