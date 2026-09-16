package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.BookingRepository;
import com.stayeaze.backend.repository.BuildingRepository;
import com.stayeaze.backend.repository.ComplaintRepository;
import com.stayeaze.backend.repository.ExpenseRepository;
import com.stayeaze.backend.repository.FloorRepository;
import com.stayeaze.backend.repository.MaintenanceRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.repository.VisitorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PropertyLifecycleServiceTest {

    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private BuildingRepository buildingRepository;
    @Mock
    private FloorRepository floorRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private BedRepository bedRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ComplaintRepository complaintRepository;
    @Mock
    private MaintenanceRepository maintenanceRepository;
    @Mock
    private VisitorRepository visitorRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ExpenseRepository expenseRepository;
    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private PropertyService propertyService;

    private Organization org;
    private Property property;
    private Building building;
    private Floor floor;
    private Room room;
    private Bed bed;
    private Tenant activeTenant;
    private UUID propertyId;

    @BeforeEach
    void setUp() {
        org = new Organization();
        org.setId(UUID.randomUUID());
        org.setName("StayEaze Org");

        propertyId = UUID.randomUUID();
        property = new Property(org, "StayEaze Prime Residency", "Sector 62, Noida");
        property.setId(propertyId);
        property.setCode("PRIME-01");
        property.setStatus("ACTIVE");

        building = new Building(property, "Block A", "BLK-A");
        building.setId(UUID.randomUUID());
        building.setStatus("ACTIVE");

        floor = new Floor(building, 1, "First Floor");
        floor.setId(UUID.randomUUID());
        floor.setStatus("ACTIVE");

        room = new Room(floor, "101", "DOUBLE", BigDecimal.valueOf(9000));
        room.setId(UUID.randomUUID());
        room.setStatus("ACTIVE");

        bed = new Bed(room, "Bed-1");
        bed.setId(UUID.randomUUID());
        bed.setStatus("AVAILABLE");

        activeTenant = new Tenant();
        activeTenant.setId(UUID.randomUUID());
        activeTenant.setOrganization(org);
        activeTenant.setPropertyId(propertyId);
        activeTenant.setFirstName("Rahul");
        activeTenant.setLastName("Sharma");
        activeTenant.setStatus("ACTIVE");
        activeTenant.setRoomNumber("101");
        activeTenant.setBedNumber("Bed-1");
    }

    @Test
    @DisplayName("Pre-Delete Summary accurately calculates active residents, rooms, beds and org property count")
    void testGetPropertyPreDeleteSummary() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantRepository.findByPropertyId(propertyId)).thenReturn(List.of(activeTenant));
        when(buildingRepository.findByProperty(property)).thenReturn(List.of(building));
        when(floorRepository.findByBuilding(building)).thenReturn(List.of(floor));
        when(roomRepository.findByFloor(floor)).thenReturn(List.of(room));
        when(bedRepository.findByRoom(room)).thenReturn(List.of(bed));
        when(propertyRepository.findByOrganizationIdNative(org.getId())).thenReturn(List.of(property));

        Map<String, Object> summary = propertyService.getPropertyPreDeleteSummary(propertyId, org);

        assertNotNull(summary);
        assertEquals(propertyId, summary.get("propertyId"));
        assertEquals("StayEaze Prime Residency", summary.get("propertyName"));
        assertEquals(1L, summary.get("activeTenantsCount"));
        assertEquals(1, summary.get("totalBuildings"));
        assertEquals(1, summary.get("totalRooms"));
        assertEquals(1, summary.get("totalBeds"));
        assertEquals(1L, summary.get("totalPropertiesInOrg"));
    }

    @Test
    @DisplayName("Cascade Archival sets property and all child entities (buildings, floors, rooms, beds) to ARCHIVED and strips staff assignment")
    void testArchivePropertyCascade() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(buildingRepository.findByProperty(property)).thenReturn(List.of(building));
        when(floorRepository.findByBuilding(building)).thenReturn(List.of(floor));
        when(roomRepository.findByFloor(floor)).thenReturn(List.of(room));
        when(bedRepository.findByRoom(room)).thenReturn(List.of(bed));

        User staffUser = new User();
        staffUser.setId(UUID.randomUUID());
        staffUser.setPropertyIds(new ArrayList<>(List.of(propertyId)));
        when(userRepository.findByOrganizationId(org.getId())).thenReturn(List.of(staffUser));

        propertyService.archivePropertyCascade(propertyId, org);

        assertTrue("ARCHIVED".equalsIgnoreCase(property.getStatus()));
        assertTrue("ARCHIVED".equalsIgnoreCase(building.getStatus()));
        assertTrue("ARCHIVED".equalsIgnoreCase(floor.getStatus()));
        assertTrue("ARCHIVED".equalsIgnoreCase(room.getStatus()));
        assertTrue("ARCHIVED".equalsIgnoreCase(bed.getStatus()));
        assertFalse(staffUser.getPropertyIds().contains(propertyId));

        verify(propertyRepository).save(property);
        verify(buildingRepository).save(building);
        verify(floorRepository).save(floor);
        verify(roomRepository).save(room);
        verify(bedRepository).save(bed);
        verify(userRepository).save(staffUser);
    }

    @Test
    @DisplayName("Cascade Restore reactivates property, buildings, floors, rooms and sets beds AVAILABLE")
    void testRestorePropertyCascade() {
        property.setStatus("ARCHIVED");
        building.setStatus("ARCHIVED");
        floor.setStatus("ARCHIVED");
        room.setStatus("ARCHIVED");
        bed.setStatus("ARCHIVED");

        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(buildingRepository.findByProperty(property)).thenReturn(List.of(building));
        when(floorRepository.findByBuilding(building)).thenReturn(List.of(floor));
        when(roomRepository.findByFloor(floor)).thenReturn(List.of(room));
        when(bedRepository.findByRoom(room)).thenReturn(List.of(bed));

        propertyService.restorePropertyCascade(propertyId, org);

        assertTrue("ACTIVE".equalsIgnoreCase(property.getStatus()));
        assertTrue("ACTIVE".equalsIgnoreCase(building.getStatus()));
        assertTrue("ACTIVE".equalsIgnoreCase(floor.getStatus()));
        assertTrue("ACTIVE".equalsIgnoreCase(room.getStatus()));
        assertTrue("AVAILABLE".equalsIgnoreCase(bed.getStatus()));

        verify(propertyRepository).save(property);
        verify(buildingRepository).save(building);
        verify(floorRepository).save(floor);
        verify(roomRepository).save(room);
        verify(bedRepository).save(bed);
    }

    @Test
    @DisplayName("Permanent Purge throws IllegalStateException when active tenants exist and autoArchiveTenants is false")
    void testPermanentPurge_ThrowsWhenActiveTenantsExist() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantRepository.findByPropertyId(propertyId)).thenReturn(List.of(activeTenant));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                propertyService.permanentPurgeProperty(propertyId, org, false));

        assertTrue(ex.getMessage().contains("active resident(s) found"));
        verify(propertyRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Permanent Purge with autoArchiveTenants = true auto-archives residents and permanently deletes all property entities")
    void testPermanentPurge_SucceedsWithAutoArchiveTenants() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(tenantRepository.findByPropertyId(propertyId)).thenReturn(List.of(activeTenant));
        when(bookingRepository.findAll()).thenReturn(Collections.emptyList());
        when(complaintRepository.findByOrganizationId(org.getId())).thenReturn(Collections.emptyList());
        when(buildingRepository.findByProperty(property)).thenReturn(List.of(building));
        when(floorRepository.findByBuilding(building)).thenReturn(List.of(floor));
        when(roomRepository.findByFloor(floor)).thenReturn(List.of(room));
        when(bedRepository.findByRoom(room)).thenReturn(List.of(bed));

        User staffUser = new User();
        staffUser.setId(UUID.randomUUID());
        staffUser.setPropertyIds(new ArrayList<>(List.of(propertyId)));
        when(userRepository.findByOrganizationId(org.getId())).thenReturn(List.of(staffUser));

        propertyService.permanentPurgeProperty(propertyId, org, true);

        assertTrue("CHECKED_OUT".equalsIgnoreCase(activeTenant.getStatus()));
        assertNull(activeTenant.getRoomNumber());
        assertNull(activeTenant.getBedNumber());
        verify(tenantRepository).save(activeTenant);

        verify(bedRepository).deleteAll(List.of(bed));
        verify(roomRepository).delete(room);
        verify(floorRepository).delete(floor);
        verify(buildingRepository).delete(building);
        verify(propertyRepository).delete(property);
        assertFalse(staffUser.getPropertyIds().contains(propertyId));
    }

    @Test
    @DisplayName("Export Snapshot generates complete offline JSON tree of property, spaces, and residents")
    void testExportPropertySnapshot() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(buildingRepository.findByProperty(property)).thenReturn(List.of(building));
        when(floorRepository.findByBuilding(building)).thenReturn(List.of(floor));
        when(roomRepository.findByFloor(floor)).thenReturn(List.of(room));
        when(bedRepository.findByRoom(room)).thenReturn(List.of(bed));
        when(tenantRepository.findByPropertyId(propertyId)).thenReturn(List.of(activeTenant));

        Map<String, Object> snapshot = propertyService.exportPropertySnapshot(propertyId, org);

        assertNotNull(snapshot);
        assertTrue(snapshot.containsKey("property"));
        assertTrue(snapshot.containsKey("buildings"));
        assertTrue(snapshot.containsKey("tenants"));

        List<?> bList = (List<?>) snapshot.get("buildings");
        assertEquals(1, bList.size());
        List<?> tList = (List<?>) snapshot.get("tenants");
        assertEquals(1, tList.size());
    }
}
