package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.BedRequest;
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
public class BedControllerIntegrationTest {

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
    private Floor testFloor;
    private Room testRoom;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Bed Test Org " + System.currentTimeMillis());
        testOrg.setSubdomain("bedorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "bed_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "96" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Bed Owner");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Bed Matrix Suites");
        testProperty.setCode("BMS-01");
        testProperty.setType("PG");
        testProperty.setAddress("Golf Course Road");
        testProperty.setCity("Gurugram");
        testProperty.setState("Haryana");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testBuilding = new Building(testProperty, "Tower 1", "TWR-1");
        testBuilding = buildingRepository.saveAndFlush(testBuilding);

        testFloor = new Floor(testBuilding, 1, "Floor 1");
        testFloor = floorRepository.saveAndFlush(testFloor);

        testRoom = new Room(testFloor, "101", "DOUBLE", BigDecimal.valueOf(9000));
        testRoom = roomRepository.saveAndFlush(testRoom);
    }

    @Autowired
    private com.stayeaze.backend.services.BedService bedService;

    @Test
    @DisplayName("POST /rooms/{roomId}/beds - Successfully create a bed within room sharing capacity")
    void testCreateBedSuccess() throws Exception {
        BedRequest request = new BedRequest();
        request.setBedNumber("B1");
        request.setStatus("AVAILABLE");

        mockMvc.perform(post("/api/v1/rooms/" + testRoom.getId() + "/beds")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bedNumber", is("B1")))
                .andExpect(jsonPath("$.status", equalToIgnoringCase("available")));
    }

    @Test
    @DisplayName("POST /rooms/{roomId}/beds - Reject duplicate bed number in the same room")
    void testCreateDuplicateBedNumber() throws Exception {
        Bed existing = new Bed(testRoom, "B1");
        existing.setStatus("AVAILABLE");
        bedService.saveBed(existing);

        BedRequest request = new BedRequest();
        request.setBedNumber("B1");
        request.setStatus("AVAILABLE");

        mockMvc.perform(post("/api/v1/rooms/" + testRoom.getId() + "/beds")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already exists in this room")));
    }

    @Test
    @DisplayName("POST /rooms/{roomId}/beds - Reject exceeding max beds allowed by sharing type")
    void testExceedingMaxBedsForRoom() throws Exception {
        // testRoom is DOUBLE (max 2 beds)
        Bed b1 = new Bed(testRoom, "B1");
        Bed b2 = new Bed(testRoom, "B2");
        bedService.saveBed(b1);
        bedService.saveBed(b2);

        // Attempting to add 3rd bed
        BedRequest request = new BedRequest();
        request.setBedNumber("B3");
        request.setStatus("AVAILABLE");

        mockMvc.perform(post("/api/v1/rooms/" + testRoom.getId() + "/beds")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("allows a maximum of 2 bed(s)")));
    }

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    @Test
    @DisplayName("GET /beds - Retrieve paginated list of beds for owner's organization")
    void testGetFlatBedsPaginated() throws Exception {
        BedRequest request = new BedRequest();
        request.setBedNumber("B1");
        request.setStatus("AVAILABLE");

        mockMvc.perform(post("/api/v1/rooms/" + testRoom.getId() + "/beds")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/rooms/" + testRoom.getId() + "/beds")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].bedNumber", is("B1")));
    }

    @Test
    @DisplayName("PUT /rooms/{roomId}/beds/{id} - Update bed status to MAINTENANCE")
    void testUpdateBedStatus() throws Exception {
        Bed bed = new Bed(testRoom, "B1");
        bed.setStatus("AVAILABLE");
        bed = bedService.saveBed(bed);

        BedRequest updateRequest = new BedRequest();
        updateRequest.setBedNumber("B1");
        updateRequest.setStatus("MAINTENANCE");

        mockMvc.perform(put("/api/v1/rooms/" + testRoom.getId() + "/beds/" + bed.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", equalToIgnoringCase("maintenance")));
    }
}
