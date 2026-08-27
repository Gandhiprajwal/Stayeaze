package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.MeterReadingRequest;
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
public class MeterReadingControllerIntegrationTest {

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
    private MeterReadingRepository meterReadingRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Room testRoom;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Meter Org " + System.currentTimeMillis());
        testOrg.setSubdomain("mtrorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "mtr_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "87" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Facility Admin");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Metered Power Residency");
        testProperty.setCode("MPR-01");
        testProperty.setType("PG");
        testProperty.setAddress("ITPL Main Road");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        Building bld = new Building(testProperty, "Block 1", "B-1");
        bld = buildingRepository.saveAndFlush(bld);

        Floor flr = new Floor(bld, 1, "Floor 1");
        flr = floorRepository.saveAndFlush(flr);

        testRoom = new Room(flr, "101", "DOUBLE", BigDecimal.valueOf(10000));
        testRoom = roomRepository.saveAndFlush(testRoom);
    }

    @Test
    @DisplayName("POST /rooms/{roomId}/meter-readings - Log electricity sub-meter reading")
    void testLogMeterReading() throws Exception {
        MeterReadingRequest request = new MeterReadingRequest();
        request.setReadingDate(LocalDate.now());
        request.setReadingValue(new BigDecimal("150.00"));
        request.setUnitRate(new BigDecimal("10.00"));

        mockMvc.perform(post("/api/v1/rooms/" + testRoom.getId() + "/meter-readings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.readingValue", is(150.0)))
                .andExpect(jsonPath("$.totalAmount", is(1500.0)));
    }

    @Test
    @DisplayName("GET /rooms/{roomId}/meter-readings - Retrieve room meter readings")
    void testGetMeterReadings() throws Exception {
        MeterReading reading = new MeterReading(testRoom, LocalDate.now().minusMonths(1),
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("1000.00"));
        meterReadingRepository.saveAndFlush(reading);

        mockMvc.perform(get("/api/v1/rooms/" + testRoom.getId() + "/meter-readings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].readingValue", is(100.0)));
    }
}
