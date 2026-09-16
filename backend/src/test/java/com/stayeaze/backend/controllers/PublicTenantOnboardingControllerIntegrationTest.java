package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PublicTenantOnboardingControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private BedRepository bedRepository;

    private Organization testOrg;
    private Property testProperty;

    @BeforeEach
    void setUp() {
        testOrg = new Organization();
        testOrg.setName("Public Onboard Org " + System.currentTimeMillis());
        testOrg.setSubdomain("onboardorg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        testProperty = new Property();
        testProperty.setOrganization(testOrg);
        testProperty.setName("Public Living Hub");
        testProperty.setCode("PLH-01");
        testProperty.setType("PG");
        testProperty.setAddress("Electronic City Phase 1");
        testProperty.setCity("Bengaluru");
        testProperty.setState("Karnataka");
        testProperty.setStatus("ACTIVE");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        Building bld = new Building(testProperty, "Wing A", "W-A");
        bld = buildingRepository.saveAndFlush(bld);

        Floor flr = new Floor(bld, 1, "Floor 1");
        flr = floorRepository.saveAndFlush(flr);

        Room room = new Room(flr, "101", "SINGLE", BigDecimal.valueOf(14000));
        roomRepository.saveAndFlush(room);
    }

    @Test
    @DisplayName("GET /public/tenants/properties - List public properties")
    void testGetPublicProperties() throws Exception {
        mockMvc.perform(get("/api/v1/public/tenants/properties")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @DisplayName("GET /public/tenants/properties/{id} - Get single public property details")
    void testGetPublicPropertyById() throws Exception {
        mockMvc.perform(get("/api/v1/public/tenants/properties/" + testProperty.getId())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Public Living Hub")));
    }

    @Test
    @DisplayName("POST /public/tenants/onboard - Rejects when ID proof or agreement is missing")
    void testPublicOnboardRequiresIdProofAndAgreement() throws Exception {
        String randomMobile = "9" + String.format("%09d", Math.abs(new java.util.Random().nextInt(1_000_000_000)));
        String payloadWithoutAgreement = """
            {
                "firstName": "Rohan",
                "lastName": "Sharma",
                "email": "rohan%s@test.com",
                "mobile": "%s",
                "propertyId": "%s",
                "roomNumber": "101",
                "rent": 14000,
                "deposit": 15000,
                "paymentMethod": "CASH"
            }
        """.formatted(System.currentTimeMillis(), randomMobile, testProperty.getId());

        mockMvc.perform(post("/api/v1/public/tenants/onboard")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadWithoutAgreement))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Identity document type and ID number are required")));

        String payloadWithoutAgreementAcceptance = """
            {
                "firstName": "Rohan",
                "lastName": "Sharma",
                "email": "rohan%s@test.com",
                "mobile": "%s",
                "propertyId": "%s",
                "idType": "AADHAAR",
                "idNumber": "123456789012",
                "roomNumber": "101",
                "rent": 14000,
                "deposit": 15000,
                "paymentMethod": "CASH",
                "isAgreementAccepted": false
            }
        """.formatted(System.currentTimeMillis() + 1, randomMobile, testProperty.getId());

        mockMvc.perform(post("/api/v1/public/tenants/onboard")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadWithoutAgreementAcceptance))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Tenancy agreement acceptance and digital signature are mandatory")));
    }

    @Test
    @DisplayName("POST /public/tenants/onboard - Success with ID proof and digital agreement acceptance")
    void testPublicOnboardSuccessWithAgreement() throws Exception {
        String randomMobile = "9" + String.format("%09d", Math.abs(new java.util.Random().nextInt(1_000_000_000)));
        String email = "rohan" + System.currentTimeMillis() + "@test.com";
        String validPayload = """
            {
                "firstName": "Rohan",
                "lastName": "Sharma",
                "email": "%s",
                "mobile": "%s",
                "propertyId": "%s",
                "idType": "AADHAAR",
                "idNumber": "998877665544",
                "isAgreementAccepted": true,
                "roomNumber": "101",
                "rent": 14000,
                "deposit": 15000,
                "paymentMethod": "CASH"
            }
        """.formatted(email, randomMobile, testProperty.getId());

        String responseBody = mockMvc.perform(post("/api/v1/public/tenants/onboard")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.firstName", is("Rohan")))
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode rootNode = new com.fasterxml.jackson.databind.ObjectMapper().readTree(responseBody);
        java.util.UUID tenantId = java.util.UUID.fromString(rootNode.get("id").asText());

        Tenant createdTenant = tenantRepository.findByIdSuperAdmin(tenantId).orElse(null);
        org.junit.jupiter.api.Assertions.assertNotNull(createdTenant);
        org.junit.jupiter.api.Assertions.assertTrue(Boolean.TRUE.equals(createdTenant.getIsAgreementAccepted()));
        org.junit.jupiter.api.Assertions.assertEquals("AADHAAR", createdTenant.getIdType());
        org.junit.jupiter.api.Assertions.assertEquals("998877665544", createdTenant.getIdNumber());

        var agreements = agreementRepository.findByTenant(createdTenant);
        org.junit.jupiter.api.Assertions.assertFalse(agreements.isEmpty());
        org.junit.jupiter.api.Assertions.assertEquals("SIGNED", agreements.get(0).getStatus());
    }

    @Test
    @DisplayName("POST /public/tenants/create-order - Full Month with Advance Credit policy returns accurate breakdown")
    void testCreateOrderFullWithAdvanceCredit() throws Exception {
        OrganizationBillingProfile bp = new OrganizationBillingProfile(testOrg);
        bp.setOnboardingBillingPolicy("FULL_WITH_ADVANCE_CREDIT");
        bp.setDefaultSecurityDeposit(BigDecimal.valueOf(15000));
        billingProfileRepository.saveAndFlush(bp);

        String payload = """
            {
                "propertyId": "%s",
                "roomNumber": "101",
                "tenantName": "Aryan Khan",
                "tenantEmail": "aryan@test.com",
                "tenantPhone": "9876543210"
            }
        """.formatted(testProperty.getId());

        mockMvc.perform(post("/api/v1/public/tenants/create-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingBillingPolicy", is("FULL_WITH_ADVANCE_CREDIT")))
                .andExpect(jsonPath("$.rentAmount", is(14000)))
                .andExpect(jsonPath("$.depositAmount", is(15000)))
                .andExpect(jsonPath("$.amountFormatted", is(29000)));
    }

    @Test
    @DisplayName("POST /public/tenants/create-order - PRORATA_ONLY policy charges prorated rent upfront")
    void testCreateOrderProrataOnly() throws Exception {
        OrganizationBillingProfile bp = new OrganizationBillingProfile(testOrg);
        bp.setOnboardingBillingPolicy("PRORATA_ONLY");
        bp.setDefaultSecurityDeposit(BigDecimal.valueOf(15000));
        billingProfileRepository.saveAndFlush(bp);

        String payload = """
            {
                "propertyId": "%s",
                "roomNumber": "101",
                "tenantName": "Sameer Varma",
                "tenantEmail": "sameer@test.com",
                "tenantPhone": "9876543211"
            }
        """.formatted(testProperty.getId());

        var res = mockMvc.perform(post("/api/v1/public/tenants/create-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingBillingPolicy", is("PRORATA_ONLY")))
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode rootNode = new com.fasterxml.jackson.databind.ObjectMapper().readTree(res);
        boolean isMidMonth = rootNode.get("isMidMonth").asBoolean();
        if (isMidMonth) {
            double rentCharged = rootNode.get("rentCharged").asDouble();
            org.junit.jupiter.api.Assertions.assertTrue(rentCharged <= 14000);
        }
    }

    @Test
    @DisplayName("POST /public/tenants/onboard - Correctly prorates invoice and credits advance balance under FULL_WITH_ADVANCE_CREDIT")
    void testOnboardWithAdvanceCreditPolicy() throws Exception {
        OrganizationBillingProfile bp = new OrganizationBillingProfile(testOrg);
        bp.setOnboardingBillingPolicy("FULL_WITH_ADVANCE_CREDIT");
        billingProfileRepository.saveAndFlush(bp);

        String randomMobile = "9" + String.format("%09d", Math.abs(new java.util.Random().nextInt(1_000_000_000)));
        String email = "advance" + System.currentTimeMillis() + "@test.com";
        String payload = """
            {
                "firstName": "Advik",
                "lastName": "Kumar",
                "email": "%s",
                "mobile": "%s",
                "propertyId": "%s",
                "idType": "AADHAAR",
                "idNumber": "112233445566",
                "isAgreementAccepted": true,
                "roomNumber": "101",
                "paymentMethod": "CASH"
            }
        """.formatted(email, randomMobile, testProperty.getId());

        String responseBody = mockMvc.perform(post("/api/v1/public/tenants/onboard")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode rootNode = new com.fasterxml.jackson.databind.ObjectMapper().readTree(responseBody);
        java.util.UUID tenantId = java.util.UUID.fromString(rootNode.get("id").asText());

        Tenant tenant = tenantRepository.findByIdSuperAdmin(tenantId).orElseThrow();
        var invoices = invoiceRepository.findByTenant(tenant);
        org.junit.jupiter.api.Assertions.assertFalse(invoices.isEmpty());

        java.time.LocalDate today = java.time.LocalDate.now();
        if (today.getDayOfMonth() > 1) {
            org.junit.jupiter.api.Assertions.assertNotNull(tenant.getAdvanceBalance());
            org.junit.jupiter.api.Assertions.assertTrue(tenant.getAdvanceBalance().compareTo(BigDecimal.ZERO) > 0);
        }
    }

    @Test
    @DisplayName("POST /public/tenants/create-order & /onboard - Authoritatively enforces DB room rent and ignores client tampering")
    void testAuthoritativePricingAntiTampering() throws Exception {
        OrganizationBillingProfile bp = new OrganizationBillingProfile(testOrg);
        bp.setDefaultSecurityDeposit(BigDecimal.valueOf(12000));
        billingProfileRepository.saveAndFlush(bp);

        // 1. Client attempts to pass rent: 1 and deposit: 1 in /create-order
        String orderTamperedPayload = """
            {
                "propertyId": "%s",
                "roomNumber": "101",
                "rent": 1,
                "deposit": 1,
                "tenantName": "Attacker",
                "tenantEmail": "attacker@test.com",
                "tenantPhone": "9876543299"
            }
        """.formatted(testProperty.getId());

        mockMvc.perform(post("/api/v1/public/tenants/create-order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderTamperedPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rentAmount", is(14000))) // Authoritative room rent enforced
                .andExpect(jsonPath("$.depositAmount", is(12000))); // Authoritative deposit enforced

        // 2. Client attempts to pass rent: 1 and deposit: 1 in /onboard
        String randomMobile = "9" + String.format("%09d", Math.abs(new java.util.Random().nextInt(1_000_000_000)));
        String email = "tamper" + System.currentTimeMillis() + "@test.com";
        String onboardTamperedPayload = """
            {
                "firstName": "Siddharth",
                "lastName": "Roy",
                "email": "%s",
                "mobile": "%s",
                "propertyId": "%s",
                "roomNumber": "101",
                "idType": "AADHAAR",
                "idNumber": "887766554433",
                "isAgreementAccepted": true,
                "rent": 1,
                "deposit": 1,
                "paymentMethod": "CASH"
            }
        """.formatted(email, randomMobile, testProperty.getId());

        String responseBody = mockMvc.perform(post("/api/v1/public/tenants/onboard")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardTamperedPayload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode rootNode = new com.fasterxml.jackson.databind.ObjectMapper().readTree(responseBody);
        java.util.UUID tenantId = java.util.UUID.fromString(rootNode.get("id").asText());

        Tenant tenant = tenantRepository.findByIdSuperAdmin(tenantId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.valueOf(14000).compareTo(tenant.getRent()));
        org.junit.jupiter.api.Assertions.assertEquals(0, BigDecimal.valueOf(12000).compareTo(tenant.getDeposit()));
    }

    @Test
    @DisplayName("POST /public/tenants/onboard - Rejects when selected bed is already occupied")
    void testBedOccupancyConflictRejection() throws Exception {
        Room room = roomRepository.findByPropertyIdNative(testProperty.getId()).get(0);
        Bed occupiedBed = new Bed(room, "B1");
        occupiedBed.setStatus("OCCUPIED");
        bedRepository.saveAndFlush(occupiedBed);

        String randomMobile = "9" + String.format("%09d", Math.abs(new java.util.Random().nextInt(1_000_000_000)));
        String email = "conflict" + System.currentTimeMillis() + "@test.com";
        String payload = """
            {
                "firstName": "Karan",
                "lastName": "Mehta",
                "email": "%s",
                "mobile": "%s",
                "propertyId": "%s",
                "roomNumber": "101",
                "bedNumber": "B1",
                "idType": "PASSPORT",
                "idNumber": "Z1234567",
                "isAgreementAccepted": true,
                "paymentMethod": "CASH"
            }
        """.formatted(email, randomMobile, testProperty.getId());

        mockMvc.perform(post("/api/v1/public/tenants/onboard")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already occupied")));
    }
}
