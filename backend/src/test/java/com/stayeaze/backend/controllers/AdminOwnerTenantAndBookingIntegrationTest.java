package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.TenantRequest;
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
public class AdminOwnerTenantAndBookingIntegrationTest {

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

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private BookingRepository bookingRepository;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;
    private Property testProperty;
    private Bed testBed;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Elite Living " + System.currentTimeMillis());
        testOrg.setSubdomain("elite" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_tb_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + String.format("%08d", Math.abs(System.currentTimeMillis() % 100000000L));
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Anil Kapoor");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Elite Residency PG");
        testProperty.setCode("ELT-01");
        testProperty.setType("PG");
        testProperty.setAddress("Indiranagar, Bengaluru");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        ownerUser.setPropertyIds(new java.util.ArrayList<>(Collections.singletonList(testProperty.getId())));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        Building bld = new Building(testProperty, "Wing A", "WNG-A");
        bld = buildingRepository.save(bld);

        Floor flr = new Floor();
        flr.setBuilding(bld);
        flr.setFloorNumber(1);
        flr = floorRepository.save(flr);

        Room rm = new Room();
        rm.setFloor(flr);
        rm.setRoomNumber("201");
        rm.setSharingType("SINGLE");
        rm.setBaseRent(new BigDecimal("18000"));
        rm = roomRepository.save(rm);

        testBed = new Bed();
        testBed.setRoom(rm);
        testBed.setBedNumber("B-201");
        testBed.setStatus("AVAILABLE");
        testBed = bedRepository.saveAndFlush(testBed);
    }

    @Test
    @DisplayName("POST /api/v1/tenants - Onboard tenant with auto-created checkin & minimal DTO response")
    void testCreateTenantAndVerifyOnboarding() throws Exception {
        TenantRequest req = new TenantRequest();
        req.setFirstName("Rohan");
        req.setLastName("Verma");
        req.setEmail("rohan.v" + System.currentTimeMillis() + "@test.com");
        req.setMobile("91" + String.format("%08d", Math.abs(System.currentTimeMillis() % 100000000L)));
        req.setPropertyId(testProperty.getId());
        req.setRoomNumber("201");
        req.setBedNumber("B-201");
        req.setRent(new BigDecimal("18000"));
        req.setDeposit(new BigDecimal("36000"));
        req.setStatus("ACTIVE");

        mockMvc.perform(post("/api/v1/tenants")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.firstName", is("Rohan")))
                .andExpect(jsonPath("$.roomNumber", is("201")));
    }

    @Test
    @DisplayName("GET /api/v1/tenants - Return paginated MinimalTenantDTO list")
    void testGetTenantsMinimalDTO() throws Exception {
        Tenant t = new Tenant(testOrg, "Siddharth", "Malhotra", "9876500112");
        t.setEmail("siddharth@test.com");
        t.setPropertyId(testProperty.getId());
        t.setStatus("ACTIVE");
        tenantRepository.saveAndFlush(t);

        mockMvc.perform(get("/api/v1/tenants")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].firstName", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/v1/tenants/stats - Tenant statistics per property")
    void testGetTenantStats() throws Exception {
        mockMvc.perform(get("/api/v1/tenants/stats")
                        .param("propertyId", testProperty.getId().toString())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTenants", notNullValue()))
                .andExpect(jsonPath("$.activeTenants", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/v1/bookings - Return booking summary list")
    void testGetBookings() throws Exception {
        Tenant t = new Tenant(testOrg, "Neha", "Dhupia", "9123411223");
        t.setEmail("neha@test.com");
        t.setPropertyId(testProperty.getId());
        t.setStatus("ACTIVE");
        t = tenantRepository.saveAndFlush(t);

        Booking b = new Booking();
        b.setTenant(t);
        b.setBed(testBed);
        b.setCheckinDate(LocalDate.now());
        b.setRentAgreed(new BigDecimal("18000"));
        b.setDepositAgreed(new BigDecimal("36000"));
        b.setStatus("CONFIRMED");
        bookingRepository.saveAndFlush(b);

        mockMvc.perform(get("/api/v1/bookings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));
    }
}
