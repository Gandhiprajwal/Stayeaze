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
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class UtilityBillingEngineIntegrationTest {

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
    private MeterReadingRepository meterReadingRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;
    private Property testProperty;
    private Room testRoom;
    private Tenant testTenant;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Utility Org " + System.currentTimeMillis());
        testOrg.setSubdomain("util" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "owner_utility_" + System.currentTimeMillis() + "@stayeaze.com";
        String mobile = "98" + (System.currentTimeMillis() % 100000000L);
        ownerUser = new User(testOrg, email, "password123", mobile);
        ownerUser.setFirstName("Kavita Rao");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Sapphire Suites");
        testProperty.setCode("SS-01");
        testProperty.setType("PG");
        testProperty.setAddress("Gachibowli, Hyderabad");
        testProperty.setCity("Hyderabad");
        testProperty.setState("Telangana");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        Building building = new Building();
        building.setProperty(testProperty);
        building.setName("Tower 1");
        building.setCode("TOW-1");
        building = buildingRepository.saveAndFlush(building);

        Floor floor = new Floor();
        floor.setBuilding(building);
        floor.setFloorNumber(1);
        floor.setName("Floor 1");
        floor = floorRepository.saveAndFlush(floor);

        testRoom = new Room();
        testRoom.setFloor(floor);
        testRoom.setRoomNumber("101");
        testRoom.setSharingType("DOUBLE");
        testRoom.setStatus("AVAILABLE");
        testRoom.setBaseRent(BigDecimal.valueOf(9000));
        testRoom = roomRepository.saveAndFlush(testRoom);

        Bed bed1 = new Bed();
        bed1.setRoom(testRoom);
        bed1.setBedNumber("B1");
        bed1.setStatus("OCCUPIED");
        bed1 = bedRepository.saveAndFlush(bed1);

        testTenant = new Tenant();
        testTenant.setOrganization(testOrg);
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setFirstName("Rahul");
        testTenant.setLastName("Deshmukh");
        testTenant.setEmail("rahul.deshmukh." + System.currentTimeMillis() + "@gmail.com");
        testTenant.setMobile("98" + (System.currentTimeMillis() % 100000000L));
        testTenant.setRoomNumber("101");
        testTenant.setBedNumber("B1");
        testTenant.setStatus("ACTIVE");
        testTenant.setRent(BigDecimal.valueOf(9000));
        testTenant.setLeaseStart("2026-07-01");
        testTenant = tenantRepository.saveAndFlush(testTenant);

        Booking booking = new Booking();
        booking.setTenant(testTenant);
        booking.setBed(bed1);
        booking.setStatus("CHECKED_IN");
        booking.setCheckinDate(LocalDate.now().minusMonths(1));
        booking.setRentAgreed(BigDecimal.valueOf(9000));
        booking.setDepositAgreed(BigDecimal.valueOf(18000));
        bookingRepository.saveAndFlush(booking);
    }

    @Test
    @DisplayName("Should fetch paginated meter sheet and calculate utility preview")
    void testGetMeterSheetAndCalculatePreview() throws Exception {
        // 1. Fetch paginated meter sheet
        mockMvc.perform(get("/api/v1/utilities/properties/" + testProperty.getId() + "/meter-sheet")
                        .with(authentication(auth))
                        .param("month", "8")
                        .param("year", "2026")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].roomNumber", is("101")));

        // 2. Calculate preview for Room 101 (prev: 100, curr: 150, rate: 10, allowance: 10)
        Map<String, Object> previewReq = Map.of(
                "roomId", testRoom.getId().toString(),
                "previousReading", 100,
                "currentReading", 150,
                "unitRate", 10.0,
                "freeAllowanceUnits", 10,
                "billingMonth", 8,
                "billingYear", 2026,
                "splitMode", "FAIR_PROPORTIONAL"
        );

        mockMvc.perform(post("/api/v1/utilities/calculate-preview")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(previewReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unitsConsumed", is(40.0))) // 50 gross - 10 allowance = 40 net
                .andExpect(jsonPath("$.totalAmount", is(400.0))) // 40 units * 10 = 400
                .andExpect(jsonPath("$.tenantSplits", hasSize(1)))
                .andExpect(jsonPath("$.tenantSplits[0].amount", is(200.0))); // 1 out of 2 sharing capacity = 200
    }

    @Test
    @DisplayName("Should save draft readings and merge into tenant rent invoices without duplicate collision")
    void testBulkRecordDraftAndApplyToRentInvoices() throws Exception {
        Map<String, Object> readingItem = Map.of(
                "roomId", testRoom.getId().toString(),
                "previousReading", 100,
                "currentReading", 180,
                "unitRate", 10.0,
                "freeAllowanceUnits", 0,
                "billingMonth", 8,
                "billingYear", 2026,
                "splitMode", "FAIR_PROPORTIONAL"
        );

        // 1. Save Draft (appendToRentInvoices = false)
        Map<String, Object> draftPayload = Map.of(
                "readings", List.of(readingItem),
                "appendToRentInvoices", false
        );

        mockMvc.perform(post("/api/v1/utilities/properties/" + testProperty.getId() + "/bulk-record-readings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(draftPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.recordedRooms", is(1)));

        // Verify draft saved in DB with UNBILLED status
        List<MeterReading> saved = meterReadingRepository.findByRoomAndBillingMonthAndBillingYear(testRoom, 8, 2026);
        assertFalse(saved.isEmpty());
        assertEquals("UNBILLED", saved.get(0).getStatus());

        // 2. 1-Click Apply to Invoices (appendToRentInvoices = true)
        Map<String, Object> applyPayload = Map.of(
                "readings", List.of(readingItem),
                "appendToRentInvoices", true
        );

        mockMvc.perform(post("/api/v1/utilities/properties/" + testProperty.getId() + "/bulk-record-readings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(applyPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.recordedRooms", is(1)));

        // Verify reading updated to BILLED
        List<MeterReading> billed = meterReadingRepository.findByRoomAndBillingMonthAndBillingYear(testRoom, 8, 2026);
        assertEquals("BILLED", billed.get(0).getStatus());

        // Verify utility invoice generated for tenant
        List<Invoice> tenantInvoices = invoiceRepository.findByTenant(testTenant);
        assertFalse(tenantInvoices.isEmpty());
        assertTrue(tenantInvoices.stream().anyMatch(i -> i.getInvoiceNumber().startsWith("UTIL-")));
    }
}
