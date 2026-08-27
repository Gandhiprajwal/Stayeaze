package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.*;

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
    private ObjectMapper objectMapper;

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
}
