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
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class CheckOutControllerIntegrationTest {

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
    private CheckOutRepository checkOutRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Room testRoom;
    private Bed testBed;
    private Tenant testTenant;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Checkout Org " + System.currentTimeMillis());
        testOrg.setSubdomain("chkout" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "chkout_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "93" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Settlement Admin");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Grand Heights PG");
        testProperty.setCode("GHT-01");
        testProperty.setType("PG");
        testProperty.setAddress("MG Road, Indiranagar");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        Building bld = new Building(testProperty, "Wing A", "W-A");
        bld = buildingRepository.saveAndFlush(bld);

        Floor flr = new Floor(bld, 2, "Floor 2");
        flr = floorRepository.saveAndFlush(flr);

        testRoom = new Room(flr, "201", "SINGLE", BigDecimal.valueOf(14000));
        testRoom = roomRepository.saveAndFlush(testRoom);

        testBed = new Bed(testRoom, "B1");
        testBed.setStatus("OCCUPIED");
        testBed = bedRepository.saveAndFlush(testBed);

        testTenant = new Tenant(testOrg, "Rahul", "Dravid", "9900112233");
        testTenant.setEmail("rahul@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("201");
        testTenant.setBedNumber("B1");
        testTenant.setDeposit(BigDecimal.valueOf(28000));
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("POST /check-outs - File move-out notice")
    void testFileMoveOutNotice() throws Exception {
        CheckOut checkOut = new CheckOut();
        checkOut.setTenantName("Rahul Dravid");
        checkOut.setPropertyId(testProperty.getId());
        checkOut.setRoomNumber("201");
        checkOut.setBedNumber("B1");
        checkOut.setNoticeDate(LocalDate.now());
        checkOut.setCheckOutDate(LocalDate.now().plusDays(30));
        checkOut.setDepositRefund(BigDecimal.valueOf(28000));
        checkOut.setDeductions(BigDecimal.valueOf(2000));
        checkOut.setStatus("pending");
        checkOut.setReason("Relocating to another city");

        mockMvc.perform(post("/api/v1/check-outs")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(checkOut)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tenantName", is("Rahul Dravid")))
                .andExpect(jsonPath("$.status", is("pending")));
    }

    @Test
    @DisplayName("POST /check-outs/{id}/mark-completed - Complete move-out settlement and calculate refund")
    void testCompleteMoveOutSettlement() throws Exception {
        CheckOut checkOut = new CheckOut();
        checkOut.setOrganization(testOrg);
        checkOut.setTenantName("Rahul Dravid");
        checkOut.setPropertyId(testProperty.getId());
        checkOut.setRoomNumber("201");
        checkOut.setBedNumber("B1");
        checkOut.setNoticeDate(LocalDate.now().minusDays(30));
        checkOut.setCheckOutDate(LocalDate.now());
        checkOut.setDepositRefund(BigDecimal.valueOf(28000));
        checkOut.setDeductions(BigDecimal.valueOf(3000));
        checkOut.setStatus("pending");
        checkOut = checkOutRepository.saveAndFlush(checkOut);

        mockMvc.perform(post("/api/v1/check-outs/" + checkOut.getId() + "/mark-completed")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("completed")))
                .andExpect(jsonPath("$.netRefundAmount", equalTo(25000)));
    }

    @Test
    @DisplayName("POST /check-outs/{id}/approve-refund - Approve deposit refund for completed checkout")
    void testApproveSecurityDepositRefund() throws Exception {
        CheckOut checkOut = new CheckOut();
        checkOut.setOrganization(testOrg);
        checkOut.setTenantName("Rahul Dravid");
        checkOut.setPropertyId(testProperty.getId());
        checkOut.setRoomNumber("201");
        checkOut.setBedNumber("B1");
        checkOut.setCheckOutDate(LocalDate.now());
        checkOut.setDepositRefund(BigDecimal.valueOf(28000));
        checkOut.setDeductions(BigDecimal.valueOf(0));
        checkOut.setNetRefundAmount(BigDecimal.valueOf(28000));
        checkOut.setStatus("completed");
        checkOut.setRefundStatus("PENDING_APPROVAL");
        checkOut = checkOutRepository.saveAndFlush(checkOut);

        mockMvc.perform(post("/api/v1/check-outs/" + checkOut.getId() + "/approve-refund")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundStatus", is("REFUNDED")));
    }

    @Test
    @DisplayName("PUT /check-outs/{id} - Reject mutating checkout records directly")
    void testRejectCheckoutUpdate() throws Exception {
        CheckOut checkOut = new CheckOut();
        checkOut.setOrganization(testOrg);
        checkOut.setTenantName("Rahul Dravid");
        checkOut.setPropertyId(testProperty.getId());
        checkOut.setRoomNumber("201");
        checkOut.setBedNumber("B1");
        checkOut.setStatus("pending");
        checkOut = checkOutRepository.saveAndFlush(checkOut);

        mockMvc.perform(put("/api/v1/check-outs/" + checkOut.getId())
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(checkOut)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("immutable")));
    }
}
