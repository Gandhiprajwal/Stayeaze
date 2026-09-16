package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class DatabaseResetAndSeedIntegrationTest {

    @Autowired
    private DatabaseResetService databaseResetService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private SaaSPlanRepository saaSPlanRepository;

    @Autowired
    private SystemIntegrationSettingsRepository systemIntegrationSettingsRepository;

    @Autowired
    private RoleRepository roleRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @Test
    @DisplayName("Trigger Full Database Reset and Relational Database Seed")
    void testResetAndSeedDatabase() {
        // 1. Execute Full Database Reset & Fresh Relational Seed
        databaseResetService.resetAllTables();
        if (entityManager != null) {
            entityManager.clear();
        }

        // 2. Verify System Roles
        assertTrue(roleRepository.findByName(ERole.SUPER_ADMIN).isPresent(), "SUPER_ADMIN should exist");
        assertTrue(roleRepository.findByName(ERole.OWNER).isPresent(), "OWNER should exist");
        assertTrue(roleRepository.findByName(ERole.PROPERTY_MANAGER).isPresent(), "PROPERTY_MANAGER should exist");
        assertTrue(roleRepository.findByName(ERole.ACCOUNTANT).isPresent(), "ACCOUNTANT should exist");
        assertTrue(roleRepository.findByName(ERole.RECEPTIONIST).isPresent(), "RECEPTIONIST should exist");
        assertTrue(roleRepository.findByName(ERole.SECURITY_GUARD).isPresent(), "SECURITY_GUARD should exist");
        assertTrue(roleRepository.findByName(ERole.STAFF).isPresent(), "STAFF should exist");
        assertTrue(roleRepository.findByName(ERole.TENANT).isPresent(), "TENANT should exist");

        // 3. Verify Seeded Users
        Optional<User> superAdmin = userRepository.findByEmail("superadmin@stayeaze.com");
        assertTrue(superAdmin.isPresent(), "Super Admin user must exist");

        Optional<User> owner = userRepository.findByEmail("owner@stayeaze.com");
        assertTrue(owner.isPresent(), "Owner user must exist");

        Optional<User> manager = userRepository.findByEmail("manager@stayeaze.com");
        assertTrue(manager.isPresent(), "Property Manager user must exist");

        // 4. Verify Organizations
        List<Organization> orgs = organizationRepository.findAll();
        assertFalse(orgs.isEmpty(), "Organizations must be seeded");
        assertTrue(orgs.stream().anyMatch(o -> "stayeaze".equals(o.getSubdomain()) || "demo".equals(o.getSubdomain()) || o.getName().contains("StayEaze")),
                "Demo organization must be seeded");

        // 5. Verify SaaS Plans
        List<SaaSPlan> plans = saaSPlanRepository.findAll();
        assertFalse(plans.isEmpty(), "SaaS Plans must be seeded");

        // 6. Verify Properties & Beds
        List<Property> properties = propertyRepository.findAllSuperAdmin();
        assertFalse(properties.isEmpty(), "Properties must be seeded");

        List<Bed> beds = bedRepository.findAll();
        assertFalse(beds.isEmpty(), "Beds inventory must be seeded");

        // 7. Verify System Integration Settings
        List<SystemIntegrationSettings> settings = systemIntegrationSettingsRepository.findAll();
        assertFalse(settings.isEmpty(), "System integration settings must be seeded");
    }
}
