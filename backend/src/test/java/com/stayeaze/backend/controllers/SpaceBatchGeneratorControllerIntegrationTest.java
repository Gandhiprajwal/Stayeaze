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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SpaceBatchGeneratorControllerIntegrationTest {

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
    private BuildingRepository buildingRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Building testBuilding;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Batch Space Org " + System.currentTimeMillis());
        testOrg.setSubdomain("batch" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "batch_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "97" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Space Owner");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Batch Residency");
        testProperty.setCode("BAT-01");
        testProperty.setType("PG");
        testProperty.setAddress("Sector 62, Electronic City");
        testProperty.setCity("Noida");
        testProperty.setState("Uttar Pradesh");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testBuilding = new Building(testProperty, "Tower A", "TWR-A");
        testBuilding = buildingRepository.saveAndFlush(testBuilding);
    }

    @Test
    @DisplayName("POST /batch-generate-spaces - Successfully batch generates floors, rooms, and beds")
    void testBatchGenerateSpacesSuccess() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("startFloor", 1);
        payload.put("endFloor", 2);
        payload.put("roomsPerFloor", 3);
        payload.put("bedsPerRoom", 2);
        payload.put("sharingType", "DOUBLE");
        payload.put("baseRent", 7500);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.floorsCreated", is(2)))
                .andExpect(jsonPath("$.roomsCreated", is(6)))
                .andExpect(jsonPath("$.bedsCreated", is(12)));
    }

    @Test
    @DisplayName("POST /batch-generate-spaces - Reject invalid floor bounds")
    void testBatchGenerateSpacesInvalidFloorRange() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("startFloor", 5);
        payload.put("endFloor", 2); // end < start
        payload.put("roomsPerFloor", 2);
        payload.put("bedsPerRoom", 2);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid floor range")));
    }

    @Test
    @DisplayName("POST /batch-generate-spaces - Reject generation on INACTIVE property")
    void testBatchGenerateSpacesInactiveProperty() throws Exception {
        testProperty.setStatus("INACTIVE");
        propertyRepository.saveAndFlush(testProperty);

        Map<String, Object> payload = new HashMap<>();
        payload.put("startFloor", 1);
        payload.put("endFloor", 1);
        payload.put("roomsPerFloor", 2);
        payload.put("bedsPerRoom", 2);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("locked from space creation")));
    }

    @Test
    @DisplayName("POST /batch-generate-spaces - Reject negative base rent")
    void testBatchGenerateSpacesNegativeRent() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("startFloor", 1);
        payload.put("endFloor", 1);
        payload.put("roomsPerFloor", 2);
        payload.put("bedsPerRoom", 2);
        payload.put("baseRent", -500);

        mockMvc.perform(post("/api/v1/properties/" + testProperty.getId() + "/buildings/" + testBuilding.getId() + "/batch-generate-spaces")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("baseRent cannot be negative")));
    }
}
