package com.stayeaze.backend.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UtilityBillingService {

    private static final Logger logger = LoggerFactory.getLogger(UtilityBillingService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private MeterReadingRepository meterReadingRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private CheckinChecklistRepository checklistRepository;

    public static int getCapacityFromRoom(Room room) {
        if (room == null || room.getSharingType() == null) return 1;
        String st = room.getSharingType().toUpperCase();
        if (st.contains("SINGLE") || st.equals("1")) return 1;
        if (st.contains("DOUBLE") || st.contains("2")) return 2;
        if (st.contains("TRIPLE") || st.contains("3")) return 3;
        if (st.contains("FOUR") || st.contains("4")) return 4;
        if (st.contains("DORM")) return 6;
        return 1;
    }

    public static LocalDate parseTenantCheckIn(Tenant t) {
        if (t == null) return LocalDate.now();
        if (t.getLeaseStart() != null && !t.getLeaseStart().isBlank()) {
            try {
                return LocalDate.parse(t.getLeaseStart().trim().substring(0, 10));
            } catch (Exception ignored) {}
        }
        if (t.getCreatedAt() != null) {
            return t.getCreatedAt().toLocalDate();
        }
        return LocalDate.now();
    }

    // --- DTO Classes ---

    public static class TenantUtilitySplit {
        private UUID tenantId;
        private String tenantName;
        private String roomNumber;
        private LocalDate checkInDate;
        private Double units;
        private Double amount;
        private String formulaDescription;

        public TenantUtilitySplit() {}

        public TenantUtilitySplit(UUID tenantId, String tenantName, String roomNumber, LocalDate checkInDate, Double units, Double amount, String formulaDescription) {
            this.tenantId = tenantId;
            this.tenantName = tenantName;
            this.roomNumber = roomNumber;
            this.checkInDate = checkInDate;
            this.units = units;
            this.amount = amount;
            this.formulaDescription = formulaDescription;
        }

        public UUID getTenantId() { return tenantId; }
        public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
        public String getTenantName() { return tenantName; }
        public void setTenantName(String tenantName) { this.tenantName = tenantName; }
        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
        public LocalDate getCheckInDate() { return checkInDate; }
        public void setCheckInDate(LocalDate checkInDate) { this.checkInDate = checkInDate; }
        public Double getUnits() { return units; }
        public void setUnits(Double units) { this.units = units; }
        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }
        public String getFormulaDescription() { return formulaDescription; }
        public void setFormulaDescription(String formulaDescription) { this.formulaDescription = formulaDescription; }
    }

    public static class RoomUtilityCalculation {
        private UUID roomId;
        private String roomNumber;
        private Integer capacity;
        private Double previousReading;
        private Double currentReading;
        private Double grossUnits;
        private Double freeAllowanceUnits;
        private Double unitsConsumed;
        private Double unitRate;
        private Double totalAmount;
        private Double unallocatedAmount; // Amount absorbed by PG for vacant beds in Fair mode
        private String splitMode;
        private List<TenantUtilitySplit> tenantSplits = new ArrayList<>();

        public UUID getRoomId() { return roomId; }
        public void setRoomId(UUID roomId) { this.roomId = roomId; }
        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
        public Integer getCapacity() { return capacity; }
        public void setCapacity(Integer capacity) { this.capacity = capacity; }
        public Double getPreviousReading() { return previousReading; }
        public void setPreviousReading(Double previousReading) { this.previousReading = previousReading; }
        public Double getCurrentReading() { return currentReading; }
        public void setCurrentReading(Double currentReading) { this.currentReading = currentReading; }
        public Double getGrossUnits() { return grossUnits; }
        public void setGrossUnits(Double grossUnits) { this.grossUnits = grossUnits; }
        public Double getFreeAllowanceUnits() { return freeAllowanceUnits; }
        public void setFreeAllowanceUnits(Double freeAllowanceUnits) { this.freeAllowanceUnits = freeAllowanceUnits; }
        public Double getUnitsConsumed() { return unitsConsumed; }
        public void setUnitsConsumed(Double unitsConsumed) { this.unitsConsumed = unitsConsumed; }
        public Double getUnitRate() { return unitRate; }
        public void setUnitRate(Double unitRate) { this.unitRate = unitRate; }
        public Double getTotalAmount() { return totalAmount; }
        public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
        public Double getUnallocatedAmount() { return unallocatedAmount; }
        public void setUnallocatedAmount(Double unallocatedAmount) { this.unallocatedAmount = unallocatedAmount; }
        public String getSplitMode() { return splitMode; }
        public void setSplitMode(String splitMode) { this.splitMode = splitMode; }
        public List<TenantUtilitySplit> getTenantSplits() { return tenantSplits; }
        public void setTenantSplits(List<TenantUtilitySplit> tenantSplits) { this.tenantSplits = tenantSplits; }
    }

    public static class RoomMeterSheetItem {
        public UUID roomId;
        public String roomNumber;
        public UUID buildingId;
        public String buildingName;
        public UUID floorId;
        public Integer floorNumber;
        public String floorName;
        public Integer capacity;
        public Integer occupiedCount;
        public Double lastReadingValue;
        public Double currentReadingValue;
        public LocalDate lastReadingDate;
        public Double defaultUnitRate;
        public String defaultSplitMode;
        public Double unitsConsumed;
        public Double totalAmount;
        public Double freeAllowanceUnits;
        public String photoUrl;
        public List<TenantUtilitySplit> tenantSplits = new ArrayList<>();
        public List<Map<String, Object>> occupants = new ArrayList<>();
    }

    // --- Core Logic Methods ---

    /**
     * Calculates room-level utility consumption & intelligent per-tenant split.
     */
    public RoomUtilityCalculation calculateRoomUtility(Map<String, Object> req) {
        UUID roomId = UUID.fromString(req.get("roomId").toString());
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + roomId));

        double prevReading = req.containsKey("previousReading") && req.get("previousReading") != null
                ? Double.parseDouble(req.get("previousReading").toString()) : 0.0;
        double currReading = req.containsKey("currentReading") && req.get("currentReading") != null
                ? Double.parseDouble(req.get("currentReading").toString()) : prevReading;
        double unitRate = req.containsKey("unitRate") && req.get("unitRate") != null
                ? Double.parseDouble(req.get("unitRate").toString()) : 10.0;
        double freeAllowance = req.containsKey("freeAllowanceUnits") && req.get("freeAllowanceUnits") != null
                ? Double.parseDouble(req.get("freeAllowanceUnits").toString()) : 0.0;
        boolean isRollover = req.containsKey("isRollover") && Boolean.TRUE.equals(req.get("isRollover"));
        double maxMeterVal = req.containsKey("maxMeterValue") && req.get("maxMeterValue") != null
                ? Double.parseDouble(req.get("maxMeterValue").toString()) : 10000.0;

        int month = req.containsKey("billingMonth") && req.get("billingMonth") != null
                ? Integer.parseInt(req.get("billingMonth").toString()) : LocalDate.now().getMonthValue();
        int year = req.containsKey("billingYear") && req.get("billingYear") != null
                ? Integer.parseInt(req.get("billingYear").toString()) : LocalDate.now().getYear();

        String splitMode = req.containsKey("splitMode") && req.get("splitMode") != null
                ? req.get("splitMode").toString().toUpperCase().trim() : "FAIR_PROPORTIONAL";

        // 1. Calculate Gross & Net Billable Units
        double grossUnits;
        if (isRollover && currReading < prevReading) {
            grossUnits = (maxMeterVal - prevReading) + currReading;
        } else {
            grossUnits = Math.max(0, currReading - prevReading);
        }
        double netBillableUnits = Math.max(0, grossUnits - freeAllowance);
        double totalBillAmount = Math.round(netBillableUnits * unitRate * 100.0) / 100.0;

        int capacity = getCapacityFromRoom(room);

        RoomUtilityCalculation calc = new RoomUtilityCalculation();
        calc.setRoomId(room.getId());
        calc.setRoomNumber(room.getRoomNumber());
        calc.setCapacity(capacity);
        calc.setPreviousReading(prevReading);
        calc.setCurrentReading(currReading);
        calc.setGrossUnits(grossUnits);
        calc.setFreeAllowanceUnits(freeAllowance);
        calc.setUnitsConsumed(netBillableUnits);
        calc.setUnitRate(unitRate);
        calc.setTotalAmount(totalBillAmount);
        calc.setSplitMode(splitMode);

        // 2. Fetch Active Room Occupants accurately scoped to this exact Room & Building
        UUID propId = null;
        if (room.getFloor() != null && room.getFloor().getBuilding() != null && room.getFloor().getBuilding().getProperty() != null) {
            propId = room.getFloor().getBuilding().getProperty().getId();
        }
        if (propId == null) {
            try {
                propId = roomRepository.findPropertyIdByRoomId(room.getId());
            } catch (Exception ignored) {}
        }

        List<Tenant> activeTenants = getActiveTenantsForRoom(room, propId);

        if (activeTenants.isEmpty() || totalBillAmount <= 0) {
            calc.setUnallocatedAmount(totalBillAmount);
            return calc;
        }

        int activeCount = activeTenants.size();
        YearMonth ym = YearMonth.of(year, month);
        int totalDaysInMonth = ym.lengthOfMonth();
        LocalDate periodStart = ym.atDay(1);
        LocalDate periodEnd = ym.atEndOfMonth();

        List<TenantUtilitySplit> splits = new ArrayList<>();
        double allocatedSum = 0.0;

        if ("SINGLE_OCCUPANT".equalsIgnoreCase(splitMode) || (activeCount == 1 && capacity == 1)) {
            Tenant t = activeTenants.get(0);
            LocalDate checkIn = parseTenantCheckIn(t);
            splits.add(new TenantUtilitySplit(t.getId(), t.getFirstName() + " " + t.getLastName(),
                    room.getRoomNumber(), checkIn, netBillableUnits, totalBillAmount,
                    "Single Occupancy (100% of room bill)"));
            allocatedSum += totalBillAmount;
        } else if ("FAIR_PROPORTIONAL".equalsIgnoreCase(splitMode) && activeCount == 1 && capacity > 1) {
            // Fair Mode in Partial Occupancy: 1 tenant in 3-bed room pays 1/3rd (their capacity share)
            Tenant t = activeTenants.get(0);
            LocalDate checkIn = parseTenantCheckIn(t);
            long stayDays = calculateStayDays(checkIn, periodStart, periodEnd, totalDaysInMonth);
            double proportion = ((double) stayDays / totalDaysInMonth) / capacity;
            double tenantAmount = Math.round(totalBillAmount * proportion * 100.0) / 100.0;
            double tenantUnits = Math.round(netBillableUnits * proportion * 100.0) / 100.0;

            splits.add(new TenantUtilitySplit(t.getId(), t.getFirstName() + " " + t.getLastName(),
                    room.getRoomNumber(), checkIn, tenantUnits, tenantAmount,
                    String.format("Fair Share (1/%d Capacity, %d/%d Days)", capacity, stayDays, totalDaysInMonth)));
            allocatedSum += tenantAmount;
        } else if ("EQUAL_OCCUPANTS".equalsIgnoreCase(splitMode)) {
            // Full room bill divided equally among all currently active roommates
            double equalAmount = Math.round((totalBillAmount / activeCount) * 100.0) / 100.0;
            double equalUnits = Math.round((netBillableUnits / activeCount) * 100.0) / 100.0;

            for (Tenant t : activeTenants) {
                LocalDate checkIn = parseTenantCheckIn(t);
                splits.add(new TenantUtilitySplit(t.getId(), t.getFirstName() + " " + t.getLastName(),
                        room.getRoomNumber(), checkIn, equalUnits, equalAmount,
                        String.format("Equal Split (%d Roommates)", activeCount)));
                allocatedSum += equalAmount;
            }
        } else {
            // FAIR_PROPORTIONAL (Default):
            // Accounts for mid-month joiners & divides by capacity
            Map<UUID, Long> stayDaysMap = new HashMap<>();

            for (Tenant t : activeTenants) {
                LocalDate checkIn = parseTenantCheckIn(t);
                long days = calculateStayDays(checkIn, periodStart, periodEnd, totalDaysInMonth);
                stayDaysMap.put(t.getId(), days);
            }

            for (Tenant t : activeTenants) {
                LocalDate checkIn = parseTenantCheckIn(t);
                long days = stayDaysMap.get(t.getId());
                double shareRatio = (double) days / (totalDaysInMonth * capacity);
                double tenantAmt = Math.round(totalBillAmount * shareRatio * 100.0) / 100.0;
                double tenantUnits = Math.round(netBillableUnits * shareRatio * 100.0) / 100.0;

                splits.add(new TenantUtilitySplit(t.getId(), t.getFirstName() + " " + t.getLastName(),
                        room.getRoomNumber(), checkIn, tenantUnits, tenantAmt,
                        String.format("Fair Proportional (%d/%d Days, 1/%d Cap)", days, totalDaysInMonth, capacity)));
                allocatedSum += tenantAmt;
            }
        }

        calc.setTenantSplits(splits);
        calc.setUnallocatedAmount(Math.max(0, Math.round((totalBillAmount - allocatedSum) * 100.0) / 100.0));
        return calc;
    }

    private long calculateStayDays(LocalDate checkInDate, LocalDate periodStart, LocalDate periodEnd, int totalDaysInMonth) {
        if (checkInDate == null || !checkInDate.isAfter(periodStart)) {
            return totalDaysInMonth;
        }
        if (checkInDate.isAfter(periodEnd)) {
            return 0;
        }
        return java.time.temporal.ChronoUnit.DAYS.between(checkInDate, periodEnd) + 1;
    }

    /**
     * Aggregated server-side utility statistics across the entire property or specific building.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPropertyUtilityStats(UUID propertyId, UUID buildingId, Integer billingMonth, Integer billingYear) {
        int targetMonth = billingMonth != null ? billingMonth : LocalDate.now().getMonthValue();
        int targetYear = billingYear != null ? billingYear : LocalDate.now().getYear();

        List<Room> allRooms = new ArrayList<>();
        try {
            allRooms = roomRepository.findByPropertyIdNative(propertyId);
        } catch (Exception e) {
            logger.error("Error fetching rooms for property {}", propertyId, e);
        }
        if (allRooms == null) allRooms = new ArrayList<>();

        if (buildingId != null) {
            allRooms = allRooms.stream()
                    .filter(r -> r != null && r.getFloor() != null && r.getFloor().getBuilding() != null && buildingId.equals(r.getFloor().getBuilding().getId()))
                    .collect(Collectors.toList());
        }

        double totalUnits = 0.0;
        double totalCost = 0.0;
        double totalTenantRecovery = 0.0;
        int recordedRoomsCount = 0;
        int activeResidentsCount = 0;

        for (Room room : allRooms) {
            if (room == null) continue;

            // Count active tenants accurately for this room
            List<Tenant> tenants = getActiveTenantsForRoom(room, propertyId);
            activeResidentsCount += tenants.size();

            List<MeterReading> roomReadings = new ArrayList<>();
            try {
                roomReadings = meterReadingRepository.findByRoom(room);
            } catch (Exception ignored) {}
            if (roomReadings == null) roomReadings = new ArrayList<>();

            MeterReading thisCycleReading = roomReadings.stream()
                    .filter(mr -> mr != null && mr.getBillingMonth() != null && mr.getBillingMonth() == targetMonth
                               && mr.getBillingYear() != null && mr.getBillingYear() == targetYear)
                    .max(Comparator.comparing(MeterReading::getReadingDate, Comparator.nullsFirst(Comparator.naturalOrder())))
                    .orElse(null);

            if (thisCycleReading != null) {
                recordedRoomsCount++;
                double units = thisCycleReading.getUnitsConsumed() != null ? thisCycleReading.getUnitsConsumed().doubleValue() : 0.0;
                double cost = thisCycleReading.getTotalAmount() != null ? thisCycleReading.getTotalAmount().doubleValue() : 0.0;
                totalUnits += units;
                totalCost += cost;

                if (thisCycleReading.getTenantSplitDetailsJson() != null && !thisCycleReading.getTenantSplitDetailsJson().isBlank()) {
                    try {
                        List<TenantUtilitySplit> splits = objectMapper.readValue(
                                thisCycleReading.getTenantSplitDetailsJson(),
                                new TypeReference<List<TenantUtilitySplit>>() {}
                        );
                        if (splits != null) {
                            for (TenantUtilitySplit s : splits) {
                                if (s != null) {
                                    totalTenantRecovery += s.getAmount();
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }
        }

        double totalOwnerAbsorption = Math.max(0, Math.round((totalCost - totalTenantRecovery) * 100.0) / 100.0);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRoomsCount", allRooms.size());
        stats.put("recordedRoomsCount", recordedRoomsCount);
        stats.put("totalUnitsConsumed", Math.round(totalUnits * 100.0) / 100.0);
        stats.put("totalUtilityCost", Math.round(totalCost * 100.0) / 100.0);
        stats.put("totalTenantRecovery", Math.round(totalTenantRecovery * 100.0) / 100.0);
        stats.put("totalOwnerAbsorption", totalOwnerAbsorption);
        stats.put("totalActiveResidents", activeResidentsCount);
        stats.put("billingMonth", targetMonth);
        stats.put("billingYear", targetYear);

        return stats;
    }

    /**
     * Server-side paginated meter sheet with building filter and search.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPropertyMeterSheetPaginated(
            UUID propertyId, UUID buildingId, String search,
            Integer billingMonth, Integer billingYear, int page, int size) {

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<Room> roomPage;
        if (search != null && !search.trim().isEmpty()) {
            String searchPattern = "%" + search.trim().toLowerCase() + "%";
            roomPage = roomRepository.findByPropertyAndFiltersWithSearchPaginated(propertyId, buildingId, searchPattern, pageable);
        } else {
            roomPage = roomRepository.findByPropertyAndBuildingPaginated(propertyId, buildingId, pageable);
        }
        List<RoomMeterSheetItem> items = new ArrayList<>();

        int targetMonth = billingMonth != null ? billingMonth : LocalDate.now().getMonthValue();
        int targetYear = billingYear != null ? billingYear : LocalDate.now().getYear();

        for (Room room : roomPage.getContent()) {
            items.add(buildRoomMeterSheetItem(room, propertyId, targetMonth, targetYear));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("content", items);
        response.put("page", roomPage.getNumber());
        response.put("size", roomPage.getSize());
        response.put("totalElements", roomPage.getTotalElements());
        response.put("totalPages", roomPage.getTotalPages());
        response.put("last", roomPage.isLast());

        return response;
    }

    /**
     * Fast 1-trip fetch of property-wide meter sheet for grid editing.
     */
    @Transactional(readOnly = true)
    public List<RoomMeterSheetItem> getPropertyMeterSheet(UUID propertyId, Integer billingMonth, Integer billingYear) {
        List<Room> rooms = roomRepository.findByPropertyIdNative(propertyId);
        List<RoomMeterSheetItem> sheet = new ArrayList<>();

        int targetMonth = billingMonth != null ? billingMonth : LocalDate.now().getMonthValue();
        int targetYear = billingYear != null ? billingYear : LocalDate.now().getYear();

        for (Room room : rooms) {
            sheet.add(buildRoomMeterSheetItem(room, propertyId, targetMonth, targetYear));
        }

        return sheet;
    }

    private RoomMeterSheetItem buildRoomMeterSheetItem(Room room, UUID propertyId, int targetMonth, int targetYear) {
        RoomMeterSheetItem item = new RoomMeterSheetItem();
        item.roomId = room.getId();
        item.roomNumber = room.getRoomNumber();
        if (room.getFloor() != null) {
            item.floorId = room.getFloor().getId();
            item.floorNumber = room.getFloor().getFloorNumber();
            item.floorName = room.getFloor().getName() != null ? room.getFloor().getName() : (item.floorNumber != null ? "Floor " + item.floorNumber : "Main Floor");
            if (room.getFloor().getBuilding() != null) {
                item.buildingId = room.getFloor().getBuilding().getId();
                item.buildingName = room.getFloor().getBuilding().getName() != null ? room.getFloor().getBuilding().getName() : "Main Building";
            }
        } else {
            item.floorName = "Main Floor";
        }
        item.capacity = getCapacityFromRoom(room);
        item.defaultUnitRate = 10.0;
        item.defaultSplitMode = item.capacity == 1 ? "SINGLE_OCCUPANT" : "FAIR_PROPORTIONAL";

        // Find reading recorded for this specific billing month & year
        List<MeterReading> roomReadings = meterReadingRepository.findByRoom(room);
        MeterReading thisCycleReading = roomReadings.stream()
                .filter(mr -> mr.getBillingMonth() != null && mr.getBillingMonth() == targetMonth
                           && mr.getBillingYear() != null && mr.getBillingYear() == targetYear)
                .max(Comparator.comparing(MeterReading::getReadingDate, Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);

        if (thisCycleReading != null) {
            item.lastReadingValue = thisCycleReading.getPreviousReadingValue() != null 
                    ? thisCycleReading.getPreviousReadingValue().doubleValue() 
                    : 0.0;
            item.currentReadingValue = thisCycleReading.getReadingValue() != null 
                    ? thisCycleReading.getReadingValue().doubleValue() 
                    : item.lastReadingValue;
            item.lastReadingDate = thisCycleReading.getReadingDate();
            item.unitsConsumed = thisCycleReading.getUnitsConsumed() != null 
                    ? thisCycleReading.getUnitsConsumed().doubleValue() 
                    : Math.max(0, item.currentReadingValue - item.lastReadingValue);
            item.defaultUnitRate = thisCycleReading.getUnitRate() != null 
                    ? thisCycleReading.getUnitRate().doubleValue() 
                    : item.defaultUnitRate;
            item.totalAmount = thisCycleReading.getTotalAmount() != null 
                    ? thisCycleReading.getTotalAmount().doubleValue() 
                    : (item.unitsConsumed * item.defaultUnitRate);
            item.freeAllowanceUnits = thisCycleReading.getFreeAllowanceUnits() != null 
                    ? thisCycleReading.getFreeAllowanceUnits().doubleValue() 
                    : 0.0;
            item.defaultSplitMode = thisCycleReading.getSplitMode() != null 
                    ? thisCycleReading.getSplitMode() 
                    : item.defaultSplitMode;
            item.photoUrl = thisCycleReading.getPhotoUrl();

            if (thisCycleReading.getTenantSplitDetailsJson() != null && !thisCycleReading.getTenantSplitDetailsJson().isBlank()) {
                try {
                    List<TenantUtilitySplit> splits = objectMapper.readValue(
                            thisCycleReading.getTenantSplitDetailsJson(),
                            new TypeReference<List<TenantUtilitySplit>>() {}
                    );
                    item.tenantSplits = splits;
                } catch (Exception ignored) {}
            }
        } else {
            // Find latest prior recorded reading as previousReading
            MeterReading latestPrior = roomReadings.stream()
                    .max(Comparator.comparing(MeterReading::getReadingDate, Comparator.nullsFirst(Comparator.naturalOrder())))
                    .orElse(null);
            if (latestPrior != null) {
                item.lastReadingValue = latestPrior.getReadingValue() != null ? latestPrior.getReadingValue().doubleValue() : 0.0;
                item.lastReadingDate = latestPrior.getReadingDate();
            } else {
                item.lastReadingValue = 0.0;
                item.lastReadingDate = LocalDate.now().minusMonths(1);
            }
            item.currentReadingValue = null;
            item.unitsConsumed = 0.0;
            item.totalAmount = 0.0;
            item.freeAllowanceUnits = 0.0;
        }

        // Find active occupants accurately scoped to this exact Room & Building
        List<Tenant> tenants = getActiveTenantsForRoom(room, propertyId);

        item.occupiedCount = tenants.size();
        for (Tenant t : tenants) {
            Map<String, Object> occ = new HashMap<>();
            occ.put("id", t.getId());
            String fn = t.getFirstName() != null ? t.getFirstName() : "";
            String ln = t.getLastName() != null ? t.getLastName() : "";
            String fullName = (fn + " " + ln).trim();
            occ.put("name", fullName.isEmpty() ? "Resident" : fullName);
            occ.put("checkInDate", parseTenantCheckIn(t));
            occ.put("mobile", t.getMobile() != null ? t.getMobile() : "");
            item.occupants.add(occ);
        }

        return item;
    }

    /**
     * Accurately finds active residents for a specific room entity.
     * Prevents false matches across different buildings/towers that share the same room number (e.g. Tower A Room 102 vs Tower C Room 102).
     */
    public List<Tenant> getActiveTenantsForRoom(Room room, UUID propertyId) {
        if (room == null || room.getRoomNumber() == null) return Collections.emptyList();

        UUID resolvedPropertyId = propertyId;
        if (resolvedPropertyId == null && room.getFloor() != null && room.getFloor().getBuilding() != null && room.getFloor().getBuilding().getProperty() != null) {
            resolvedPropertyId = room.getFloor().getBuilding().getProperty().getId();
        }
        final UUID pid = resolvedPropertyId;

        // 1. Try finding by direct Bed -> Booking association for this exact Room ID
        try {
            List<Tenant> directTenants = bookingRepository.findActiveTenantsByRoomId(room.getId());
            if (directTenants != null && !directTenants.isEmpty()) {
                return directTenants.stream()
                        .filter(t -> t != null && (t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus())))
                        .distinct()
                        .collect(Collectors.toList());
            }
        } catch (Exception ignored) {}

        // 2. Fetch all active tenants with matching roomNumber in this property
        List<Tenant> candidates = new ArrayList<>();
        if (pid != null) {
            try {
                candidates = tenantRepository.findByPropertyIdAndRoomNumberNative(pid, room.getRoomNumber().trim());
            } catch (Exception ignored) {}
        }
        if (candidates.isEmpty() && pid != null) {
            try {
                candidates = tenantRepository.findByPropertyIdAndRoomNumber(pid, room.getRoomNumber().trim());
            } catch (Exception ignored) {}
        }
        if (candidates.isEmpty()) {
            try {
                candidates = tenantRepository.findAll().stream()
                        .filter(t -> (pid == null || pid.equals(t.getPropertyId()))
                                  && room.getRoomNumber().trim().equalsIgnoreCase(t.getRoomNumber() != null ? t.getRoomNumber().trim() : ""))
                        .collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        List<Tenant> activeCandidates = candidates.stream()
                .filter(t -> t != null && (t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus())))
                .collect(Collectors.toList());

        if (activeCandidates.isEmpty()) {
            return Collections.emptyList();
        }

        // Check if multiple rooms in this property share this roomNumber across different towers/buildings
        List<Room> sameNumberRooms = new ArrayList<>();
        if (pid != null) {
            try {
                sameNumberRooms = roomRepository.findByPropertyIdNative(pid).stream()
                        .filter(r -> r.getRoomNumber() != null && r.getRoomNumber().trim().equalsIgnoreCase(room.getRoomNumber().trim()))
                        .collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        // If there's only 1 room with this roomNumber in the entire property, all matching active tenants belong here!
        if (sameNumberRooms.size() <= 1) {
            return activeCandidates;
        }

        // Multiple rooms with same roomNumber (e.g. Tower A Room 102 vs Tower C Room 102):
        List<Tenant> matched = new ArrayList<>();
        for (Tenant t : activeCandidates) {
            List<Booking> bookings = new ArrayList<>();
            try {
                bookings = bookingRepository.findByTenant(t);
            } catch (Exception ignored) {}

            boolean hasExplicitBookingForOtherRoom = false;
            boolean hasExplicitBookingForThisRoom = false;

            for (Booking b : bookings) {
                if (b.getBed() != null && b.getBed().getRoom() != null) {
                    if (room.getId().equals(b.getBed().getRoom().getId())) {
                        hasExplicitBookingForThisRoom = true;
                        break;
                    } else {
                        hasExplicitBookingForOtherRoom = true;
                    }
                }
            }

            if (hasExplicitBookingForThisRoom) {
                matched.add(t);
            } else if (!hasExplicitBookingForOtherRoom) {
                // If tenant has no explicit booking to another tower's room, match to the primary room of that roomNumber
                Room primaryRoom = sameNumberRooms.get(0);
                if (room.getId().equals(primaryRoom.getId())) {
                    matched.add(t);
                }
            }
        }

        return matched;
    }

    /**
     * Atomically records bulk meter readings and optionally merges them into monthly rent invoices.
     */
    @Transactional
    public Map<String, Object> bulkRecordAndApply(UUID propertyId, List<Map<String, Object>> readings, boolean appendToRentInvoices) {
        int recordedRooms = 0;
        int totalTenantsBilled = 0;
        double totalBilledAmount = 0.0;
        List<MeterReading> savedReadings = new ArrayList<>();

        for (Map<String, Object> req : readings) {
            RoomUtilityCalculation calc = calculateRoomUtility(req);
            Room room = roomRepository.findById(calc.getRoomId()).orElse(null);
            if (room == null) continue;

            MeterReading mr = new MeterReading();
            mr.setRoom(room);
            mr.setReadingDate(LocalDate.now());
            mr.setPreviousReadingValue(BigDecimal.valueOf(calc.getPreviousReading()));
            mr.setReadingValue(BigDecimal.valueOf(calc.getCurrentReading()));
            mr.setUnitsConsumed(BigDecimal.valueOf(calc.getUnitsConsumed()));
            mr.setUnitRate(BigDecimal.valueOf(calc.getUnitRate()));
            mr.setTotalAmount(BigDecimal.valueOf(calc.getTotalAmount()));
            mr.setSplitMode(calc.getSplitMode());
            mr.setFreeAllowanceUnits(BigDecimal.valueOf(calc.getFreeAllowanceUnits()));
            mr.setBillingMonth(req.containsKey("billingMonth") ? Integer.parseInt(req.get("billingMonth").toString()) : LocalDate.now().getMonthValue());
            mr.setBillingYear(req.containsKey("billingYear") ? Integer.parseInt(req.get("billingYear").toString()) : LocalDate.now().getYear());
            mr.setStatus(appendToRentInvoices ? "BILLED" : "UNBILLED");

            if (req.containsKey("photoUrl") && req.get("photoUrl") != null) {
                mr.setPhotoUrl(req.get("photoUrl").toString());
            }

            try {
                mr.setTenantSplitDetailsJson(objectMapper.writeValueAsString(calc.getTenantSplits()));
            } catch (Exception ignored) {}

            savedReadings.add(mr);
            recordedRooms++;

            // Append to Rent Invoices
            if (appendToRentInvoices && !calc.getTenantSplits().isEmpty()) {
                for (TenantUtilitySplit split : calc.getTenantSplits()) {
                    if (split.getAmount() <= 0) continue;
                    Tenant tenant = tenantRepository.findById(split.getTenantId()).orElse(null);
                    if (tenant == null) continue;

                    // Look for existing unpaid invoice this month
                    List<Invoice> invoices = invoiceRepository.findByTenant(tenant);
                    Invoice targetInv = invoices.stream()
                            .filter(i -> "UNPAID".equalsIgnoreCase(i.getStatus()) || "PARTIALLY_PAID".equalsIgnoreCase(i.getStatus()))
                            .findFirst().orElse(null);

                    String lineDesc = String.format("Electricity (%s units @ ₹%.2f/unit, Room %s)",
                            split.getUnits(), calc.getUnitRate(), calc.getRoomNumber());

                    if (targetInv != null) {
                        InvoiceItem item = new InvoiceItem(targetInv, lineDesc, BigDecimal.valueOf(split.getAmount()));
                        targetInv.getItems().add(item);
                        targetInv.setAmountDue(targetInv.getAmountDue().add(BigDecimal.valueOf(split.getAmount())));
                        invoiceRepository.save(targetInv);
                    } else {
                        // Create dedicated utility invoice
                        Invoice utilInv = new Invoice();
                        utilInv.setTenant(tenant);
                        utilInv.setInvoiceNumber("UTIL-" + LocalDate.now().getYear() + String.format("%02d", mr.getBillingMonth()) + "-" + tenant.getId().toString().substring(0, 6).toUpperCase());
                        utilInv.setIssueDate(LocalDate.now());
                        utilInv.setDueDate(LocalDate.now().plusDays(5));
                        utilInv.setAmountDue(BigDecimal.valueOf(split.getAmount()));
                        utilInv.setAmountPaid(BigDecimal.ZERO);
                        utilInv.setStatus("UNPAID");

                        InvoiceItem item = new InvoiceItem(utilInv, lineDesc, BigDecimal.valueOf(split.getAmount()));
                        utilInv.getItems().add(item);
                        invoiceRepository.save(utilInv);
                    }

                    totalTenantsBilled++;
                    totalBilledAmount += split.getAmount();
                }
            }
        }

        if (!savedReadings.isEmpty()) {
            meterReadingRepository.saveAll(savedReadings);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("recordedRooms", recordedRooms);
        res.put("totalTenantsBilled", totalTenantsBilled);
        res.put("totalBilledAmount", Math.round(totalBilledAmount * 100.0) / 100.0);
        return res;
    }
}
