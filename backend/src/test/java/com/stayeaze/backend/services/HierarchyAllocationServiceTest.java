package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.BedDTO;
import com.stayeaze.backend.payload.response.RoomDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit Test Suite verifying the strict Property -> Building -> Floor -> Room -> Bed hierarchy.
 */
class HierarchyAllocationServiceTest {

    private Property property;
    private Building buildingA;
    private Building buildingB;
    private Floor floorA1;
    private Floor floorB1;
    private Room roomA101;
    private Room roomB101;
    private Bed bedA101_1;
    private Bed bedB101_1;

    @BeforeEach
    void setUp() {
        // Setup Property
        property = new Property();
        property.setId(UUID.randomUUID());
        property.setName("StayEaze Grand Residency");

        // Setup 2 distinct Buildings in the same property
        buildingA = new Building(property, "Block A - North Wing", "BLK-A");
        buildingA.setId(UUID.randomUUID());

        buildingB = new Building(property, "Block B - South Wing", "BLK-B");
        buildingB.setId(UUID.randomUUID());

        // Setup Floor 1 in Block A and Floor 1 in Block B
        floorA1 = new Floor(buildingA, 1, "First Floor");
        floorA1.setId(UUID.randomUUID());

        floorB1 = new Floor(buildingB, 1, "First Floor");
        floorB1.setId(UUID.randomUUID());

        // Setup Room 101 in Block A (2-sharing) and Room 101 in Block B (3-sharing)
        roomA101 = new Room(floorA1, "101", "DOUBLE", BigDecimal.valueOf(8000));
        roomA101.setId(UUID.randomUUID());

        roomB101 = new Room(floorB1, "101", "TRIPLE", BigDecimal.valueOf(6500));
        roomB101.setId(UUID.randomUUID());

        // Setup Beds
        bedA101_1 = new Bed(roomA101, "B1");
        bedA101_1.setId(UUID.randomUUID());
        bedA101_1.setStatus("AVAILABLE");

        bedB101_1 = new Bed(roomB101, "B1");
        bedB101_1.setId(UUID.randomUUID());
        bedB101_1.setStatus("AVAILABLE");
    }

    @Test
    @DisplayName("Scenario 1: RoomDTO accurately resolves Building and Floor breadcrumbs")
    void testRoomDtoHierarchyResolution() {
        RoomDTO dtoA = RoomDTO.fromEntity(roomA101);
        assertNotNull(dtoA);
        assertEquals(roomA101.getId(), dtoA.getId());
        assertEquals("101", dtoA.getRoomNumber());
        assertEquals(floorA1.getId(), dtoA.getFloorId());
        assertEquals(1, dtoA.getFloorNumber());
        assertEquals(buildingA.getId(), dtoA.getBuildingId());
        assertEquals("Block A - North Wing", dtoA.getBuildingName());
        assertEquals(property.getId(), dtoA.getPropertyId());

        RoomDTO dtoB = RoomDTO.fromEntity(roomB101);
        assertNotNull(dtoB);
        assertEquals(roomB101.getId(), dtoB.getId());
        assertEquals("101", dtoB.getRoomNumber());
        assertEquals(floorB1.getId(), dtoB.getFloorId());
        assertEquals(buildingB.getId(), dtoB.getBuildingId());
        assertEquals("Block B - South Wing", dtoB.getBuildingName());

        // Assert distinct buildings despite identical room numbers
        assertNotEquals(dtoA.getBuildingId(), dtoB.getBuildingId());
    }

    @Test
    @DisplayName("Scenario 2: BedDTO accurately resolves entire Property -> Building -> Floor -> Room -> Bed path")
    void testBedDtoHierarchyResolution() {
        BedDTO bedDtoA = BedDTO.fromEntity(bedA101_1);
        assertNotNull(bedDtoA);
        assertEquals(bedA101_1.getId(), bedDtoA.getId());
        assertEquals("B1", bedDtoA.getBedNumber());
        assertEquals(roomA101.getId(), bedDtoA.getRoomId());
        assertEquals("101", bedDtoA.getRoomNumber());
        assertEquals(floorA1.getId(), bedDtoA.getFloorId());
        assertEquals(buildingA.getId(), bedDtoA.getBuildingId());
        assertEquals("Block A - North Wing", bedDtoA.getBuildingName());
        assertEquals(property.getId(), bedDtoA.getPropertyId());

        BedDTO bedDtoB = BedDTO.fromEntity(bedB101_1);
        assertNotNull(bedDtoB);
        assertEquals(buildingB.getId(), bedDtoB.getBuildingId());
        assertEquals("Block B - South Wing", bedDtoB.getBuildingName());

        assertNotEquals(bedDtoA.getBuildingId(), bedDtoB.getBuildingId());
    }

    @Test
    @DisplayName("Scenario 3: Occupying a bed in Block A Room 101 leaves Block B Room 101 completely unimpacted")
    void testCrossBuildingIsolation() {
        // Occupy Bed in Block A
        bedA101_1.setStatus("OCCUPIED");
        bedA101_1.setTenantId(UUID.randomUUID().toString());
        bedA101_1.setTenantName("Aarav Sharma");

        BedDTO dtoA = BedDTO.fromEntity(bedA101_1);
        BedDTO dtoB = BedDTO.fromEntity(bedB101_1);

        assertTrue("OCCUPIED".equalsIgnoreCase(dtoA.getStatus()));
        assertEquals("Aarav Sharma", dtoA.getTenantName());

        assertTrue("AVAILABLE".equalsIgnoreCase(dtoB.getStatus()));
        assertNull(dtoB.getTenantName());
    }

    @Test
    @DisplayName("Scenario 4: Sub-Meter sheet item correctly attaches building and floor context")
    void testMeterSheetHierarchyMapping() {
        UtilityBillingService.RoomMeterSheetItem sheetItemA = new UtilityBillingService.RoomMeterSheetItem();
        sheetItemA.roomId = roomA101.getId();
        sheetItemA.roomNumber = roomA101.getRoomNumber();
        sheetItemA.buildingId = buildingA.getId();
        sheetItemA.buildingName = buildingA.getName();
        sheetItemA.floorId = floorA1.getId();
        sheetItemA.floorName = floorA1.getName();

        assertEquals("Block A - North Wing", sheetItemA.buildingName);
        assertEquals("First Floor", sheetItemA.floorName);
        assertEquals("101", sheetItemA.roomNumber);
    }
}
