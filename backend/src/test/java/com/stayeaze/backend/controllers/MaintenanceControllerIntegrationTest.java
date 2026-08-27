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
public class MaintenanceControllerIntegrationTest {

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
    private MaintenanceRepository maintenanceRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Maint Org " + System.currentTimeMillis());
        testOrg.setSubdomain("maintorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "maint_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "84" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Operations Lead");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Maintenance Matrix");
        testProperty.setCode("MMX-01");
        testProperty.setType("PG");
        testProperty.setAddress("Bannerghatta Main Road");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);
    }

    @Test
    @DisplayName("POST /maintenance - Create maintenance task")
    void testCreateMaintenanceTask() throws Exception {
        Maintenance task = new Maintenance();
        task.setAsset("Water Purifier RO Plant");
        task.setPropertyId(testProperty.getId());
        task.setType("PREVENTIVE");
        task.setPriority("HIGH");
        task.setDescription("Quarterly membrane change and filter cleaning");
        task.setCost(BigDecimal.valueOf(3500));
        task.setVendor("Kent RO Services");
        task.setStatus("PENDING");

        mockMvc.perform(post("/api/v1/maintenance")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.asset", is("Water Purifier RO Plant")))
                .andExpect(jsonPath("$.ticketNumber", notNullValue()));
    }

    @Test
    @DisplayName("GET /maintenance - Retrieve paginated maintenance tasks")
    void testGetMaintenanceTasks() throws Exception {
        Maintenance task = new Maintenance();
        task.setOrganization(testOrg);
        task.setAsset("Lift / Elevator");
        task.setPropertyId(testProperty.getId());
        task.setType("REPAIR");
        task.setPriority("URGENT");
        task.setDescription("Door sensor alignment");
        task.setStatus("IN_PROGRESS");
        task.setTicketNumber("MNT-123456");
        maintenanceRepository.saveAndFlush(task);

        mockMvc.perform(get("/api/v1/maintenance")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("PUT /maintenance/{id} - Update maintenance task to COMPLETED")
    void testUpdateMaintenanceTask() throws Exception {
        Maintenance task = new Maintenance();
        task.setOrganization(testOrg);
        task.setAsset("DG Generator");
        task.setPropertyId(testProperty.getId());
        task.setType("SERVICING");
        task.setPriority("MEDIUM");
        task.setDescription("Diesel filter change");
        task.setStatus("PENDING");
        task.setTicketNumber("MNT-998877");
        task = maintenanceRepository.saveAndFlush(task);

        task.setStatus("COMPLETED");

        mockMvc.perform(put("/api/v1/maintenance/" + task.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COMPLETED")));
    }
}
