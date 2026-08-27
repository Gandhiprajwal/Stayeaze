package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountUniquenessServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantRepository tenantRepository;

    @InjectMocks
    private AccountUniquenessService service;

    private Organization organization;
    private User propertyManagerUser;
    private Tenant activeResident;
    private Tenant checkedOutResident;

    @BeforeEach
    void setUp() {
        organization = new Organization();
        organization.setId(UUID.randomUUID());
        organization.setName("StayEaze Test Org");

        // Staff User (Property Manager)
        propertyManagerUser = new User();
        propertyManagerUser.setId(UUID.randomUUID());
        propertyManagerUser.setEmail("manager@stayeaze.com");
        propertyManagerUser.setMobile("9458242450");
        propertyManagerUser.setFirstName("Prajwal");
        propertyManagerUser.setOrganization(organization);
        
        Role pmRole = new Role("ROLE_PROPERTY_MANAGER", "[]");
        propertyManagerUser.setRoles(Collections.singleton(pmRole));

        // Active Resident
        activeResident = new Tenant();
        activeResident.setId(UUID.randomUUID());
        activeResident.setFirstName("Rohan");
        activeResident.setEmail("rohan@gmail.com");
        activeResident.setMobile("9876543210");
        activeResident.setRoomNumber("101");
        activeResident.setStatus("ACTIVE");
        activeResident.setOrganization(organization);

        // Checked-out (Archived) Resident
        checkedOutResident = new Tenant();
        checkedOutResident.setId(UUID.randomUUID());
        checkedOutResident.setFirstName("Ankit");
        checkedOutResident.setEmail("ankit.old@gmail.com");
        checkedOutResident.setMobile("9123456789");
        checkedOutResident.setRoomNumber("102");
        checkedOutResident.setStatus("CHECKED_OUT");
        checkedOutResident.setOrganization(organization);
    }

    @Test
    @DisplayName("Scenario 1: Adding a tenant with Property Manager's email must be BLOCKED")
    void testTenantCreationWithStaffEmail_ShouldThrow() {
        when(userRepository.findByEmail("manager@stayeaze.com")).thenReturn(Optional.of(propertyManagerUser));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validateTenantEmailAndMobile(organization, "manager@stayeaze.com", "9998887776", null, null)
        );

        assertTrue(ex.getMessage().contains("already registered to a staff member (PROPERTY_MANAGER)"));
    }

    @Test
    @DisplayName("Scenario 1b: Adding a tenant with Property Manager's mobile must be BLOCKED")
    void testTenantCreationWithStaffMobile_ShouldThrow() {
        when(userRepository.findByMobile("9458242450")).thenReturn(Optional.of(propertyManagerUser));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validateTenantEmailAndMobile(organization, "newtenant@gmail.com", "9458242450", null, null)
        );

        assertTrue(ex.getMessage().contains("already registered to a staff member (PROPERTY_MANAGER)"));
    }

    @Test
    @DisplayName("Scenario 2: Phone number normalization (+91, 0, spaces, dashes) should resolve to 10-digits")
    void testPhoneNormalization() {
        assertEquals("9458242450", service.normalizeMobile("+91 94582 42450"));
        assertEquals("9458242450", service.normalizeMobile("+91-94582-42450"));
        assertEquals("9458242450", service.normalizeMobile("09458242450"));
        assertEquals("9458242450", service.normalizeMobile("9458242450"));
    }

    @Test
    @DisplayName("Scenario 3: Case-insensitive email normalization")
    void testEmailNormalization() {
        assertEquals("manager@stayeaze.com", service.normalizeEmail("  Manager@STAYEAZE.com  "));
    }

    @Test
    @DisplayName("Scenario 4: Bulk CSV import with duplicate mobile within the file must be BLOCKED")
    void testBulkImportIntraFileDuplicateMobile_ShouldThrow() {
        Set<String> seenMobiles = new HashSet<>();
        Set<String> seenEmails = new HashSet<>();

        // Row 1 passes
        service.validateBulkImportRow(organization, "row1@gmail.com", "9876543211", 1, seenEmails, seenMobiles);

        // Row 2 with same mobile throws
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validateBulkImportRow(organization, "row2@gmail.com", "9876543211", 2, seenEmails, seenMobiles)
        );

        assertTrue(ex.getMessage().contains("Row 2: Duplicate mobile number \"9876543211\""));
    }

    @Test
    @DisplayName("Scenario 5: Adding a resident with a checked-out resident's mobile/email should be ALLOWED")
    void testReturningCheckedOutResident_ShouldAllow() {
        when(userRepository.findByEmail("ankit.old@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByMobile("9123456789")).thenReturn(Optional.empty());
        when(tenantRepository.findByOrganization(organization)).thenReturn(Collections.singletonList(checkedOutResident));

        assertDoesNotThrow(() ->
                service.validateTenantEmailAndMobile(organization, "ankit.old@gmail.com", "9123456789", null, null)
        );
    }

    @Test
    @DisplayName("Scenario 6: Editing a resident with unchanged email/mobile should not trigger self-conflict")
    void testEditResidentSelfConflict_ShouldAllow() {
        when(userRepository.findByEmail("rohan@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.empty());
        when(tenantRepository.findByOrganization(organization)).thenReturn(Collections.singletonList(activeResident));

        assertDoesNotThrow(() ->
                service.validateTenantEmailAndMobile(organization, "rohan@gmail.com", "9876543210", null, activeResident.getId())
        );
    }

    @Test
    @DisplayName("Scenario 7: Emergency contact matching resident mobile should be BLOCKED")
    void testEmergencyContactSelfReference_ShouldThrow() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validateTenantEmailAndMobile(organization, "tenant@gmail.com", "9876543210", "9876543210", null)
        );

        assertTrue(ex.getMessage().contains("Emergency contact mobile number cannot be identical"));
    }

    @Test
    @DisplayName("Scenario 8: Creating staff user with active resident email/mobile must be BLOCKED")
    void testStaffUserCreationWithResidentDetails_ShouldThrow() {
        when(userRepository.findByEmail("rohan@gmail.com")).thenReturn(Optional.empty());
        when(tenantRepository.findByOrganization(organization)).thenReturn(Collections.singletonList(activeResident));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validateStaffEmailAndMobile(organization, "rohan@gmail.com", "9998887776", null)
        );

        assertTrue(ex.getMessage().contains("currently assigned to active resident: Rohan"));
    }
}
