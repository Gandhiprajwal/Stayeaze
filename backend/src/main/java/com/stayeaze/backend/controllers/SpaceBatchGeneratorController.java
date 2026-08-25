package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.services.SubscriptionEnforcementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/properties/{propertyId}/buildings/{buildingId}/batch-generate-spaces")
public class SpaceBatchGeneratorController {

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubscriptionEnforcementService enforcementService;

    private Organization getLoggedUserOrg() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return null;
            if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
                if (userDetails.getOrgId() != null) {
                    return organizationRepository.findById(userDetails.getOrgId()).orElse(null);
                }
                return userRepository.findById(userDetails.getId()).map(User::getOrganization).orElse(null);
            }
            return userRepository.findByEmail(auth.getName()).map(User::getOrganization).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    @Transactional
    @CacheEvict(value = "properties-minimal", allEntries = true)
    public ResponseEntity<?> batchGenerateSpaces(
            @PathVariable UUID propertyId,
            @PathVariable UUID buildingId,
            @RequestBody Map<String, Object> request) {

        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new MessageResponse("Error: User does not belong to an active organization."));
        }

        try {
            enforcementService.validateOperationalAccess(org);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(new MessageResponse(e.getMessage()));
        }

        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || property.getOrganization() == null || !property.getOrganization().getId().equals(org.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        Building building = buildingRepository.findById(buildingId).orElse(null);
        if (building == null || building.getProperty() == null || !property.getId().equals(building.getProperty().getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Building not found for this property."));
        }

        if ("INACTIVE".equalsIgnoreCase(property.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Operational Action Rejected: Property is INACTIVE and locked from space creation."));
        }

        int startFloor = request.containsKey("startFloor") ? Integer.parseInt(request.get("startFloor").toString()) : 1;
        int endFloor = request.containsKey("endFloor") ? Integer.parseInt(request.get("endFloor").toString()) : 1;
        int roomsPerFloor = request.containsKey("roomsPerFloor") ? Integer.parseInt(request.get("roomsPerFloor").toString()) : 4;
        int bedsPerRoom = request.containsKey("bedsPerRoom") ? Integer.parseInt(request.get("bedsPerRoom").toString()) : 2;
        String sharingType = request.containsKey("sharingType") ? request.get("sharingType").toString().toUpperCase() : "DOUBLE";
        BigDecimal baseRent = request.containsKey("baseRent") ? new BigDecimal(request.get("baseRent").toString()) : BigDecimal.valueOf(8000);

        if (startFloor < 0 || endFloor < startFloor || (endFloor - startFloor + 1) > 50) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid floor range. Maximum 50 floors per batch."));
        }
        if (roomsPerFloor < 1 || roomsPerFloor > 50) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: roomsPerFloor must be between 1 and 50."));
        }
        if (bedsPerRoom < 1 || bedsPerRoom > 10) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: bedsPerRoom must be between 1 and 10."));
        }
        if (baseRent.compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: baseRent cannot be negative."));
        }

        int totalFloors = endFloor - startFloor + 1;
        int totalRoomsToCreate = totalFloors * roomsPerFloor;
        int totalBedsToCreate = totalRoomsToCreate * bedsPerRoom;

        try {
            enforcementService.validateBedCreation(org, totalBedsToCreate);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(new MessageResponse(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }

        // 1. Resolve / Create Floors
        List<Floor> existingFloors = floorRepository.findByBuilding(building);
        Map<Integer, Floor> floorMap = existingFloors.stream()
                .collect(Collectors.toMap(Floor::getFloorNumber, f -> f, (a, b) -> a));

        List<Floor> newFloorsToSave = new ArrayList<>();
        for (int f = startFloor; f <= endFloor; f++) {
            if (!floorMap.containsKey(f)) {
                Floor newFloor = new Floor(building, f, f == 0 ? "Ground Floor" : "Floor " + f);
                newFloorsToSave.add(newFloor);
            }
        }
        if (!newFloorsToSave.isEmpty()) {
            List<Floor> savedNewFloors = floorRepository.saveAll(newFloorsToSave);
            for (Floor sf : savedNewFloors) {
                floorMap.put(sf.getFloorNumber(), sf);
            }
        }

        // 2. Resolve / Create Rooms
        List<Room> newRoomsToSave = new ArrayList<>();

        for (int f = startFloor; f <= endFloor; f++) {
            Floor floor = floorMap.get(f);
            List<Room> existingRoomsOnFloor = roomRepository.findByFloor(floor);
            Set<String> existingRoomNumbers = existingRoomsOnFloor.stream()
                    .map(Room::getRoomNumber)
                    .collect(Collectors.toSet());

            for (int r = 1; r <= roomsPerFloor; r++) {
                String roomNum = String.format("%d%02d", f == 0 ? 0 : f, r);
                if (!existingRoomNumbers.contains(roomNum)) {
                    Room newRoom = new Room(floor, roomNum, sharingType, baseRent);
                    newRoomsToSave.add(newRoom);
                }
            }
        }

        List<Room> allActiveRooms = new ArrayList<>();
        if (!newRoomsToSave.isEmpty()) {
            List<Room> savedRooms = roomRepository.saveAll(newRoomsToSave);
            allActiveRooms.addAll(savedRooms);
        }

        // 3. Resolve / Create Beds for new rooms
        List<Bed> newBedsToSave = new ArrayList<>();
        for (Room room : allActiveRooms) {
            for (int b = 0; b < bedsPerRoom; b++) {
                char bedLetter = (char) ('A' + b);
                String bedNumber = String.valueOf(bedLetter);
                Bed newBed = new Bed(room, bedNumber);
                newBed.setQrCode("BED-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                newBedsToSave.add(newBed);
            }
        }

        if (!newBedsToSave.isEmpty()) {
            bedRepository.saveAll(newBedsToSave);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", String.format("Successfully generated %d floor(s), %d room(s), and %d bed(s) in %s.",
                newFloorsToSave.size(), newRoomsToSave.size(), newBedsToSave.size(), building.getName()));
        response.put("floorsCreated", newFloorsToSave.size());
        response.put("roomsCreated", newRoomsToSave.size());
        response.put("bedsCreated", newBedsToSave.size());
        response.put("buildingName", building.getName());

        return ResponseEntity.ok(response);
    }
}
