package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.CheckinChecklistRequest;
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
public class CheckinChecklistControllerIntegrationTest {

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
    private CheckinChecklistRepository checkinChecklistRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Booking testBooking;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Checklist Org " + System.currentTimeMillis());
        testOrg.setSubdomain("chkorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "chk_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "94" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("FrontDesk Agent");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Checklist Suites");
        testProperty.setCode("CHK-01");
        testProperty.setType("PG");
        testProperty.setAddress("Koramangala 4th Block");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        Building bld = new Building(testProperty, "Tower 1", "T1");
        bld = buildingRepository.saveAndFlush(bld);

        Floor flr = new Floor(bld, 1, "Floor 1");
        flr = floorRepository.saveAndFlush(flr);

        Room rm = new Room(flr, "101", "SINGLE", BigDecimal.valueOf(10000));
        rm = roomRepository.saveAndFlush(rm);

        Bed bed = new Bed(rm, "B1");
        bed = bedRepository.saveAndFlush(bed);

        Tenant tenant = new Tenant(testOrg, "Manish", "Pandey", "9811223344");
        tenant.setEmail("manish@test.com");
        tenant.setStatus("ACTIVE");
        tenant.setPropertyId(testProperty.getId());
        tenant = tenantRepository.saveAndFlush(tenant);

        testBooking = new Booking();
        testBooking.setTenant(tenant);
        testBooking.setBed(bed);
        testBooking.setCheckinDate(LocalDate.now());
        testBooking.setRentAgreed(BigDecimal.valueOf(10000));
        testBooking.setDepositAgreed(BigDecimal.valueOf(20000));
        testBooking.setStatus("CONFIRMED");
        testBooking = bookingRepository.saveAndFlush(testBooking);
    }

    @Test
    @DisplayName("POST & GET /bookings/{bookingId}/checkin-checklist - Log room inventory & retrieve checklist")
    void testCreateAndGetCheckinChecklist() throws Exception {
        CheckinChecklistRequest request = new CheckinChecklistRequest();
        request.setKeysHandedOver(true);
        request.setAmenitiesHandedOver(true);
        request.setSubMeterReading(new BigDecimal("124.50"));
        request.setNotes("Everything in pristine condition");

        mockMvc.perform(post("/api/v1/bookings/" + testBooking.getId() + "/checkin-checklist")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.keysHandedOver", is(true)))
                .andExpect(jsonPath("$.amenitiesHandedOver", is(true)))
                .andExpect(jsonPath("$.notes", is("Everything in pristine condition")));

        mockMvc.perform(get("/api/v1/bookings/" + testBooking.getId() + "/checkin-checklist")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keysHandedOver", is(true)));
    }

    @Test
    @DisplayName("POST /bookings/{bookingId}/checkin-checklist - Reject duplicate checklist for same booking")
    void testDuplicateCheckinChecklist() throws Exception {
        CheckinChecklist existing = new CheckinChecklist(testBooking, true, true, new BigDecimal("100.00"));
        checkinChecklistRepository.saveAndFlush(existing);

        CheckinChecklistRequest request = new CheckinChecklistRequest();
        request.setKeysHandedOver(true);
        request.setAmenitiesHandedOver(true);
        request.setSubMeterReading(new BigDecimal("105.00"));

        mockMvc.perform(post("/api/v1/bookings/" + testBooking.getId() + "/checkin-checklist")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already logged for this booking")));
    }
}
