package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.RoomRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.BuildingRepository;
import com.stayeaze.backend.repository.FloorRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

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

    private Room populateRoomStats(Room room) {
        if (room == null) return null;
        List<Bed> beds = bedRepository.findByRoom(room);

        // If no beds exist for this room yet, auto-create beds based on sharing capacity
        if (beds.isEmpty() && room.getSharing() != null && room.getSharing() > 0) {
            for (int i = 1; i <= room.getSharing(); i++) {
                Bed b = new Bed(room, "B" + i);
                bedRepository.save(b);
            }
            beds = bedRepository.findByRoom(room);
        }

        room.setBeds(beds.size());

        List<Tenant> activeTenants = null;
        try {
            Organization org = getLoggedUserOrg();
            activeTenants = tenantRepository.findByOrganization(org);
        } catch (Exception ignored) {}

        int occ = 0;
        int res = 0;
        for (Bed b : beds) {
            boolean isOccupied = "OCCUPIED".equalsIgnoreCase(b.getStatus());
            boolean isReserved = "RESERVED".equalsIgnoreCase(b.getStatus()) || "BOOKED".equalsIgnoreCase(b.getStatus());

            if (!isOccupied && activeTenants != null) {
                for (Tenant t : activeTenants) {
                    boolean statusOk = t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus());
                    if (statusOk && room.getRoomNumber() != null && room.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) 
                            && b.getBedNumber() != null && b.getBedNumber().equalsIgnoreCase(t.getBedNumber())) {
                        isOccupied = true;
                        b.setStatus("OCCUPIED");
                        bedRepository.save(b);
                        break;
                    }
                }
            }

            if (isOccupied) {
                occ++;
            } else if (isReserved) {
                res++;
            }
        }
        room.setOccupied(occ);

        // Dynamic room status calculation based on bed occupancy & reservation
        String currStatus = room.getStatus();
        if (currStatus == null || (!"MAINTENANCE".equalsIgnoreCase(currStatus) && !"BLOCKED".equalsIgnoreCase(currStatus) && !"ARCHIVED".equalsIgnoreCase(currStatus))) {
            int totalBeds = beds.size();
            if (totalBeds > 0) {
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
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Floor getAuthorizedFloor(UUID propertyId, UUID buildingId, UUID floorId) {
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

        Room saved = roomRepository.save(room);
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
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/rooms")
    public ResponseEntity<?> getFlatRooms() {
        Organization organization = getLoggedUserOrg();
        List<Room> rooms = roomRepository.findByOrganizationId(organization.getId());
        rooms.forEach(this::populateRoomStats);
        return ResponseEntity.ok(rooms);
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
        if (request.getStatus() != null) {
            room.setStatus(request.getStatus());
        }
        if (request.getAmenities() != null) {
            room.setAmenities(request.getAmenities());
        }

        Room updated = roomRepository.save(room);
        return ResponseEntity.ok(updated);
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
        roomRepository.save(room);

        return ResponseEntity.ok(new MessageResponse("Room successfully archived."));
    }

    @PostMapping("/rooms")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createFlatRoom(@RequestBody RoomRequest request) {
        UUID floorId = request.getFloorId();
        if (floorId == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: floorId is required!"));
        }
        Organization organization = getLoggedUserOrg();
        Floor floor = floorRepository.findById(floorId).orElse(null);
        if (floor == null || !floor.getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Floor not found or unauthorized"));
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

        Room saved = roomRepository.save(room);
        return new ResponseEntity<>(populateRoomStats(saved), HttpStatus.CREATED);
    }

    @GetMapping("/rooms/{id}")
    public ResponseEntity<?> getFlatRoomById(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || !room.getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }
        return ResponseEntity.ok(populateRoomStats(room));
    }

    @PutMapping("/rooms/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateFlatRoom(@PathVariable UUID id, @RequestBody RoomRequest request) {
        Organization organization = getLoggedUserOrg();
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || !room.getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank()) {
            room.setRoomNumber(request.getRoomNumber());
        }
        if (request.getSharingType() != null) room.setSharingType(request.getSharingType().toUpperCase());
        if (request.getBaseRent() != null) room.setBaseRent(request.getBaseRent());
        if (request.getStatus() != null) room.setStatus(request.getStatus());
        if (request.getAmenities() != null) room.setAmenities(request.getAmenities());

        Room saved = roomRepository.save(room);
        return ResponseEntity.ok(populateRoomStats(saved));
    }

    @DeleteMapping("/rooms/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteFlatRoom(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null || !room.getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }
        room.setStatus("ARCHIVED");
        roomRepository.save(room);
        return ResponseEntity.ok(new MessageResponse("Room deleted successfully."));
    }
}
