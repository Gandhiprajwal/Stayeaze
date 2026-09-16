package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Booking;
import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Complaint;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.BookingRepository;
import com.stayeaze.backend.repository.BuildingRepository;
import com.stayeaze.backend.repository.ComplaintRepository;
import com.stayeaze.backend.repository.FloorRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
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
public class OwnerDashboardIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

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
    private ComplaintRepository complaintRepository;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Tenant tenant;
    private UserDetailsImpl userDetails;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Zenith Living " + System.currentTimeMillis());
        testOrg.setSubdomain("zenith" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + (System.currentTimeMillis() % 100000000L);
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Rajesh Kumar");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Zenith Luxury PG");
        testProperty.setCode("ZTH-01");
        testProperty.setType("PG");
        testProperty.setAddress("Cyber City, Sector 24");
        testProperty.setCity("Gurugram");
        testProperty.setState("Haryana");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        ownerUser.setPropertyIds(new java.util.ArrayList<>(Collections.singletonList(testProperty.getId())));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        Building bld = new Building(testProperty, "Block A", "BLK-A");
        bld = buildingRepository.save(bld);

        Floor flr = new Floor();
        flr.setFloorNumber(1);
        flr.setBuilding(bld);
        flr = floorRepository.save(flr);

        Room rm = new Room();
        rm.setFloor(flr);
        rm.setRoomNumber("101");
        rm.setSharingType("DOUBLE");
        rm.setBaseRent(new BigDecimal("12000"));
        rm = roomRepository.save(rm);

        Bed bed = new Bed();
        bed.setRoom(rm);
        bed.setBedNumber("B1");
        bed.setStatus("OCCUPIED");
        bed = bedRepository.save(bed);

        tenant = new Tenant(testOrg, "Aarav", "Sharma", "9123456789");
        tenant.setEmail("aarav@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        Booking booking = new Booking();
        booking.setTenant(tenant);
        booking.setBed(bed);
        booking.setCheckinDate(LocalDate.now());
        booking.setRentAgreed(new BigDecimal("12000"));
        booking.setDepositAgreed(new BigDecimal("24000"));
        booking.setStatus("CONFIRMED");
        bookingRepository.saveAndFlush(booking);

        Complaint complaint = new Complaint();
        complaint.setTenant(tenant);
        complaint.setRoom(rm);
        complaint.setCategory("ELECTRICAL");
        complaint.setDescription("Air Conditioner Not Cooling");
        complaint.setStatus("OPEN");
        complaint.setPriority("HIGH");
        complaintRepository.saveAndFlush(complaint);

        entityManager.flush();
        entityManager.clear();
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/metrics - Return valid owner dashboard stats")
    void testGetOwnerDashboardMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/metrics")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("OWNER")))
                .andExpect(jsonPath("$.totalProperties", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.activeTenantsCount", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.openComplaintsCount", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.occupancyRate", notNullValue()))
                .andExpect(jsonPath("$.pendingDues", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/v1/dashboard/metrics - Admin role dashboard metrics access")
    void testGetAdminDashboardMetrics() throws Exception {
        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ADMIN", "{}")));
        User adminUser = new User(testOrg, "admin_" + System.currentTimeMillis() + "@stayeaze.com", "pass123", "99" + (System.currentTimeMillis() % 100000000L));
        adminUser.setRoles(new HashSet<>(Collections.singleton(adminRole)));
        adminUser = userRepository.saveAndFlush(adminUser);

        UserDetailsImpl adminDetails = UserDetailsImpl.build(adminUser);
        UsernamePasswordAuthenticationToken adminAuth =
                new UsernamePasswordAuthenticationToken(adminDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_ADMIN")));

        mockMvc.perform(get("/api/v1/dashboard/metrics")
                        .with(authentication(adminAuth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("ADMIN")))
                .andExpect(jsonPath("$.totalProperties", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("GET /api/v1/properties/stats - Return property occupancy and revenue stats")
    void testGetPropertyStats() throws Exception {
        mockMvc.perform(get("/api/v1/properties/stats")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalProperties", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("GET /api/v1/properties - Return owner's property list")
    void testGetOwnerProperties() throws Exception {
        mockMvc.perform(get("/api/v1/properties")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].name", is("Zenith Luxury PG")));
    }

    @Test
    @DisplayName("GET /api/v1/tenants - Return paginated list of active tenants")
    void testGetOwnerTenants() throws Exception {
        mockMvc.perform(get("/api/v1/tenants")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].firstName", is("Aarav")));
    }

    @Test
    @DisplayName("GET /api/v1/bookings - Return owner's bookings list")
    void testGetOwnerBookings() throws Exception {
        mockMvc.perform(get("/api/v1/bookings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("GET /api/v1/complaints - Return complaint list for owner's organization")
    void testGetOwnerComplaints() throws Exception {
        mockMvc.perform(get("/api/v1/complaints")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].description", is("Air Conditioner Not Cooling")));
    }
}
