package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class UtilityBillingServiceTest {

    @Autowired
    private UtilityBillingService utilityBillingService;

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
    private InvoiceRepository invoiceRepository;

    private Organization testOrg;
    private Property testProperty;
    private Building testBuilding;
    private Floor testFloor;
    private Room testRoom3Bed;
    private Room testRoom1Bed;

    @BeforeEach
    void setupTestData() {
        testOrg = new Organization();
        testOrg.setName("Zenith Grand Co-Living");
        testOrg.setSubdomain("zenith-util-" + UUID.randomUUID().toString().substring(0, 6));
        testOrg = organizationRepository.saveAndFlush(testOrg);

        testProperty = new Property();
        testProperty.setName("Zenith Residency");
        testProperty.setOrganization(testOrg);
        testProperty.setAddress("MG Road, Bengaluru");
        testProperty.setType("PG");
        testProperty = propertyRepository.saveAndFlush(testProperty);

        testBuilding = new Building();
        testBuilding.setName("Tower A");
        testBuilding.setCode("BLD-A");
        testBuilding.setProperty(testProperty);
        testBuilding = buildingRepository.saveAndFlush(testBuilding);

        testFloor = new Floor(testBuilding, 1, "Floor 1");
        testFloor = floorRepository.saveAndFlush(testFloor);

        testRoom3Bed = new Room();
        testRoom3Bed.setRoomNumber("101");
        testRoom3Bed.setFloor(testFloor);
        testRoom3Bed.setSharingType("TRIPLE");
        testRoom3Bed.setBaseRent(BigDecimal.valueOf(8000));
        testRoom3Bed = roomRepository.saveAndFlush(testRoom3Bed);

        testRoom1Bed = new Room();
        testRoom1Bed.setRoomNumber("102");
        testRoom1Bed.setFloor(testFloor);
        testRoom1Bed.setSharingType("SINGLE");
        testRoom1Bed.setBaseRent(BigDecimal.valueOf(15000));
        testRoom1Bed = roomRepository.saveAndFlush(testRoom1Bed);
    }

    private Tenant createTenant(String firstName, String lastName, Room room, LocalDate checkInDate, BigDecimal rent) {
        Tenant t = new Tenant(testOrg, firstName, lastName, "+9198765" + String.format("%05d", new Random().nextInt(100000)));
        t.setEmail(firstName.toLowerCase() + "." + UUID.randomUUID().toString().substring(0, 5) + "@stayeaze.com");
        t.setPropertyId(testProperty.getId());
        t.setRoomNumber(room.getRoomNumber());
        t.setLeaseStart(checkInDate.toString());
        t.setRent(rent);
        t.setStatus("ACTIVE");
        return tenantRepository.saveAndFlush(t);
    }

    @Test
    @DisplayName("S1: Full occupancy room should split meter consumption equally among all roommates")
    void testFullOccupancyEqualSplit() {
        createTenant("Rahul", "Sharma", testRoom3Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(8000));
        createTenant("Amit", "Verma", testRoom3Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(8000));
        createTenant("Rohan", "Gupta", testRoom3Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(8000));

        // Prev Reading: 1000, Current: 1120 -> Delta = 120 units @ Rs 10/unit = Rs 1200
        Map<String, Object> req = new HashMap<>();
        req.put("roomId", testRoom3Bed.getId());
        req.put("previousReading", 1000.0);
        req.put("currentReading", 1120.0);
        req.put("unitRate", 10.0);
        req.put("billingMonth", 8);
        req.put("billingYear", 2026);
        req.put("splitMode", "EQUAL_OCCUPANTS");

        UtilityBillingService.RoomUtilityCalculation result = utilityBillingService.calculateRoomUtility(req);

        assertEquals(120.0, result.getUnitsConsumed(), 0.01);
        assertEquals(1200.0, result.getTotalAmount(), 0.01);
        assertEquals(3, result.getTenantSplits().size());

        // Each pays 1200 / 3 = 400
        for (UtilityBillingService.TenantUtilitySplit split : result.getTenantSplits()) {
            assertEquals(400.0, split.getAmount(), 0.01);
            assertEquals(40.0, split.getUnits(), 0.01);
        }
    }

    @Test
    @DisplayName("S2: Mid-cycle onboarded tenant should ONLY be billed from their starter meter reading")
    void testMidCycleOnboardingStarterReadingIsolation() {
        createTenant("Rahul", "Sharma", testRoom3Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(8000));
        Tenant newTenant = createTenant("Priya", "Nair", testRoom3Bed, LocalDate.of(2026, 8, 18), BigDecimal.valueOf(8000));

        Map<String, Object> req = new HashMap<>();
        req.put("roomId", testRoom3Bed.getId());
        req.put("previousReading", 1000.0);
        req.put("currentReading", 1200.0);
        req.put("unitRate", 10.0);
        req.put("billingMonth", 8);
        req.put("billingYear", 2026);
        req.put("splitMode", "FAIR_PROPORTIONAL");

        UtilityBillingService.RoomUtilityCalculation result = utilityBillingService.calculateRoomUtility(req);

        UtilityBillingService.TenantUtilitySplit priyaSplit = result.getTenantSplits().stream()
                .filter(s -> s.getTenantId().equals(newTenant.getId()))
                .findFirst().orElseThrow();

        // Priya joined on 18th (14/31 days active) -> must pay significantly less than full-month occupant
        assertTrue(priyaSplit.getAmount() < result.getTotalAmount() / 3,
                "Mid-cycle joiner should pay only their fractional stay proportion");
    }

    @Test
    @DisplayName("S4a: Partial occupancy in Fair Mode should charge tenant only their 1/N capacity share (Owner absorbs remainder)")
    void testPartialOccupancyFairMode() {
        createTenant("Vikram", "Mehta", testRoom3Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(8000));

        // 3-bed room with ONLY 1 tenant. Room uses 150 units @ Rs 10 = Rs 1500
        Map<String, Object> req = new HashMap<>();
        req.put("roomId", testRoom3Bed.getId());
        req.put("previousReading", 500.0);
        req.put("currentReading", 650.0);
        req.put("unitRate", 10.0);
        req.put("billingMonth", 8);
        req.put("billingYear", 2026);
        req.put("splitMode", "FAIR_PROPORTIONAL");

        UtilityBillingService.RoomUtilityCalculation result = utilityBillingService.calculateRoomUtility(req);

        assertEquals(1, result.getTenantSplits().size());
        UtilityBillingService.TenantUtilitySplit split = result.getTenantSplits().get(0);

        // In Fair Mode, 1 tenant in 3-bed room pays 1/3rd = Rs 500
        assertEquals(500.0, split.getAmount(), 0.01);
        assertEquals(1000.0, result.getUnallocatedAmount(), 0.01); // PG Absorbs Rs 1000 for 2 vacant beds
    }

    @Test
    @DisplayName("S4b: Partial occupancy with Owner Override (Full Burden) should divide 100% of bill among active occupants")
    void testPartialOccupancyFullBurdenOverride() {
        createTenant("Vikram", "Mehta", testRoom3Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(8000));

        Map<String, Object> req = new HashMap<>();
        req.put("roomId", testRoom3Bed.getId());
        req.put("previousReading", 500.0);
        req.put("currentReading", 650.0);
        req.put("unitRate", 10.0);
        req.put("billingMonth", 8);
        req.put("billingYear", 2026);
        req.put("splitMode", "EQUAL_OCCUPANTS"); // Owner forces full room bill to active tenant

        UtilityBillingService.RoomUtilityCalculation result = utilityBillingService.calculateRoomUtility(req);

        assertEquals(1, result.getTenantSplits().size());
        UtilityBillingService.TenantUtilitySplit split = result.getTenantSplits().get(0);

        // In Full Burden Mode, active tenant pays 100% = Rs 1500
        assertEquals(1500.0, split.getAmount(), 0.01);
        assertEquals(0.0, result.getUnallocatedAmount(), 0.01);
    }

    @Test
    @DisplayName("S5: Free monthly units allowance should be subtracted before calculating payable bill")
    void testFreeUnitAllowanceDeduction() {
        createTenant("Rahul", "Sharma", testRoom1Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(15000));

        // 130 units consumed @ Rs 10. 50 units free allowance -> Billable = 80 units = Rs 800
        Map<String, Object> req = new HashMap<>();
        req.put("roomId", testRoom1Bed.getId());
        req.put("previousReading", 200.0);
        req.put("currentReading", 330.0);
        req.put("unitRate", 10.0);
        req.put("freeAllowanceUnits", 50.0);
        req.put("billingMonth", 8);
        req.put("billingYear", 2026);
        req.put("splitMode", "SINGLE_OCCUPANT");

        UtilityBillingService.RoomUtilityCalculation result = utilityBillingService.calculateRoomUtility(req);

        assertEquals(130.0, result.getGrossUnits(), 0.01);
        assertEquals(80.0, result.getUnitsConsumed(), 0.01); // 130 - 50 = 80
        assertEquals(800.0, result.getTotalAmount(), 0.01);
        assertEquals(800.0, result.getTenantSplits().get(0).getAmount(), 0.01);
    }

    @Test
    @DisplayName("S7: Meter rollover calculation should prevent negative delta")
    void testMeterRolloverAndReplacementDelta() {
        // Meter rolled from 9950 to 0050 -> Delta = (10000 - 9950) + 50 = 100 units
        Map<String, Object> req = new HashMap<>();
        req.put("roomId", testRoom1Bed.getId());
        req.put("previousReading", 9950.0);
        req.put("currentReading", 50.0);
        req.put("isRollover", true);
        req.put("maxMeterValue", 10000.0);
        req.put("unitRate", 10.0);
        req.put("billingMonth", 8);
        req.put("billingYear", 2026);

        UtilityBillingService.RoomUtilityCalculation result = utilityBillingService.calculateRoomUtility(req);

        assertEquals(100.0, result.getUnitsConsumed(), 0.01);
        assertEquals(1000.0, result.getTotalAmount(), 0.01);
    }

    @Test
    @DisplayName("S8: Batch recording and applying utility bill should append line items to tenant invoices")
    void testBulkApplyToMonthlyRentInvoices() {
        Tenant t1 = createTenant("Rahul", "Sharma", testRoom1Bed, LocalDate.of(2026, 8, 1), BigDecimal.valueOf(10000));

        // Create an existing August Rent Invoice of Rs 10000
        Invoice inv = new Invoice();
        inv.setTenant(t1);
        inv.setInvoiceNumber("INV-202608-TEST001");
        inv.setIssueDate(LocalDate.of(2026, 8, 1));
        inv.setDueDate(LocalDate.of(2026, 8, 5));
        inv.setAmountDue(BigDecimal.valueOf(10000));
        inv.setAmountPaid(BigDecimal.ZERO);
        inv.setStatus("UNPAID");
        inv = invoiceRepository.save(inv);

        // Record Utility: 80 units @ Rs 10 = Rs 800
        Map<String, Object> readingEntry = new HashMap<>();
        readingEntry.put("roomId", testRoom1Bed.getId());
        readingEntry.put("previousReading", 100.0);
        readingEntry.put("currentReading", 180.0);
        readingEntry.put("unitRate", 10.0);
        readingEntry.put("billingMonth", 8);
        readingEntry.put("billingYear", 2026);
        readingEntry.put("splitMode", "SINGLE_OCCUPANT");

        Map<String, Object> response = utilityBillingService.bulkRecordAndApply(
                testProperty.getId(),
                List.of(readingEntry),
                true // Append directly to existing rent invoices
        );

        assertTrue((Boolean) response.get("success"));

        // Verify that tenant invoice now has Rs 10800 (10000 rent + 800 electricity)
        Invoice updatedInv = invoiceRepository.findById(inv.getId()).orElseThrow();
        assertEquals(BigDecimal.valueOf(10800.0).doubleValue(), updatedInv.getAmountDue().doubleValue(), 0.01);
        assertTrue(updatedInv.getItems().stream().anyMatch(i -> i.getDescription().contains("Electricity")));
    }
}
