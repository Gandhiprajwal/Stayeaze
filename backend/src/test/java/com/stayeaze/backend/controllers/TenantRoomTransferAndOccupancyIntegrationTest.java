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
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class TenantRoomTransferAndOccupancyIntegrationTest {

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

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;
    private Property testProperty;
    private Building testBuilding;
    private Floor testFloor;
    private Room roomA;
    private Room roomB;
    private Bed bedA1;
    private Bed bedB1;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Transfer Org " + System.currentTimeMillis());
        testOrg.setSubdomain("trans" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_transfer_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + (System.currentTimeMillis() % 100000000L);
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Arun Kumar");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Urban Heights");
        testProperty.setCode("UH-01");
        testProperty.setType("PG");
        testProperty.setAddress("Whitefield Main Rd, Bengaluru");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testBuilding = new Building();
        testBuilding.setProperty(testProperty);
        testBuilding.setName("Block A");
        testBuilding.setCode("BLK-A");
        testBuilding = buildingRepository.saveAndFlush(testBuilding);

        testFloor = new Floor();
        testFloor.setBuilding(testBuilding);
        testFloor.setFloorNumber(1);
        testFloor.setName("Floor 1");
        testFloor = floorRepository.saveAndFlush(testFloor);

        // Create Room A & Bed A1
        roomA = new Room();
        roomA.setFloor(testFloor);
        roomA.setRoomNumber("101");
        roomA.setSharingType("SINGLE");
        roomA.setStatus("AVAILABLE");
        roomA.setBaseRent(BigDecimal.valueOf(8000));
        roomA = roomRepository.saveAndFlush(roomA);

        bedA1 = new Bed();
        bedA1.setRoom(roomA);
        bedA1.setBedNumber("B1");
        bedA1.setStatus("OCCUPIED");
        bedA1 = bedRepository.saveAndFlush(bedA1);

        // Create Room B & Bed B1 (Initially Available)
        roomB = new Room();
        roomB.setFloor(testFloor);
        roomB.setRoomNumber("102");
        roomB.setSharingType("SINGLE");
        roomB.setStatus("AVAILABLE");
        roomB.setBaseRent(BigDecimal.valueOf(8500));
        roomB = roomRepository.saveAndFlush(roomB);

        bedB1 = new Bed();
        bedB1.setRoom(roomB);
        bedB1.setBedNumber("B1");
        bedB1.setStatus("AVAILABLE");
        bedB1 = bedRepository.saveAndFlush(bedB1);
    }

    @Test
    @DisplayName("Should successfully transfer tenant to new room and atomically sync old & new bed/room occupancy")
    void testTenantRoomTransferOccupancySync() throws Exception {
        // Create active tenant currently in Room A (Bed A1)
        Tenant tenant = new Tenant();
        tenant.setOrganization(testOrg);
        tenant.setPropertyId(testProperty.getId());
        tenant.setFirstName("Rohan");
        tenant.setLastName("Sharma");
        tenant.setEmail("rohan.sharma." + System.currentTimeMillis() + "@gmail.com");
        tenant.setMobile("99" + (System.currentTimeMillis() % 100000000L));
        tenant.setRoomNumber("101");
        tenant.setBedNumber("B1");
        tenant.setStatus("ACTIVE");
        tenant.setRent(BigDecimal.valueOf(8000));
        tenant.setLeaseStart("2026-07-01");
        tenant = tenantRepository.saveAndFlush(tenant);

        // Create active booking for tenant on Bed A1
        Booking booking = new Booking();
        booking.setTenant(tenant);
        booking.setBed(bedA1);
        booking.setStatus("CHECKED_IN");
        booking.setCheckinDate(LocalDate.now().minusMonths(1));
        booking.setRentAgreed(BigDecimal.valueOf(8000));
        booking.setDepositAgreed(BigDecimal.valueOf(16000));
        bookingRepository.saveAndFlush(booking);

        // Verify initial state
        assertTrue("OCCUPIED".equalsIgnoreCase(bedRepository.findById(bedA1.getId()).get().getStatus()));
        assertTrue("AVAILABLE".equalsIgnoreCase(bedRepository.findById(bedB1.getId()).get().getStatus()));

        // Perform Room Transfer to Room 102 / Bed B1 via PUT /api/v1/tenants/{id}
        TenantRequest updateRequest = new TenantRequest();
        updateRequest.setFirstName("Rohan");
        updateRequest.setLastName("Sharma");
        updateRequest.setEmail(tenant.getEmail());
        updateRequest.setMobile(tenant.getMobile());
        updateRequest.setPropertyId(testProperty.getId());
        updateRequest.setBuildingId(testBuilding.getId());
        updateRequest.setRoomId(roomB.getId());
        updateRequest.setBedId(bedB1.getId());
        updateRequest.setRoomNumber("102");
        updateRequest.setBedNumber("B1");
        updateRequest.setStatus("ACTIVE");
        updateRequest.setRent(BigDecimal.valueOf(8500));

        mockMvc.perform(put("/api/v1/tenants/" + tenant.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomNumber", is("102")))
                .andExpect(jsonPath("$.bedNumber", is("B1")));

        entityManager.flush();
        entityManager.clear();

        // Verify Old Bed A1 is now AVAILABLE (Vacant)
        Bed updatedBedA1 = bedRepository.findById(bedA1.getId()).get();
        assertTrue("AVAILABLE".equalsIgnoreCase(updatedBedA1.getStatus()), "Old Bed A1 must be available after transfer");

        // Verify New Bed B1 is now OCCUPIED
        Bed updatedBedB1 = bedRepository.findById(bedB1.getId()).get();
        assertTrue("OCCUPIED".equalsIgnoreCase(updatedBedB1.getStatus()), "New Bed B1 must be occupied after transfer");

        // Verify Booking entity transferred to Bed B1
        List<Booking> bookings = bookingRepository.findByTenant(tenant);
        assertFalse(bookings.isEmpty());
        assertEquals(bedB1.getId(), bookings.get(0).getBed().getId());
    }
}
