package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.RoomRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.RoomDTO;
import com.stayeaze.backend.payload.response.MinimalRoomDTO;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.BuildingRepository;
import com.stayeaze.backend.repository.FloorRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoomRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class RoomController {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private com.stayeaze.backend.services.RoomService roomService;

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Room populateRoomStats(Room room) {
        if (room == null) return null;
        List<Bed> beds = bedRepository.findByRoomId(room.getId());

        // If no beds exist for this room yet, auto-create beds based on sharing capacity
        if ((beds == null || beds.isEmpty()) && room.getSharing() != null && room.getSharing() > 0) {
            List<Bed> newBeds = new ArrayList<>();
            for (int i = 1; i <= room.getSharing(); i++) {
                newBeds.add(new Bed(room, "B" + i));
            }
            try {
                bedRepository.saveAllAndFlush(newBeds);
                beds = newBeds;
            } catch (Exception ignored) {
                beds = bedRepository.findByRoomId(room.getId());
            }
        }
        if (beds == null) beds = java.util.Collections.emptyList();

        room.setBeds(beds.size());

        List<Tenant> activeTenants = null;
        try {
            Organization org = getLoggedUserOrg();
            activeTenants = tenantRepository.findByOrganization(org);
        } catch (Exception ignored) {}

        int occ = 0;
        int res = 0;
        for (Bed bed : beds) {
            boolean isOcc = "OCCUPIED".equalsIgnoreCase(bed.getStatus());
            boolean isRes = "RESERVED".equalsIgnoreCase(bed.getStatus());
            if (!isOcc && !isRes && activeTenants != null) {
                for (Tenant t : activeTenants) {
                    boolean statusOk = t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus());
                    if (statusOk && room.getRoomNumber() != null && room.getRoomNumber().equalsIgnoreCase(t.getRoomNumber())
                            && bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(t.getBedNumber())) {
                        isOcc = true;
                        break;
                    }
                }
            }
            if (isOcc) occ++;
            if (isRes) res++;
        }
        room.setOccupied(occ);

        // Auto-compute status if currently not archived / maintenance
        String curr = room.getStatus();
        if (curr == null || (!curr.equalsIgnoreCase("archived") && !curr.equalsIgnoreCase("maintenance"))) {
            int totalBeds = beds.size();
            if (totalBeds == 0) {
                room.setStatus("available");
            } else {
                if (occ == totalBeds) {
                    room.setStatus("occupied");
                } else if (res == totalBeds) {
                    room.setStatus("reserved");
                } else if (occ > 0) {
                    room.setStatus("partially_occupied");
                } else if (res > 0) {
                    room.setStatus("partially_reserved");
                } else {
                    room.setStatus("available");
                }
            }
        }
        return room;
    }

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        if (securityUtils.isSuperAdmin()) {
            return organizationRepository.findAll().stream().findFirst().orElse(null);
        }
        return null;
    }

    private Floor getAuthorizedFloor(UUID propertyId, UUID buildingId, UUID floorId) {
        securityUtils.validatePropertyAccess(propertyId);
        Organization organization = getLoggedUserOrg();
        Property property = propertyRepository.findByIdAndOrganization(propertyId, organization)
                .orElseThrow(() -> new IllegalArgumentException("Property not found or unauthorized"));
        Building building = buildingRepository.findByIdAndProperty(buildingId, property)
                .orElseThrow(() -> new IllegalArgumentException("Building not found or unauthorized"));
        return floorRepository.findByIdAndBuilding(floorId, building)
                .orElseThrow(() -> new IllegalArgumentException("Floor not found or unauthorized"));
    }

    @PostMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{floorId}/rooms")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createRoom(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID floorId, @Valid @RequestBody RoomRequest request) {
        Floor floor;
        try {
            floor = getAuthorizedFloor(propertyId, buildingId, floorId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        if (roomRepository.existsByFloorAndRoomNumber(floor, request.getRoomNumber())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Room number already exists on this floor!"));
        }

        Room room = new Room(floor, request.getRoomNumber(), request.getSharingType(), request.getBaseRent());
        if (request.getStatus() != null) {
            room.setStatus(request.getStatus());
        }
        if (request.getAmenities() != null) {
            room.setAmenities(request.getAmenities());
        }

        Room saved = roomService.saveRoom(room);
        updatePropertyAndBuildingStats(floor);
        return new ResponseEntity<>(populateRoomStats(saved), HttpStatus.CREATED);
    }

    @GetMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{floorId}/rooms")
    public ResponseEntity<?> getAllRooms(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID floorId) {
        Floor floor;
        try {
            floor = getAuthorizedFloor(propertyId, buildingId, floorId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<Room> rooms = roomRepository.findByFloor(floor);
        rooms.forEach(this::populateRoomStats);
        List<RoomDTO> dtos = rooms.stream().map(RoomDTO::fromEntity).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/rooms/minimal")
    public ResponseEntity<List<MinimalRoomDTO>> getMinimalRooms(
            @RequestParam(required = false) UUID propertyId,
            @RequestParam(required = false) UUID floorId,
            @RequestParam(required = false) UUID buildingId) {
        Organization organization = getLoggedUserOrg();
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();

        List<Room> rooms;
        if (floorId != null) {
            rooms = roomRepository.findByFloorId(floorId);
        } else if (propertyId != null) {
            rooms = roomRepository.findByPropertyIdNative(propertyId);
        } else if (organization != null) {
            rooms = roomRepository.findByOrganizationId(organization.getId());
        } else {
            rooms = securityUtils.isSuperAdmin() ? roomRepository.findAll() : Collections.emptyList();
        }

        List<MinimalRoomDTO> dtos = rooms.stream()
                .filter(r -> {
                    if ("ARCHIVED".equalsIgnoreCase(r.getStatus())) return false;
                    UUID propId = null;
                    try {
                        if (r.getFloor() != null && r.getFloor().getBuilding() != null && r.getFloor().getBuilding().getProperty() != null) {
                            propId = r.getFloor().getBuilding().getProperty().getId();
                        }
                    } catch (Exception ignored) {}
                    if (assignedProps != null && propId != null && !assignedProps.contains(propId)) {
                        return false;
                    }
                    if (buildingId != null) {
                        UUID bId = null;
                        try {
                            if (r.getFloor() != null && r.getFloor().getBuilding() != null) {
                                bId = r.getFloor().getBuilding().getId();
                            }
                        } catch (Exception ignored) {}
                        if (bId == null || !buildingId.equals(bId)) return false;
                    }
                    return true;
                })
                .map(MinimalRoomDTO::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/rooms")
    public ResponseEntity<?> getFlatRooms(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<com.stayeaze.backend.payload.response.RoomDTO> all = roomService.getRoomsByOrg(organization);
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            all = all.stream().filter(r -> r.getPropertyId() != null && assignedProps.contains(r.getPropertyId())).collect(Collectors.toList());
        }
        if (propertyId != null) {
            all = all.stream().filter(r -> propertyId.equals(r.getPropertyId())).collect(Collectors.toList());
            if (all.isEmpty()) {
                try {
                    List<Room> propRooms = roomRepository.findByPropertyIdNative(propertyId);
                    if (propRooms != null && !propRooms.isEmpty()) {
                        propRooms.forEach(this::populateRoomStats);
                        all = propRooms.stream().map(RoomDTO::fromEntity).collect(Collectors.toList());
                    }
                } catch (Exception ignored) {}
            }
        }
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(all, page, pageSize));
    }

    @GetMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}")
    public ResponseEntity<?> getRoomById(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID floorId, @PathVariable UUID roomId) {
        Floor floor;
        try {
            floor = getAuthorizedFloor(propertyId, buildingId, floorId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Room room = roomRepository.findByIdAndFloor(roomId, floor).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found on this floor."));
        }

        return ResponseEntity.ok(populateRoomStats(room));
    }

    @PutMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateRoom(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID floorId, @PathVariable UUID roomId, @Valid @RequestBody RoomRequest request) {
        Floor floor;
        try {
            floor = getAuthorizedFloor(propertyId, buildingId, floorId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Room room = roomRepository.findByIdAndFloor(roomId, floor).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found on this floor."));
        }

        if (!room.getRoomNumber().equals(request.getRoomNumber()) && roomRepository.existsByFloorAndRoomNumber(floor, request.getRoomNumber())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Room number already exists on this floor!"));
        }

        room.setRoomNumber(request.getRoomNumber());
        room.setSharingType(request.getSharingType());
        room.setBaseRent(request.getBaseRent());
        if (request.getStatus() != null && ("MAINTENANCE".equalsIgnoreCase(request.getStatus()) || "ARCHIVED".equalsIgnoreCase(request.getStatus()))) {
            room.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getAmenities() != null) {
            room.setAmenities(request.getAmenities());
        }

        Room updated = roomService.saveRoom(room);
        try {
            if (occupancySyncService != null) {
                occupancySyncService.syncStatsForRoom(updated);
                occupancySyncService.syncStatsAndEvictCaches(updated.getFloor());
            } else {
                updatePropertyAndBuildingStats(room.getFloor());
            }
        } catch (Exception ignored) {}
        return ResponseEntity.ok(populateRoomStats(updated));
    }

    @DeleteMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteRoom(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID floorId, @PathVariable UUID roomId) {
        Floor floor;
        try {
            floor = getAuthorizedFloor(propertyId, buildingId, floorId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Room room = roomRepository.findByIdAndFloor(roomId, floor).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }

        room.setStatus("ARCHIVED");
        roomService.saveRoom(room);
        updatePropertyAndBuildingStats(room.getFloor());

        return ResponseEntity.ok(new MessageResponse("Room successfully archived."));
    }

    private boolean isSuperAdminUser() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return false;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities() != null) {
            boolean hasSuperAdminRole = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") || a.getAuthority().equalsIgnoreCase("SUPER_ADMIN"));
            if (hasSuperAdminRole) return true;
        }
        return false;
    }

    private boolean isBuildingAuthorizedForUser(Building building) {
        if (building == null || building.getId() == null) return false;
        if (isSuperAdminUser()) return true;
        try {
            Organization organization = getLoggedUserOrg();
            if (organization == null) return false;
            UUID propId = buildingRepository.findPropertyIdByBuildingId(building.getId());
            if (propId != null) {
                Property prop = propertyRepository.findByIdSuperAdmin(propId).orElse(null);
                if (prop != null && prop.getOrganization() != null) {
                    return prop.getOrganization().getId().equals(organization.getId());
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private boolean isFloorAuthorizedForUser(Floor floor) {
        if (floor == null || floor.getId() == null) return false;
        if (isSuperAdminUser()) return true;
        try {
            UUID bldgId = floorRepository.findBuildingIdByFloorId(floor.getId());
            if (bldgId != null) {
                Building b = buildingRepository.findById(bldgId).orElse(new Building());
                if (b.getId() == null) b.setId(bldgId);
                return isBuildingAuthorizedForUser(b);
            }
        } catch (Exception ignored) {}
        return false;
    }

    private boolean isRoomAuthorizedForUser(Room room) {
        if (room == null || room.getId() == null) return false;
        if (isSuperAdminUser()) return true;
        try {
            UUID floorId = roomRepository.findFloorIdByRoomId(room.getId());
            if (floorId != null) {
                Floor f = floorRepository.findById(floorId).orElse(new Floor());
                if (f.getId() == null) f.setId(floorId);
                return isFloorAuthorizedForUser(f);
            }
        } catch (Exception ignored) {}
        return false;
    }

    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/rooms")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createFlatRoom(@RequestBody RoomRequest request) {
        UUID floorId = request.getFloorId();
        if (floorId == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: floorId is required!"));
        }
        Organization organization = getLoggedUserOrg();
        Floor floor = floorRepository.findById(floorId).orElse(null);
        if (floor == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Floor not found!"));
        }
        if (organization != null && floor.getBuilding() != null && floor.getBuilding().getProperty() != null && floor.getBuilding().getProperty().getOrganization() != null) {
            if (!floor.getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Floor not found or unauthorized"));
            }
        }
        if (request.getBuildingId() != null && floor.getBuilding() != null && !floor.getBuilding().getId().equals(request.getBuildingId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Specified floor does not belong to the selected building!"));
        }
        if (request.getPropertyId() != null && floor.getBuilding() != null && floor.getBuilding().getProperty() != null && !floor.getBuilding().getProperty().getId().equals(request.getPropertyId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Specified floor does not belong to the selected property!"));
        }

        String roomNum = request.getRoomNumber();
        if (roomNum == null || roomNum.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: room number is required!"));
        }

        if (roomRepository.existsByFloorAndRoomNumber(floor, roomNum)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Room number already exists on this floor!"));
        }

        java.math.BigDecimal rent = request.getBaseRent();
        if (rent == null) rent = java.math.BigDecimal.ZERO;

        String sharingType = request.getSharingType();
        if (sharingType == null || sharingType.isBlank()) sharingType = "DOUBLE";

        Room room = new Room(floor, roomNum, sharingType.toUpperCase(), rent);
        if (request.getStatus() != null) room.setStatus(request.getStatus());
        if (request.getAmenities() != null) room.setAmenities(request.getAmenities());

        Room saved = roomService.saveRoom(room);
        Room populated = populateRoomStats(saved);
        updatePropertyAndBuildingStats(floor);
        return new ResponseEntity<>(populated, HttpStatus.CREATED);
    }

    @org.springframework.transaction.annotation.Transactional
    protected void updatePropertyAndBuildingStats(Floor floor) {
        if (floor == null) return;
        try {
            UUID bldgId = floorRepository.findBuildingIdByFloorId(floor.getId());
            if (bldgId == null) {
                try { bldgId = floor.getBuilding() != null ? floor.getBuilding().getId() : null; } catch (Exception ignored) {}
            }
            if (bldgId == null) return;

            Building building = buildingRepository.findById(bldgId).orElse(null);
            if (building != null) {
                List<Floor> bFloors = floorRepository.findByBuilding(building);
                int totalBldRooms = 0;
                int totalBldBeds = 0;
                int occupiedBldBeds = 0;
                for (Floor f : bFloors) {
                    List<Room> fRooms = roomRepository.findByFloor(f);
                    totalBldRooms += fRooms.size();
                    for (Room r : fRooms) {
                        List<Bed> rBeds = bedRepository.findByRoomId(r.getId());
                        totalBldBeds += rBeds.size();
                        occupiedBldBeds += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                    }
                }
                building.setRooms(totalBldRooms);
                building.setBeds(totalBldBeds);
                building.setOccupied(occupiedBldBeds);
                buildingRepository.save(building);

                UUID propId = buildingRepository.findPropertyIdByBuildingId(building.getId());
                if (propId != null) {
                    Property property = propertyRepository.findByIdSuperAdmin(propId).orElse(null);
                    if (property != null) {
                        List<Building> pBuildings = buildingRepository.findByProperty(property);
                        int totalPropRooms = 0;
                        int totalPropBeds = 0;
                        int occupiedPropBeds = 0;
                        for (Building b : pBuildings) {
                            totalPropRooms += b.getRooms();
                            totalPropBeds += b.getBeds();
                            occupiedPropBeds += b.getOccupied();
                        }
                        property.setTotalBuildings(pBuildings.size());
                        property.setTotalRooms(totalPropRooms);
                        property.setTotalBeds(totalPropBeds);
                        property.setOccupiedBeds(occupiedPropBeds);
                        propertyRepository.save(property);
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @GetMapping("/rooms/{id}")
    public ResponseEntity<?> getFlatRoomById(@PathVariable UUID id) {
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || !isRoomAuthorizedForUser(room)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }
        return ResponseEntity.ok(populateRoomStats(room));
    }

    @org.springframework.transaction.annotation.Transactional
    @PutMapping("/rooms/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateFlatRoom(@PathVariable UUID id, @RequestBody RoomRequest request) {
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || !isRoomAuthorizedForUser(room)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank()) {
            room.setRoomNumber(request.getRoomNumber());
        }
        if (request.getSharingType() != null) room.setSharingType(request.getSharingType().toUpperCase());
        if (request.getBaseRent() != null) room.setBaseRent(request.getBaseRent());
        if (request.getStatus() != null) room.setStatus(request.getStatus());
        if (request.getAmenities() != null) room.setAmenities(request.getAmenities());

        Room saved = roomService.saveRoom(room);
        Room populated = populateRoomStats(saved);
        updatePropertyAndBuildingStats(room.getFloor());
        return ResponseEntity.ok(populated);
    }

    @org.springframework.transaction.annotation.Transactional
    @DeleteMapping("/rooms/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteFlatRoom(@PathVariable UUID id) {
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || !isRoomAuthorizedForUser(room)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }
        room.setStatus("ARCHIVED");
        roomService.saveRoom(room);
        updatePropertyAndBuildingStats(room.getFloor());
        return ResponseEntity.ok(new MessageResponse("Room deleted successfully."));
    }

    @PutMapping("/rooms/{id}/unarchive")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> unarchiveFlatRoom(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || (organization != null && room.getFloor() != null && room.getFloor().getBuilding() != null && room.getFloor().getBuilding().getProperty() != null && room.getFloor().getBuilding().getProperty().getOrganization() != null && !room.getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }
        room.setStatus("available");
        roomService.saveRoom(room);

        List<Bed> beds = bedRepository.findByRoom(room);
        for (Bed b : beds) {
            if ("ARCHIVED".equalsIgnoreCase(b.getStatus())) {
                b.setStatus("AVAILABLE");
                bedRepository.save(b);
            }
        }

        if (room.getFloor() != null && "ARCHIVED".equalsIgnoreCase(room.getFloor().getStatus())) {
            room.getFloor().setStatus("AVAILABLE");
            floorRepository.save(room.getFloor());
        }

        updatePropertyAndBuildingStats(room.getFloor());
        return ResponseEntity.ok(new MessageResponse("Room and nested beds successfully unarchived."));
    }

    @GetMapping("/properties/{propertyId}/smart-space-matcher")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> smartSpaceMatcher(
            @PathVariable UUID propertyId,
            @RequestParam(required = false) String sharingType,
            @RequestParam(required = false) java.math.BigDecimal maxBudget,
            @RequestParam(required = false) String amenity,
            @RequestParam(required = false) Integer floorNumber) {
        try {
            List<Room> rooms = roomRepository.findByPropertyIdNative(propertyId);
            List<java.util.Map<String, Object>> matches = new java.util.ArrayList<>();

            for (Room r : rooms) {
                if ("ARCHIVED".equalsIgnoreCase(r.getStatus()) || "MAINTENANCE".equalsIgnoreCase(r.getStatus())) {
                    continue;
                }
                if (sharingType != null && !sharingType.isBlank() && !sharingType.equalsIgnoreCase(r.getSharingType())) {
                    continue;
                }
                if (maxBudget != null && r.getBaseRent() != null && r.getBaseRent().compareTo(maxBudget) > 0) {
                    continue;
                }
                if (amenity != null && !amenity.isBlank()) {
                    boolean hasAmenity = r.getAmenities() != null && r.getAmenities().stream().anyMatch(a -> a.equalsIgnoreCase(amenity));
                    if (!hasAmenity) continue;
                }
                if (floorNumber != null && r.getFloor() != null && !floorNumber.equals(r.getFloor().getFloorNumber())) {
                    continue;
                }

                // Check available beds in room
                List<Bed> beds = bedRepository.findByRoom(r);
                List<Bed> availableBeds = beds.stream()
                        .filter(b -> b.getStatus() == null || "AVAILABLE".equalsIgnoreCase(b.getStatus()))
                        .collect(Collectors.toList());

                if (availableBeds.isEmpty()) continue;

                // Fetch existing roommates
                List<Tenant> occupants = tenantRepository.findByPropertyIdAndRoomNumberNative(propertyId, r.getRoomNumber()).stream()
                        .filter(t -> t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()))
                        .collect(Collectors.toList());

                List<java.util.Map<String, Object>> roommateList = occupants.stream().map(t -> {
                    java.util.Map<String, Object> occ = new java.util.HashMap<>();
                    occ.put("name", t.getName());
                    occ.put("gender", t.getGender());
                    occ.put("bedNumber", t.getBedNumber());
                    occ.put("checkInDate", t.getLeaseStart());
                    return occ;
                }).collect(Collectors.toList());

                for (Bed b : availableBeds) {
                    java.util.Map<String, Object> match = new java.util.HashMap<>();
                    match.put("bedId", b.getId());
                    match.put("bedNumber", b.getBedNumber());
                    match.put("roomId", r.getId());
                    match.put("roomNumber", r.getRoomNumber());
                    match.put("sharingType", r.getSharingType());
                    match.put("baseRent", r.getBaseRent());
                    match.put("amenities", r.getAmenities());
                    match.put("floorNumber", r.getFloor() != null ? r.getFloor().getFloorNumber() : 1);
                    match.put("floorName", r.getFloor() != null ? r.getFloor().getName() : "Floor 1");
                    match.put("buildingName", r.getFloor() != null && r.getFloor().getBuilding() != null ? r.getFloor().getBuilding().getName() : "Main Building");
                    match.put("totalBeds", beds.size());
                    match.put("availableBedsCount", availableBeds.size());
                    match.put("currentOccupants", roommateList);
                    matches.add(match);
                }
            }

            return ResponseEntity.ok(matches);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Smart matcher failed: " + e.getMessage()));
        }
    }
}
