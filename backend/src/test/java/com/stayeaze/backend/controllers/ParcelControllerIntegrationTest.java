package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.ParcelRequest;
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

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ParcelControllerIntegrationTest {

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
    private TenantRepository tenantRepository;

    @Autowired
    private ParcelRepository parcelRepository;

    private Organization testOrg;
    private User ownerUser;
    private Property testProperty;
    private Tenant testTenant;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Parcel Org " + System.currentTimeMillis());
        testOrg.setSubdomain("parorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "par_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "91" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Reception Desk");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Parcel Suites");
        testProperty.setCode("PAR-01");
        testProperty.setType("PG");
        testProperty.setAddress("Bellandur Outer Ring Road");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testTenant = new Tenant(testOrg, "Arjun", "Kapoor", "9844556677");
        testTenant.setEmail("arjun@test.com");
        testTenant.setStatus("ACTIVE");
        testTenant.setPropertyId(testProperty.getId());
        testTenant.setRoomNumber("101");
        testTenant.setBedNumber("B1");
        testTenant = tenantRepository.saveAndFlush(testTenant);
    }

    @Test
    @DisplayName("GET /api/v1/parcels - List all organization parcels")
    void testGetAllOrgParcels() throws Exception {
        Parcel p = new Parcel(testTenant, "Flipkart Delivery");
        p.setOrganization(testOrg);
        p.setTrackingNumber("FK987654321");
        parcelRepository.saveAndFlush(p);

        mockMvc.perform(get("/api/v1/parcels")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].courierCompany", notNullValue()));
    }

    @Test
    @DisplayName("POST /api/v1/parcels - Intake parcel generates 4-digit OTP and QR token")
    void testReceiveParcelDirect_GeneratesOtp() throws Exception {
        ParcelRequest request = new ParcelRequest();
        request.setTenantId(testTenant.getId());
        request.setCourierCompany("Amazon Prime");
        request.setTrackingNumber("AMZ-889900");
        request.setParcelType("PERISHABLE_FOOD");
        request.setLockerLocation("Cold Storage Fridge Shelf 1");
        request.setNotes("Keep chilled until pickup");

        mockMvc.perform(post("/api/v1/parcels")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.courierCompany", is("Amazon Prime")))
                .andExpect(jsonPath("$.parcelType", is("PERISHABLE_FOOD")))
                .andExpect(jsonPath("$.lockerLocation", is("Cold Storage Fridge Shelf 1")))
                .andExpect(jsonPath("$.pickupOtp", notNullValue()))
                .andExpect(jsonPath("$.qrCodeToken", notNullValue()))
                .andExpect(jsonPath("$.isPerishable", is(true)))
                .andExpect(jsonPath("$.status", is("RECEIVED")));
    }

    @Test
    @DisplayName("PUT /api/v1/parcels/{id}/verify-otp - Desk OTP pickup verification")
    void testVerifyOtpHandover() throws Exception {
        Parcel p = new Parcel(testTenant, "Delhivery Express");
        p.setOrganization(testOrg);
        p.setPickupOtp("5821");
        p = parcelRepository.saveAndFlush(p);

        // 1. Test with Wrong OTP
        mockMvc.perform(put("/api/v1/parcels/" + p.getId() + "/verify-otp")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("otp", "0000"))))
                .andExpect(status().isBadRequest());

        // 2. Test with Correct OTP
        mockMvc.perform(put("/api/v1/parcels/" + p.getId() + "/verify-otp")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("otp", "5821"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COLLECTED")))
                .andExpect(jsonPath("$.handoverMethod", is("OTP")))
                .andExpect(jsonPath("$.handedOverBy", notNullValue()));
    }

    @Test
    @DisplayName("PUT /api/v1/parcels/{id}/handover - Digital signature and delegate handover")
    void testHandoverWithSignatureAndDelegate() throws Exception {
        Parcel p = new Parcel(testTenant, "BlueDart");
        p.setOrganization(testOrg);
        p = parcelRepository.saveAndFlush(p);

        Map<String, String> body = new HashMap<>();
        body.put("signature", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=");
        body.put("handoverMethod", "DELEGATE");
        body.put("delegateName", "Rohan Sharma (Roommate)");
        body.put("delegatePhone", "9876543210");

        mockMvc.perform(put("/api/v1/parcels/" + p.getId() + "/handover")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COLLECTED")))
                .andExpect(jsonPath("$.handoverMethod", is("DELEGATE")))
                .andExpect(jsonPath("$.delegateName", is("Rohan Sharma (Roommate)")));
    }

    @Test
    @DisplayName("PUT /api/v1/parcels/{id}/delegate - Resident authorizes roommate pickup")
    void testDelegatePickup() throws Exception {
        Parcel p = new Parcel(testTenant, "Zomato Blinkit");
        p.setOrganization(testOrg);
        p = parcelRepository.saveAndFlush(p);

        mockMvc.perform(put("/api/v1/parcels/" + p.getId() + "/delegate")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "delegateName", "Suresh Roommate",
                                "delegatePhone", "9988776655"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delegateName", is("Suresh Roommate")));
    }

    @Test
    @DisplayName("POST /api/v1/parcels/{id}/send-reminder - Desk triggers WhatsApp reminder")
    void testSendReminder() throws Exception {
        Parcel p = new Parcel(testTenant, "DTDC Express");
        p.setOrganization(testOrg);
        p = parcelRepository.saveAndFlush(p);

        mockMvc.perform(post("/api/v1/parcels/" + p.getId() + "/send-reminder")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reminderCount", is(1)));
    }
}
