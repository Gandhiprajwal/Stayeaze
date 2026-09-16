package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.PropertyRequest;
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
import java.util.Collections;
import java.util.HashSet;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AdminOwnerPropertyIntegrationTest {

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
    private UsernamePasswordAuthenticationToken auth;
    private Property testProperty;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Grand Living " + System.currentTimeMillis());
        testOrg.setSubdomain("grand" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + String.format("%08d", Math.abs(System.currentTimeMillis() % 100000000L));
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Vikram Singh");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Grand City Hostel");
        testProperty.setCode("GCH-01");
        testProperty.setType("HOSTEL");
        testProperty.setAddress("Sector 62, Noida");
        testProperty.setCity("Noida");
        testProperty.setState("Uttar Pradesh");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        ownerUser.setPropertyIds(new java.util.ArrayList<>(Collections.singletonList(testProperty.getId())));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("POST /api/v1/properties - Create new property under Owner")
    void testCreatePropertyByOwner() throws Exception {
        PropertyRequest req = new PropertyRequest();
        req.setName("Grand Royal PG");
        req.setCode("GRP-02");
        req.setType("PG");
        req.setAddress("Sector 18, Noida");
        req.setCity("Noida");
        req.setState("Uttar Pradesh");
        req.setPincode("201301");
        req.setPhone("9811002233");
        req.setEmail("contact@grandpg.com");

        mockMvc.perform(post("/api/v1/properties")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name", is("Grand Royal PG")))
                .andExpect(jsonPath("$.code", is("GRP-02")));
    }

    @Test
    @DisplayName("GET /api/v1/properties - Return paginated PropertySummaryDTO list")
    void testGetAllPropertiesSummaryDTO() throws Exception {
        mockMvc.perform(get("/api/v1/properties")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].name", is("Grand City Hostel")))
                .andExpect(jsonPath("$.data[0].city", is("Noida")));
    }

    @Test
    @DisplayName("GET /api/v1/properties/minimal - Return MinimalPropertyDTO list")
    void testGetMinimalProperties() throws Exception {
        mockMvc.perform(get("/api/v1/properties/minimal")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].name", is("Grand City Hostel")));
    }

    @Test
    @DisplayName("GET /api/v1/properties/{id} - Return full property detail with statistics")
    void testGetPropertyById() throws Exception {
        mockMvc.perform(get("/api/v1/properties/" + testProperty.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(testProperty.getId().toString())))
                .andExpect(jsonPath("$.name", is("Grand City Hostel")));
    }

    @Test
    @DisplayName("PUT /api/v1/properties/{id} - Update property metadata")
    void testUpdateProperty() throws Exception {
        PropertyRequest req = new PropertyRequest();
        req.setName("Grand City PG & Hostel");
        req.setCode("GCH-01");
        req.setType("PG");
        req.setAddress("Sector 62, Noida (Updated)");
        req.setCity("Noida");
        req.setState("Uttar Pradesh");

        mockMvc.perform(put("/api/v1/properties/" + testProperty.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Grand City PG & Hostel")));
    }

    @Test
    @DisplayName("Building, Floor, Room, Bed Hierarchy Setup & Stats Verification")
    void testBuildingHierarchyAndStats() throws Exception {
        Building bld = new Building(testProperty, "Tower A", "TWR-A");
        bld = buildingRepository.save(bld);

        Floor flr = new Floor();
        flr.setBuilding(bld);
        flr.setFloorNumber(1);
        flr = floorRepository.save(flr);

        Room rm = new Room();
        rm.setFloor(flr);
        rm.setRoomNumber("101");
        rm.setSharingType("SINGLE");
        rm.setBaseRent(new BigDecimal("15000"));
        rm = roomRepository.save(rm);

        Bed bed = new Bed();
        bed.setRoom(rm);
        bed.setBedNumber("A1");
        bed.setStatus("AVAILABLE");
        bedRepository.saveAndFlush(bed);

        mockMvc.perform(get("/api/v1/properties/stats")
                        .param("propertyId", testProperty.getId().toString())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalBuildings", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalRooms", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalBeds", greaterThanOrEqualTo(1)));
    }
}
