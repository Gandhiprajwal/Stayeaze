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
public class OrganizationFinancialSettingsIntegrationTest {

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
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    private Organization organization;
    private User ownerUser;
    private User tenantUser;
    private UsernamePasswordAuthenticationToken authOwner;
    private UsernamePasswordAuthenticationToken authTenant;

    @BeforeEach
    void setUp() {
        organization = new Organization("Test PG Services", "testpg" + System.currentTimeMillis());
        organization.setGstEnabled(false);
        organization.setGstin("");
        organization.setGstTradeName("Test PG Services");
        organization.setDefaultGstRate(new BigDecimal("18.00"));
        organization = organizationRepository.save(organization);

        Role ownerRole = roleRepository.findByName("ROLE_OWNER")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_OWNER", "[]")));
        Role tenantRole = roleRepository.findByName("ROLE_TENANT")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_TENANT", "[]")));

        Set<Role> ownerRoles = new HashSet<>();
        ownerRoles.add(ownerRole);

        ownerUser = new User(organization, "owner_gst_test_" + System.currentTimeMillis() + "@stayeaze.com", "encodedpass", "9988776655");
        ownerUser.setFirstName("Owner Admin");
        ownerUser.setRoles(ownerRoles);
        ownerUser = userRepository.save(ownerUser);

        UserDetailsImpl ownerDetails = UserDetailsImpl.build(ownerUser);
        authOwner = new UsernamePasswordAuthenticationToken(
                ownerDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER"))
        );

        Set<Role> tenantRoles = new HashSet<>();
        tenantRoles.add(tenantRole);

        tenantUser = new User(organization, "tenant_gst_test_" + System.currentTimeMillis() + "@stayeaze.com", "encodedpass", "9988776644");
        tenantUser.setFirstName("Tenant User");
        tenantUser.setRoles(tenantRoles);
        tenantUser = userRepository.save(tenantUser);

        UserDetailsImpl tenantDetails = UserDetailsImpl.build(tenantUser);
        authTenant = new UsernamePasswordAuthenticationToken(
                tenantDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_TENANT"))
        );

        SecurityContextHolder.getContext().setAuthentication(authOwner);
    }

    @Test
    @DisplayName("Scenario 1: GET /financial-settings - Should return default GST disabled state for PG hostel exemption")
    void test1_GetFinancialSettings_ReturnsDefaultGstDisabledState() throws Exception {
        mockMvc.perform(get("/api/v1/organization/financial-settings")
                        .with(authentication(authOwner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstEnabled", is(false)))
                .andExpect(jsonPath("$.gstin", is("")))
                .andExpect(jsonPath("$.organizationName", is("Test PG Services")));
    }

    @Test
    @DisplayName("Scenario 2: PUT /financial-settings - Invalid GSTIN format should be rejected with 400 Bad Request")
    void test2_UpdateFinancialSettings_InvalidGstinFormat_ReturnsBadRequest() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gstEnabled", true);
        payload.put("gstin", "INVALID_GSTIN_123");
        payload.put("gstTradeName", "Test PG Services Ltd");
        payload.put("defaultGstRate", 18.0);

        mockMvc.perform(put("/api/v1/organization/financial-settings")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Invalid 15-digit GSTIN format")));
    }

    @Test
    @DisplayName("Scenario 3: PUT /financial-settings - Valid 15-digit GSTIN should update successfully")
    void test3_UpdateFinancialSettings_ValidGstin_UpdatesSuccessfully() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gstEnabled", true);
        payload.put("gstin", "27AAAAA0000A1Z5");
        payload.put("gstTradeName", "Test PG Services Private Limited");
        payload.put("defaultGstRate", 18.0);

        mockMvc.perform(put("/api/v1/organization/financial-settings")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstEnabled", is(true)))
                .andExpect(jsonPath("$.gstin", is("27AAAAA0000A1Z5")))
                .andExpect(jsonPath("$.gstTradeName", is("Test PG Services Private Limited")));
    }

    @Test
    @DisplayName("Scenario 4: GET /accountant/overview - When GST disabled, estimatedGstLiability should return 0")
    void test4_AccountantOverview_WhenGstDisabled_ReturnsZeroGstLiability() throws Exception {
        mockMvc.perform(get("/api/v1/accountant/overview")
                        .with(authentication(authOwner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstEnabled", is(false)))
                .andExpect(jsonPath("$.estimatedGstLiability", is(0)));
    }

    @Test
    @DisplayName("Scenario 5: GET /accountant/overview - When GST enabled, estimatedGstLiability should calculate 18% tax")
    void test5_AccountantOverview_WhenGstEnabled_CalculatesGstLiability() throws Exception {
        organization.setGstEnabled(true);
        organization.setGstin("27AAAAA0000A1Z5");
        organizationRepository.save(organization);

        Property property = new Property(organization, "Test Property", "Koramangala, Bangalore");
        property = propertyRepository.save(property);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Rahul");
        tenant.setLastName("Sharma");
        tenant.setEmail("rahul@test.com");
        tenant.setMobile("9876543210");
        tenant.setPropertyId(property.getId());
        tenant = tenantRepository.save(tenant);

        Invoice invoice = new Invoice();
        invoice.setTenant(tenant);
        invoice.setInvoiceNumber("INV-10001");
        invoice.setAmountDue(new BigDecimal("10000.00"));
        invoice.setAmountPaid(new BigDecimal("10000.00"));
        invoice.setStatus("PAID");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(7));
        invoiceRepository.save(invoice);

        mockMvc.perform(get("/api/v1/accountant/overview")
                        .with(authentication(authOwner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstEnabled", is(true)))
                .andExpect(jsonPath("$.estimatedGstLiability", is(1800.0)))
                .andExpect(jsonPath("$.totalCollections", is(10000.0)));
    }

    @Test
    @DisplayName("Scenario 6: GET /accountant/overview - Total Revenue Collections should accurately reflect paid invoices instead of 0")
    void test6_TotalCollections_ReflectsInvoicePayments() throws Exception {
        Property property = new Property(organization, "Test Hostel", "HSR Layout, Bangalore");
        property = propertyRepository.save(property);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Vikram");
        tenant.setLastName("Verma");
        tenant.setEmail("vikram@test.com");
        tenant.setMobile("9876543211");
        tenant.setPropertyId(property.getId());
        tenant = tenantRepository.save(tenant);

        Invoice invoice = new Invoice();
        invoice.setTenant(tenant);
        invoice.setInvoiceNumber("INV-20002");
        invoice.setAmountDue(new BigDecimal("15000.00"));
        invoice.setAmountPaid(new BigDecimal("15000.00"));
        invoice.setStatus("PAID");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(7));
        invoiceRepository.save(invoice);

        mockMvc.perform(get("/api/v1/accountant/overview")
                        .with(authentication(authOwner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCollections", is(15000.0)));
    }

    @Test
    @DisplayName("Scenario 7: Unauthorized Tenant Access - Attempting to modify GST settings should return 403 Forbidden")
    void test7_TenantRole_AttemptToModifySettings_ReturnsForbidden() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gstEnabled", true);
        payload.put("gstin", "27AAAAA0000A1Z5");
        payload.put("gstTradeName", "Hacked PG Services");
        payload.put("defaultGstRate", 18.0);

        mockMvc.perform(put("/api/v1/organization/financial-settings")
                        .with(authentication(authTenant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 8: Missing GSTIN when GST is enabled - Should return 400 Bad Request")
    void test8_MissingGstinWhenGstEnabled_ReturnsBadRequest() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gstEnabled", true);
        payload.put("gstin", "");
        payload.put("gstTradeName", "Test PG Services Ltd");
        payload.put("defaultGstRate", 18.0);

        mockMvc.perform(put("/api/v1/organization/financial-settings")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("GSTIN is required when GST is enabled")));
    }

    @Test
    @DisplayName("Scenario 9: Missing Trade Name when GST is enabled - Should return 400 Bad Request")
    void test9_MissingTradeNameWhenGstEnabled_ReturnsBadRequest() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gstEnabled", true);
        payload.put("gstin", "27AAAAA0000A1Z5");
        payload.put("gstTradeName", "   ");
        payload.put("defaultGstRate", 18.0);

        mockMvc.perform(put("/api/v1/organization/financial-settings")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("GST Trade Legal Name is required")));
    }

    @Test
    @DisplayName("Scenario 10: Invalid Tax Rate Range (> 28%) - Should return 400 Bad Request")
    void test10_InvalidTaxRateRange_ReturnsBadRequest() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gstEnabled", true);
        payload.put("gstin", "27AAAAA0000A1Z5");
        payload.put("gstTradeName", "Test PG Services Ltd");
        payload.put("defaultGstRate", 35.0);

        mockMvc.perform(put("/api/v1/organization/financial-settings")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("GST Tax Rate must be between 0% and 28%")));
    }

    @Test
    @DisplayName("Scenario 11: GET /accountant/gst-reports - When GST disabled, returns exemption status notice")
    void test11_GstTaxReportsEndpoint_WhenGstDisabled_ReturnsExemptionNotice() throws Exception {
        mockMvc.perform(get("/api/v1/accountant/gst-reports")
                        .with(authentication(authOwner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstEnabled", is(false)))
                .andExpect(jsonPath("$.totalGstLiability", is(0)));
    }

    @Test
    @DisplayName("Scenario 12: GET /accountant/gst-reports - When GST enabled, returns SAC 998314 and tax breakdowns")
    void test12_GstTaxReportsEndpoint_WhenGstEnabled_ReturnsTaxBreakdown() throws Exception {
        organization.setGstEnabled(true);
        organization.setGstin("27AAAAA0000A1Z5");
        organizationRepository.save(organization);

        Property property = new Property(organization, "Luxury Co-Living", "Indiranagar, Bangalore");
        property = propertyRepository.save(property);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Ananya");
        tenant.setLastName("Roy");
        tenant.setEmail("ananya@test.com");
        tenant.setMobile("9876543299");
        tenant.setPropertyId(property.getId());
        tenant = tenantRepository.save(tenant);

        Invoice invoice = new Invoice();
        invoice.setTenant(tenant);
        invoice.setInvoiceNumber("INV-30003");
        invoice.setAmountDue(new BigDecimal("20000.00"));
        invoice.setAmountPaid(new BigDecimal("20000.00"));
        invoice.setStatus("PAID");
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(7));
        invoiceRepository.save(invoice);

        mockMvc.perform(get("/api/v1/accountant/gst-reports")
                        .with(authentication(authOwner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gstEnabled", is(true)))
                .andExpect(jsonPath("$.sacCode", is("998314")))
                .andExpect(jsonPath("$.totalGstLiability", is(3050.85)))
                .andExpect(jsonPath("$.totalCgst", is(1525.43)))
                .andExpect(jsonPath("$.totalSgst", is(1525.42)));
    }

    @Test
    @DisplayName("Scenario 13: Recording payment with tenantId should auto-generate Paid Invoice and map to Tenant Account")
    void test13_RecordPayment_WithTenantId_GeneratesPaidInvoiceForTenantAccount() throws Exception {
        Property property = new Property(organization, "Grand Stay Co-Living", "Koramangala, Bangalore");
        property = propertyRepository.save(property);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Harry");
        tenant.setLastName("Gandhi");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543290");
        tenant.setPropertyId(property.getId());
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        Map<String, Object> paymentReq = new HashMap<>();
        paymentReq.put("tenantId", tenant.getId().toString());
        paymentReq.put("tenantName", "Harry Gandhi");
        paymentReq.put("propertyId", property.getId().toString());
        paymentReq.put("amount", 5000.0);
        paymentReq.put("method", "cash");
        paymentReq.put("status", "success");
        paymentReq.put("collectedBy", "Owner Admin");
        paymentReq.put("date", LocalDate.now().toString());

        // 1. Record payment as Owner
        mockMvc.perform(post("/api/v1/payments")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paymentReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount", is(5000.0)))
                .andExpect(jsonPath("$.tenantName", is("Harry Gandhi")));

        // 2. Fetch tenant portal invoices as Tenant
        mockMvc.perform(get("/api/v1/tenant-portal/invoices")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].status", is("PAID")))
                .andExpect(jsonPath("$[0].amountPaid", is(5000.0)));
    }

    @Test
    @DisplayName("Scenario 14: Recording payment should reconcile open unpaid invoice for Tenant Account")
    void test14_RecordPayment_ReconcilesExistingUnpaidInvoiceForTenant() throws Exception {
        Property property = new Property(organization, "Grand Stay Co-Living", "Koramangala, Bangalore");
        property = propertyRepository.save(property);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Rohan");
        tenant.setLastName("Mehta");
        tenant.setEmail("rohan@test.com");
        tenant.setMobile("9876543291");
        tenant.setPropertyId(property.getId());
        tenant = tenantRepository.save(tenant);

        Invoice unpaidInvoice = new Invoice();
        unpaidInvoice.setTenant(tenant);
        unpaidInvoice.setInvoiceNumber("INV-UNPAID-1");
        unpaidInvoice.setAmountDue(new BigDecimal("8000.00"));
        unpaidInvoice.setAmountPaid(BigDecimal.ZERO);
        unpaidInvoice.setStatus("UNPAID");
        unpaidInvoice.setIssueDate(LocalDate.now());
        unpaidInvoice.setDueDate(LocalDate.now().plusDays(7));
        unpaidInvoice = invoiceRepository.save(unpaidInvoice);

        Map<String, Object> paymentReq = new HashMap<>();
        paymentReq.put("tenantId", tenant.getId().toString());
        paymentReq.put("tenantName", "Rohan Mehta");
        paymentReq.put("propertyId", property.getId().toString());
        paymentReq.put("amount", 8000.0);
        paymentReq.put("method", "upi");
        paymentReq.put("status", "success");
        paymentReq.put("collectedBy", "Owner Admin");
        paymentReq.put("date", LocalDate.now().toString());

        mockMvc.perform(post("/api/v1/payments")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paymentReq)))
                .andExpect(status().isCreated());

        Invoice reconciled = invoiceRepository.findById(unpaidInvoice.getId()).orElse(null);
        org.junit.jupiter.api.Assertions.assertNotNull(reconciled);
        org.junit.jupiter.api.Assertions.assertEquals("PAID", reconciled.getStatus());
        org.junit.jupiter.api.Assertions.assertEquals(0, reconciled.getAmountPaid().compareTo(new BigDecimal("8000.00")));
    }

    @Test
    @DisplayName("Scenario 15: Recording payment when all invoices are paid should credit Tenant Advance Balance & generate Advance Invoice")
    void test15_RecordPayment_WhenAllInvoicesPaid_StoresAdvanceBalanceAndAdvanceInvoice() throws Exception {
        Property property = new Property(organization, "Grand Stay Co-Living", "Koramangala, Bangalore");
        property = propertyRepository.save(property);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Vikas");
        tenant.setLastName("Sharma");
        tenant.setEmail("vikas@test.com");
        tenant.setMobile("9876543292");
        tenant.setPropertyId(property.getId());
        tenant = tenantRepository.save(tenant);

        Invoice paidInvoice = new Invoice();
        paidInvoice.setTenant(tenant);
        paidInvoice.setInvoiceNumber("INV-SETTLED-1");
        paidInvoice.setAmountDue(new BigDecimal("9500.00"));
        paidInvoice.setAmountPaid(new BigDecimal("9500.00"));
        paidInvoice.setStatus("PAID");
        paidInvoice.setIssueDate(LocalDate.now());
        paidInvoice.setDueDate(LocalDate.now().plusDays(7));
        invoiceRepository.save(paidInvoice);

        Map<String, Object> paymentReq = new HashMap<>();
        paymentReq.put("tenantId", tenant.getId().toString());
        paymentReq.put("tenantName", "Vikas Sharma");
        paymentReq.put("propertyId", property.getId().toString());
        paymentReq.put("amount", 9500.0);
        paymentReq.put("method", "razorpay");
        paymentReq.put("status", "success");
        paymentReq.put("collectedBy", "Owner Admin");
        paymentReq.put("date", LocalDate.now().toString());

        mockMvc.perform(post("/api/v1/payments")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paymentReq)))
                .andExpect(status().isCreated());

        Tenant updatedTenant = tenantRepository.findById(tenant.getId()).orElse(null);
        org.junit.jupiter.api.Assertions.assertNotNull(updatedTenant);
        org.junit.jupiter.api.Assertions.assertEquals(0, updatedTenant.getAdvanceBalance().compareTo(new BigDecimal("9500.00")));
    }

    @Test
    @DisplayName("Scenario 16: Hierarchical Wi-Fi Resolution (Room Wi-Fi override over Floor and Property)")
    void test16_HierarchicalWifiResolution_RoomOverFloorOverProperty() throws Exception {
        Property property = new Property(organization, "Greenland Luxury PG", "Pune");
        property.setWifiSsid("Greenland_Prop_WiFi");
        property.setWifiPassword("PropPass@123");

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> floorRouter = new HashMap<>();
        floorRouter.put("id", "router-fl-2");
        floorRouter.put("ssid", "Greenland_Floor2_5G");
        floorRouter.put("password", "Floor2Pass@123");
        floorRouter.put("coverageType", "FLOORS");
        floorRouter.put("coveredFloorNames", List.of("2nd Floor"));
        hubNetworks.add(floorRouter);

        Map<String, Object> roomRouter = new HashMap<>();
        roomRouter.put("id", "router-rm-202");
        roomRouter.put("ssid", "Room 202 Custom WiFi");
        roomRouter.put("password", "Room202Pass@123");
        roomRouter.put("coverageType", "ROOMS");
        roomRouter.put("coveredRoomNumbers", List.of("202"));
        hubNetworks.add(roomRouter);

        property.setWifiNetworksJson(objectMapper.writeValueAsString(hubNetworks));
        property = propertyRepository.save(property);

        Building building = new Building(property, "Main Block", "BLK-A");
        building = buildingRepository.save(building);

        Floor floor = new Floor(building, 2, "2nd Floor");
        floor = floorRepository.save(floor);

        Room room = new Room(floor, "202", "DOUBLE", new BigDecimal("9500.00"));
        room = roomRepository.save(room);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Rahul");
        tenant.setLastName("Verma");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543299");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("202");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("Room 202 Custom WiFi")))
                .andExpect(jsonPath("$.wifiPassword", is("Room202Pass@123")))
                .andExpect(jsonPath("$.wifiType", is("ROOM 202 WI-FI")));
    }

    @Test
    @DisplayName("Scenario 17: Fallback to Floor Wi-Fi when Room Wi-Fi is unset")
    void test17_FallbackToFloorWifi_WhenRoomWifiUnset() throws Exception {
        Property property = new Property(organization, "Greenland PG 2", "Bangalore");
        property.setWifiSsid("Greenland_Prop_WiFi");
        property.setWifiPassword("PropPass@123");

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> floorRouter = new HashMap<>();
        floorRouter.put("id", "router-fl-3");
        floorRouter.put("ssid", "Greenland_Floor3_5G");
        floorRouter.put("password", "Floor3Pass@123");
        floorRouter.put("coverageType", "FLOORS");
        floorRouter.put("coveredFloorNames", List.of("3rd Floor"));
        hubNetworks.add(floorRouter);

        property.setWifiNetworksJson(objectMapper.writeValueAsString(hubNetworks));
        property = propertyRepository.save(property);

        Building building = new Building(property, "Block B", "BLK-B");
        building = buildingRepository.save(building);

        Floor floor = new Floor(building, 3, "3rd Floor");
        floor = floorRepository.save(floor);

        Room room = new Room(floor, "305", "SINGLE", new BigDecimal("12000.00"));
        room = roomRepository.save(room);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Amit");
        tenant.setLastName("Kumar");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543288");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("305");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("Greenland_Floor3_5G")))
                .andExpect(jsonPath("$.wifiPassword", is("Floor3Pass@123")))
                .andExpect(jsonPath("$.wifiType", is("3RD FLOOR WI-FI")));
    }

    @Test
    @DisplayName("Scenario 18: Fallback to Property Wi-Fi when both Room & Floor Wi-Fi are unset")
    void test18_FallbackToPropertyWifi_WhenRoomAndFloorUnset() throws Exception {
        Property property = new Property(organization, "Co-Living Residency", "Noida");
        property.setWifiSsid("CoLiving_Guest_WiFi");
        property.setWifiPassword("StayEaze@Noida");
        property = propertyRepository.save(property);

        Building building = new Building(property, "Tower A", "TWR-A");
        building = buildingRepository.save(building);

        Floor floor = new Floor(building, 1, "1st Floor");
        floor = floorRepository.save(floor);

        Room room = new Room(floor, "101", "DOUBLE", new BigDecimal("8500.00"));
        room = roomRepository.save(room);

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Sanjay");
        tenant.setLastName("Gupta");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543277");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("101");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("CoLiving_Guest_WiFi")))
                .andExpect(jsonPath("$.wifiPassword", is("StayEaze@Noida")))
                .andExpect(jsonPath("$.wifiType", is("PROPERTY WI-FI")));
    }

    @Test
    @DisplayName("Scenario 19: Wi-Fi Password Input Validation (< 8 characters returns 400 Bad Request)")
    void test19_WifiPasswordInputValidation_ShortPasswordReturnsBadRequest() throws Exception {
        Property property = new Property(organization, "Validation PG", "Delhi");
        property = propertyRepository.save(property);

        Map<String, Object> invalidReq = new HashMap<>();
        invalidReq.put("wifiPassword", "123");

        mockMvc.perform(put("/api/v1/properties/" + property.getId() + "/wifi-networks")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("at least 8 characters")));
    }

    @Test
    @DisplayName("Scenario 20: Role Authorization Guard (Tenant cannot mutate Centralized Wi-Fi credentials -> 403 Forbidden)")
    void test20_RoleAuthorizationGuard_TenantCannotUpdateWifiCredentials() throws Exception {
        Property property = new Property(organization, "Guard PG", "Mumbai");
        property = propertyRepository.save(property);

        Map<String, Object> req = new HashMap<>();
        req.put("wifiPassword", "ValidPass@123");

        mockMvc.perform(put("/api/v1/properties/" + property.getId() + "/wifi-networks")
                        .with(authentication(authTenant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 21: Update Centralized Wi-Fi Hub with Property Default and Floor-Specific Routers")
    void test21_UpdateCentralizedWifiHub_Success() throws Exception {
        Property property = new Property(organization, "Apex Co-Living Hub", "Hyderabad");
        property = propertyRepository.save(property);

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> router1 = new HashMap<>();
        router1.put("id", "router-1");
        router1.put("ssid", "Apex_Floor1_5G");
        router1.put("password", "Floor1Pass@123");
        router1.put("coverageType", "FLOORS");
        router1.put("coveredFloorNames", List.of("1st Floor"));
        router1.put("frequency", "5GHz");
        hubNetworks.add(router1);

        Map<String, Object> payload = new HashMap<>();
        payload.put("wifiSsid", "Apex_Campus_Default");
        payload.put("wifiPassword", "CampusPass@123");
        payload.put("wifiNetworksJson", objectMapper.writeValueAsString(hubNetworks));

        mockMvc.perform(put("/api/v1/properties/" + property.getId() + "/wifi-networks")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("Apex_Campus_Default")))
                .andExpect(jsonPath("$.wifiPassword", is("CampusPass@123")));
    }

    @Test
    @DisplayName("Scenario 22: Fast DSA Resolution from Hub - Tenant on Floor 1 gets Floor 1 Router")
    void test22_DsaResolution_TenantOnFloor1GetsFloor1Router() throws Exception {
        Property property = new Property(organization, "Matrix PG", "Pune");
        property.setWifiSsid("Matrix_Campus_Default");
        property.setWifiPassword("CampusDefault@123");

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> routerFloor1 = new HashMap<>();
        routerFloor1.put("id", "router-f1");
        routerFloor1.put("ssid", "Matrix_Floor1_UltraSpeed");
        routerFloor1.put("password", "Floor1Ultra@2026");
        routerFloor1.put("coverageType", "FLOORS");
        routerFloor1.put("coveredFloorNames", List.of("1st Floor"));
        hubNetworks.add(routerFloor1);

        property.setWifiNetworksJson(objectMapper.writeValueAsString(hubNetworks));
        property = propertyRepository.save(property);

        Building building = buildingRepository.save(new Building(property, "Wing A", "WA"));
        Floor floor = floorRepository.save(new Floor(building, 1, "1st Floor"));
        Room room = roomRepository.save(new Room(floor, "105", "SINGLE", new BigDecimal("11000.00")));

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Rohan");
        tenant.setLastName("Deshmukh");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543266");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("105");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("Matrix_Floor1_UltraSpeed")))
                .andExpect(jsonPath("$.wifiPassword", is("Floor1Ultra@2026")))
                .andExpect(jsonPath("$.wifiType", is("1ST FLOOR WI-FI")));
    }

    @Test
    @DisplayName("Scenario 23: Fast DSA Resolution from Hub - Tenant on Floor 3 with no specific router gets Property Default")
    void test23_DsaResolution_TenantOnFloor3GetsHubPropertyDefault() throws Exception {
        Property property = new Property(organization, "Zenith Living", "Noida");
        property.setWifiSsid("Zenith_Campus_Default");
        property.setWifiPassword("ZenithDefault@123");

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> routerFloor1 = new HashMap<>();
        routerFloor1.put("id", "router-f1");
        routerFloor1.put("ssid", "Zenith_Floor1_Only");
        routerFloor1.put("password", "Floor1Only@2026");
        routerFloor1.put("coverageType", "FLOORS");
        routerFloor1.put("coveredFloorNames", List.of("1st Floor"));
        hubNetworks.add(routerFloor1);

        property.setWifiNetworksJson(objectMapper.writeValueAsString(hubNetworks));
        property = propertyRepository.save(property);

        Building building = buildingRepository.save(new Building(property, "Wing B", "WB"));
        Floor floor3 = floorRepository.save(new Floor(building, 3, "3rd Floor"));
        Room room301 = roomRepository.save(new Room(floor3, "301", "SINGLE", new BigDecimal("13000.00")));

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Vikas");
        tenant.setLastName("Sharma");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543255");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("301");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("Zenith_Campus_Default")))
                .andExpect(jsonPath("$.wifiPassword", is("ZenithDefault@123")))
                .andExpect(jsonPath("$.wifiType", is("PROPERTY WI-FI")));
    }

    @Test
    @DisplayName("Scenario 24: Wi-Fi Hub Password Input Validation (< 8 characters returns 400 Bad Request)")
    void test24_WifiHubPasswordValidation_ShortPasswordReturnsBadRequest() throws Exception {
        Property property = new Property(organization, "ShortPass PG", "Gurgaon");
        property = propertyRepository.save(property);

        Map<String, Object> payload = new HashMap<>();
        payload.put("wifiPassword", "12345"); // < 8 characters

        mockMvc.perform(put("/api/v1/properties/" + property.getId() + "/wifi-networks")
                        .with(authentication(authOwner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("at least 8 characters")));
    }

    @Test
    @DisplayName("Scenario 25: Security Guard - Tenant Cannot Mutate Centralized Wi-Fi Hub -> 403 Forbidden")
    void test25_SecurityGuard_TenantCannotMutateWifiHub() throws Exception {
        Property property = new Property(organization, "Guard Hub PG", "Kolkata");
        property = propertyRepository.save(property);

        Map<String, Object> payload = new HashMap<>();
        payload.put("wifiPassword", "ValidPass@123");

        mockMvc.perform(put("/api/v1/properties/" + property.getId() + "/wifi-networks")
                        .with(authentication(authTenant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scenario 26: Multi-Building Wi-Fi Resolution - Tenant in Block B gets Block B Building Router")
    void test26_MultiBuildingWifiResolution_TenantInBlockB() throws Exception {
        Property property = new Property(organization, "Grand Multi-Tower Campus", "Chennai");
        property.setWifiSsid("Campus_Master_WiFi");
        property.setWifiPassword("MasterPass@123");

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> blockBRouter = new HashMap<>();
        blockBRouter.put("id", "router-block-b");
        blockBRouter.put("ssid", "BlockB_Tower_HighSpeed");
        blockBRouter.put("password", "BlockBPass@2026");
        blockBRouter.put("coverageType", "BUILDINGS");
        blockBRouter.put("coveredBuildingNames", List.of("Tower B"));
        hubNetworks.add(blockBRouter);

        property.setWifiNetworksJson(objectMapper.writeValueAsString(hubNetworks));
        property = propertyRepository.save(property);

        Building towerB = buildingRepository.save(new Building(property, "Tower B", "TWR-B"));
        Floor floor2 = floorRepository.save(new Floor(towerB, 2, "2nd Floor"));
        Room room201 = roomRepository.save(new Room(floor2, "201", "DOUBLE", new BigDecimal("9500.00")));

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Karthik");
        tenant.setLastName("Raja");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543244");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("201");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("BlockB_Tower_HighSpeed")))
                .andExpect(jsonPath("$.wifiPassword", is("BlockBPass@2026")))
                .andExpect(jsonPath("$.wifiType", is("TOWER B BUILDING WI-FI")));
    }

    @Test
    @DisplayName("Scenario 27: Building-Aware Room Router Resolution - Room 101 in Tower B resolves correctly")
    void test27_BuildingAwareRoomRouterResolution() throws Exception {
        Property property = new Property(organization, "Imperial PG Complex", "Delhi");
        property.setWifiSsid("Imperial_Campus_Default");
        property.setWifiPassword("CampusDefault@123");

        List<Map<String, Object>> hubNetworks = new ArrayList<>();
        Map<String, Object> roomRouter = new HashMap<>();
        roomRouter.put("id", "router-room-101-b");
        roomRouter.put("ssid", "TowerB_Room101_Exclusive");
        roomRouter.put("password", "Exclusive@2026");
        roomRouter.put("coverageType", "ROOMS");
        roomRouter.put("targetBuildingName", "Tower B");
        roomRouter.put("coveredBuildingNames", List.of("Tower B"));
        roomRouter.put("coveredRoomNumbers", List.of("101"));
        hubNetworks.add(roomRouter);

        property.setWifiNetworksJson(objectMapper.writeValueAsString(hubNetworks));
        property = propertyRepository.save(property);

        Building towerB = buildingRepository.save(new Building(property, "Tower B", "TWR-B"));
        Floor floor1 = floorRepository.save(new Floor(towerB, 1, "1st Floor"));
        Room room101 = roomRepository.save(new Room(floor1, "101", "SINGLE", new BigDecimal("15000.00")));

        Tenant tenant = new Tenant();
        tenant.setOrganization(organization);
        tenant.setFirstName("Manish");
        tenant.setLastName("Kumar");
        tenant.setEmail(tenantUser.getEmail());
        tenant.setMobile("9876543233");
        tenant.setPropertyId(property.getId());
        tenant.setRoomNumber("101");
        tenant = tenantRepository.save(tenant);

        tenantUser.setTenantId(tenant.getId());
        userRepository.save(tenantUser);

        mockMvc.perform(get("/api/v1/tenant-portal/overview")
                        .with(authentication(authTenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wifiSsid", is("TowerB_Room101_Exclusive")))
                .andExpect(jsonPath("$.wifiPassword", is("Exclusive@2026")))
                .andExpect(jsonPath("$.wifiType", is("ROOM 101 WI-FI")));
    }
}
