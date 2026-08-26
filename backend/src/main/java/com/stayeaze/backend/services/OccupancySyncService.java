package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OccupancySyncService {

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private FloorService floorService;

    @Transactional
    public void syncStatsAndEvictCaches(Floor floor) {
        if (floor == null) {
            floorService.evictCaches();
            return;
        }

        Building building = floor.getBuilding();
        if (building != null) {
            List<Floor> activeFloors = floorRepository.findByBuilding(building).stream()
                    .filter(f -> f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus()))
                    .collect(Collectors.toList());

            int bldRooms = 0, bldBeds = 0, bldOcc = 0;
            for (Floor f : activeFloors) {
                List<Room> fRooms = roomRepository.findByFloor(f).stream()
                        .filter(r -> r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus()))
                        .collect(Collectors.toList());
                bldRooms += fRooms.size();
                for (Room r : fRooms) {
                    List<Bed> rBeds = bedRepository.findByRoom(r).stream()
                            .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                            .collect(Collectors.toList());
                    bldBeds += rBeds.size();
                    bldOcc += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                }
            }
            building.setRooms(bldRooms);
            building.setBeds(bldBeds);
            building.setOccupied(bldOcc);
            buildingRepository.save(building);

            Property property = building.getProperty();
            if (property != null) {
                List<Building> pBuildings = buildingRepository.findByProperty(property);
                int propRooms = pBuildings.stream().mapToInt(Building::getRooms).sum();
                int propBeds = pBuildings.stream().mapToInt(Building::getBeds).sum();
                int propOcc = pBuildings.stream().mapToInt(Building::getOccupied).sum();
                property.setTotalRooms(propRooms);
                property.setTotalBeds(propBeds);
                property.setOccupiedBeds(propOcc);
                propertyRepository.save(property);
            }
        }
        floorService.evictCaches();
    }

    @Transactional
    public void syncAllStatsForOrg(Organization organization) {
        if (organization == null) return;
        try {
            List<Building> buildings = buildingRepository.findByOrganization(organization);
            for (Building building : buildings) {
                List<Floor> activeFloors = floorRepository.findByBuilding(building).stream()
                        .filter(f -> f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus()))
                        .collect(Collectors.toList());

                int bldRooms = 0, bldBeds = 0, bldOcc = 0;
                for (Floor f : activeFloors) {
                    List<Room> fRooms = roomRepository.findByFloor(f).stream()
                            .filter(r -> r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus()))
                            .collect(Collectors.toList());
                    bldRooms += fRooms.size();
                    for (Room r : fRooms) {
                        List<Bed> rBeds = bedRepository.findByRoom(r).stream()
                                .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                                .collect(Collectors.toList());
                        bldBeds += rBeds.size();
                        bldOcc += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                    }
                }
                building.setRooms(bldRooms);
                building.setBeds(bldBeds);
                building.setOccupied(bldOcc);
                buildingRepository.save(building);

                Property property = building.getProperty();
                if (property != null) {
                    List<Building> pBuildings = buildingRepository.findByProperty(property);
                    int propRooms = pBuildings.stream().mapToInt(Building::getRooms).sum();
                    int propBeds = pBuildings.stream().mapToInt(Building::getBeds).sum();
                    int propOcc = pBuildings.stream().mapToInt(Building::getOccupied).sum();
                    property.setTotalRooms(propRooms);
                    property.setTotalBeds(propBeds);
                    property.setOccupiedBeds(propOcc);
                    propertyRepository.save(property);
                }
            }
        } catch (Exception e) {
            System.err.println("Error syncing organization stats: " + e.getMessage());
        }
        floorService.evictCaches();
    }

    @Autowired
    private BookingRepository bookingRepository;

    @Transactional
    public void syncStatsForRoom(Room room) {
        if (room != null && room.getFloor() != null) {
            syncStatsAndEvictCaches(room.getFloor());
        } else {
            floorService.evictCaches();
        }
    }

    /**
     * Atomically transfers tenant from previous room/bed to new room/bed:
     * - Marks old bed as AVAILABLE & clears tenant assignment
     * - Marks new bed as OCCUPIED & stamps tenant details
     * - Re-links active Booking entity to the new bed
     * - Recalculates floor, building, and property occupancy statistics
     * - Evicts all stale caches
     */
    @Transactional
    public void handleTenantRoomTransfer(
            Tenant tenant,
            UUID oldPropertyId,
            String oldRoomNumber,
            String oldBedNumber,
            UUID newPropertyId,
            String newRoomNumber,
            String newBedNumber,
            Organization organization) {
        if (tenant == null) return;

        Room oldRoom = null;
        Room newRoom = null;

        // 1. Process Old Bed / Room (if previous room & bed existed)
        if (oldRoomNumber != null && !oldRoomNumber.isBlank() && oldBedNumber != null && !oldBedNumber.isBlank()) {
            try {
                List<Bed> orgBeds = null;
                if (organization != null) {
                    try {
                        orgBeds = bedRepository.findByOrganizationId(organization.getId());
                    } catch (Exception ignored) {}
                }
                if (orgBeds == null || orgBeds.isEmpty()) {
                    orgBeds = bedRepository.findAll();
                }

                Bed oldBed = orgBeds.stream().filter(b ->
                    b != null && b.getBedNumber() != null && b.getBedNumber().trim().equalsIgnoreCase(oldBedNumber.trim()) &&
                    b.getRoom() != null && b.getRoom().getRoomNumber() != null && b.getRoom().getRoomNumber().trim().equalsIgnoreCase(oldRoomNumber.trim()) &&
                    (oldPropertyId == null || b.getRoom().getFloor() == null || b.getRoom().getFloor().getBuilding() == null || b.getRoom().getFloor().getBuilding().getProperty() == null || oldPropertyId.equals(b.getRoom().getFloor().getBuilding().getProperty().getId()))
                ).findFirst().orElse(null);

                if (oldBed != null) {
                    oldBed.setStatus("AVAILABLE");
                    oldBed.setTenantId(null);
                    oldBed.setTenantName(null);
                    bedRepository.save(oldBed);
                    oldRoom = oldBed.getRoom();
                }
            } catch (Exception e) {
                System.err.println("Failed to free old bed: " + e.getMessage());
            }
        }

        // 2. Process New Bed / Room (if new room & bed provided)
        Bed newBed = null;
        if (newRoomNumber != null && !newRoomNumber.isBlank() && newBedNumber != null && !newBedNumber.isBlank() &&
            (tenant.getStatus() == null || "ACTIVE".equalsIgnoreCase(tenant.getStatus()) || "CHECKED_IN".equalsIgnoreCase(tenant.getStatus()))) {
            try {
                List<Bed> orgBeds = null;
                if (organization != null) {
                    try {
                        orgBeds = bedRepository.findByOrganizationId(organization.getId());
                    } catch (Exception ignored) {}
                }
                if (orgBeds == null || orgBeds.isEmpty()) {
                    orgBeds = bedRepository.findAll();
                }

                newBed = orgBeds.stream().filter(b ->
                    b != null && b.getBedNumber() != null && b.getBedNumber().trim().equalsIgnoreCase(newBedNumber.trim()) &&
                    b.getRoom() != null && b.getRoom().getRoomNumber() != null && b.getRoom().getRoomNumber().trim().equalsIgnoreCase(newRoomNumber.trim()) &&
                    (newPropertyId == null || b.getRoom().getFloor() == null || b.getRoom().getFloor().getBuilding() == null || b.getRoom().getFloor().getBuilding().getProperty() == null || newPropertyId.equals(b.getRoom().getFloor().getBuilding().getProperty().getId()))
                ).findFirst().orElse(null);

                if (newBed != null) {
                    newBed.setStatus("OCCUPIED");
                    newBed.setTenantId(tenant.getId() != null ? tenant.getId().toString() : null);
                    String tName = ((tenant.getFirstName() != null ? tenant.getFirstName() : "") + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim();
                    newBed.setTenantName(tName.isBlank() ? "Occupant" : tName);
                    bedRepository.save(newBed);
                    newRoom = newBed.getRoom();
                }
            } catch (Exception e) {
                System.err.println("Failed to assign new bed: " + e.getMessage());
            }
        }

        // 3. Update active Booking record for this tenant
        try {
            List<Booking> tenantBookings = bookingRepository.findByTenant(tenant);
            for (Booking b : tenantBookings) {
                if (b != null && (b.getStatus() == null || "CONFIRMED".equalsIgnoreCase(b.getStatus()) || "CHECKED_IN".equalsIgnoreCase(b.getStatus()) || "PENDING".equalsIgnoreCase(b.getStatus()))) {
                    if (newBed != null) {
                        b.setBed(newBed);
                    }
                    if (newRoomNumber != null) {
                        b.setRoomNumber(newRoomNumber);
                    }
                    if (newBedNumber != null) {
                        b.setBedNumber(newBedNumber);
                    }
                    bookingRepository.save(b);
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to sync booking during room transfer: " + e.getMessage());
        }

        // 4. Sync Occupancy for Old Room & New Room (deduplicating same-floor calculations)
        if (oldRoom != null && newRoom != null && oldRoom.getFloor() != null && newRoom.getFloor() != null &&
            oldRoom.getFloor().getId().equals(newRoom.getFloor().getId())) {
            syncStatsForRoom(newRoom);
        } else {
            if (oldRoom != null) {
                syncStatsForRoom(oldRoom);
            }
            if (newRoom != null) {
                syncStatsForRoom(newRoom);
            }
        }

        // 5. Global Cache Eviction (Targeted room/floor sync above already updated occupancy stats)
        floorService.evictCaches();
    }
}
