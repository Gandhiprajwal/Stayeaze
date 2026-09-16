package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Comprehensive Integration Tests for Lightweight /minimal Endpoints & Omni Search")
public class MinimalEndpointsIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private BuildingRepository buildingRepository;
    @Autowired private FloorRepository floorRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private BedRepository bedRepository;
    @Autowired private TenantRepository tenantRepository;

    private Organization orgA;
    private User ownerUser;
    private User superAdminUser;
    private Property propertyA;
    private Building buildingA;
    private Floor floorA;
    private Room roomA;
    private Bed bedA;
    private Tenant tenantA;

    @BeforeEach
    void setUp() {
        Role roleOwner = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));
        Role roleSuperAdmin = roleRepository.findByName("SUPER_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("SUPER_ADMIN", "{}")));

        orgA = new Organization("StayEaze Alpha Org", "stayeaze-alpha-" + System.currentTimeMillis());
        orgA = organizationRepository.save(orgA);

        ownerUser = new User(orgA, "owner.alpha." + System.currentTimeMillis() + "@stayeaze.com", "Password123!", "9876543210");
        ownerUser.setFirstName("Rajesh Kumar");
        ownerUser.setRoles(new HashSet<>(Set.of(roleOwner)));
        ownerUser = userRepository.save(ownerUser);

        superAdminUser = new User(orgA, "superadmin." + System.currentTimeMillis() + "@stayeaze.com", "Password123!", "9876543211");
        superAdminUser.setFirstName("Super Admin");
        superAdminUser.setRoles(new HashSet<>(Set.of(roleSuperAdmin)));
        superAdminUser = userRepository.save(superAdminUser);

        propertyA = new Property();
        propertyA.setName("StayEaze Premium Tower");
        propertyA.setCode("TOW-A");
        propertyA.setAddress("123 Indiranagar 100ft Road");
        propertyA.setCity("Bengaluru");
        propertyA.setState("Karnataka");
        propertyA.setPincode("560038");
        propertyA.setEmail("tower.a@stayeaze.com");
        propertyA.setPhone("9876543210");
        propertyA.setOrganization(orgA);
        propertyA = propertyRepository.save(propertyA);

        buildingA = new Building(propertyA, "Block A", "BLK-A");
        buildingA = buildingRepository.save(buildingA);

        floorA = new Floor(buildingA, 1, "Floor 1");
        floorA = floorRepository.save(floorA);

        roomA = new Room(floorA, "101", "DOUBLE", new BigDecimal("9500"));
        roomA = roomRepository.save(roomA);

        bedA = new Bed(roomA, "B1");
        bedA.setStatus("AVAILABLE");
        bedA = bedRepository.save(bedA);

        tenantA = new Tenant();
        tenantA.setFirstName("Rahul");
        tenantA.setLastName("Sharma");
        tenantA.setMobile("9876543210");
        tenantA.setEmail("rahul.sharma@example.com");
        tenantA.setPropertyId(propertyA.getId());
        tenantA.setRoomNumber("101");
        tenantA.setBedNumber("B1");
        tenantA.setOrganization(orgA);
        tenantA = tenantRepository.save(tenantA);
    }

    private UserDetailsImpl asDetails(User u) {
        return UserDetailsImpl.build(u);
    }

    @Test
    @DisplayName("1. GET /api/v1/users/minimal — Returns lightweight user list for org")
    void testGetMinimalUsers() throws Exception {
        mockMvc.perform(get("/api/v1/users/minimal")
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)))
                .andExpect(jsonPath("$[?(@.email == '" + ownerUser.getEmail() + "')].name").exists());
    }

    @Test
    @DisplayName("2. GET /api/v1/buildings/minimal — Returns lightweight building selector")
    void testGetMinimalBuildings() throws Exception {
        mockMvc.perform(get("/api/v1/buildings/minimal")
                        .param("propertyId", propertyA.getId().toString())
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)))
                .andExpect(jsonPath("$[0].id", is(buildingA.getId().toString())))
                .andExpect(jsonPath("$[0].name", is("Block A")))
                .andExpect(jsonPath("$[0].propertyId", is(propertyA.getId().toString())));
    }

    @Test
    @DisplayName("3. GET /api/v1/floors/minimal — Returns lightweight floor selector")
    void testGetMinimalFloors() throws Exception {
        mockMvc.perform(get("/api/v1/floors/minimal")
                        .param("buildingId", buildingA.getId().toString())
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)))
                .andExpect(jsonPath("$[0].id", is(floorA.getId().toString())))
                .andExpect(jsonPath("$[0].floorNumber", is(1)));
    }

    @Test
    @DisplayName("4. GET /api/v1/rooms/minimal — Returns lightweight room selector")
    void testGetMinimalRooms() throws Exception {
        mockMvc.perform(get("/api/v1/rooms/minimal")
                        .param("floorId", floorA.getId().toString())
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)))
                .andExpect(jsonPath("$[0].id", is(roomA.getId().toString())))
                .andExpect(jsonPath("$[0].roomNumber", is("101")))
                .andExpect(jsonPath("$[0].rent", is(9500)));
    }

    @Test
    @DisplayName("5. GET /api/v1/beds/minimal — Returns lightweight bed selector")
    void testGetMinimalBeds() throws Exception {
        mockMvc.perform(get("/api/v1/beds/minimal")
                        .param("roomId", roomA.getId().toString())
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)))
                .andExpect(jsonPath("$[0].id", is(bedA.getId().toString())))
                .andExpect(jsonPath("$[0].bedNumber", is("B1")))
                .andExpect(jsonPath("$[0].status", is("available")));
    }

    @Test
    @DisplayName("6. GET /api/v1/super-admin/subscribers/minimal — Returns lightweight org dropdown")
    void testGetMinimalSubscribers() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/minimal")
                        .with(user(asDetails(superAdminUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(Iterable.class)))
                .andExpect(jsonPath("$[?(@.id == '" + orgA.getId().toString() + "')].name").value(hasItem("StayEaze Alpha Org")));
    }

    @Test
    @DisplayName("7. GET /api/v1/search/omni — Real-time search across properties, rooms, tenants")
    void testOmniSearch() throws Exception {
        mockMvc.perform(get("/api/v1/search/omni")
                        .param("q", "Rahul")
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenants", isA(Iterable.class)))
                .andExpect(jsonPath("$.tenants[0].title", containsString("Rahul")));

        mockMvc.perform(get("/api/v1/search/omni")
                        .param("q", "Premium")
                        .with(user(asDetails(ownerUser))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.properties", isA(Iterable.class)))
                .andExpect(jsonPath("$.properties[0].title", containsString("Premium")));
    }
}
