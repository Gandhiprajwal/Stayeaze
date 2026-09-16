package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.BedRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.MinimalBedDTO;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.repository.OrganizationRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class BedController {

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private com.stayeaze.backend.services.BedService bedService;

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private com.stayeaze.backend.services.FloorService floorService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    @Transactional(readOnly = true)
    public Bed populateBedDetails(Bed bed) {
        if (bed == null) return bed;
        try {
            Organization org = getLoggedUserOrg();
            return bedService.populateBedDetails(bed, org);
        } catch (Exception ignored) {}
        return bed;
    }

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElse(null);
    }

    private boolean isRoomAuthorizedForUser(Room room) {
        if (room == null || room.getId() == null) return false;
        if (securityUtils.isSuperAdmin()) return true;
        try {
            UUID propId = room.getPropertyId();
            if (propId != null) {
                return securityUtils.isPropertyAccessible(propId);
            }
            if (room.getFloor() != null && room.getFloor().getBuilding() != null && room.getFloor().getBuilding().getProperty() != null) {
                return securityUtils.isPropertyAccessible(room.getFloor().getBuilding().getProperty().getId());
            }
        } catch (Exception ignored) {}
        return true;
    }

    private Room getAuthorizedRoom(UUID roomId) {
        return roomRepository.findById(roomId)
                .orElse(null);
    }

    private int getMaxBedsForRoom(Room room) {
        if (room == null) return 1;
        if (room.getSharing() != null && room.getSharing() > 0) {
            return room.getSharing();
        }
        if (room.getSharingType() != null) {
            String type = room.getSharingType().toUpperCase();
            if (type.contains("SINGLE") || type.contains("1")) return 1;
            if (type.contains("DOUBLE") || type.contains("2")) return 2;
            if (type.contains("TRIPLE") || type.contains("3")) return 3;
            if (type.contains("FOUR") || type.contains("4")) return 4;
            if (type.contains("DORM") || type.contains("8")) return 8;
        }
        return 1;
    }

    @Autowired
    private com.stayeaze.backend.services.SubscriptionEnforcementService enforcementService;

    @PostMapping("/rooms/{roomId}/beds")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createBed(@PathVariable UUID roomId, @Valid @RequestBody BedRequest request) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        try {
            Organization org = getLoggedUserOrg();
            enforcementService.validateBedCreation(org, 1);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }

        if (request.getBedNumber() == null || request.getBedNumber().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed Number is required!"));
        }

        if (bedRepository.existsByRoomAndBedNumber(room, request.getBedNumber().trim())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed Number already exists in this room!"));
        }

        int currentBeds = bedRepository.findByRoom(room).size();
        int maxBeds = getMaxBedsForRoom(room);
        if (currentBeds >= maxBeds) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                "Error: This room allows a maximum of " + maxBeds + " bed(s) (" + room.getSharingType() + " sharing). Already has " + currentBeds + "."));
        }

        Bed bed = new Bed(room, request.getBedNumber());
        if (request.getStatus() != null) {
            bed.setStatus(request.getStatus());
        }
        if (request.getQrCode() != null && !request.getQrCode().isEmpty()) {
            if (bedRepository.findByQrCode(request.getQrCode()).isPresent()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: QR Code is already assigned to another bed!"));
            }
            bed.setQrCode(request.getQrCode());
        }

        Bed saved = bedService.saveBed(bed);
        return new ResponseEntity<>(com.stayeaze.backend.payload.response.BedDTO.fromEntity(populateBedDetails(saved)), HttpStatus.CREATED);
    }

    @GetMapping("/rooms/{roomId}/beds")
    @Transactional
    public ResponseEntity<?> getAllBeds(@PathVariable UUID roomId) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Room not found."));
        }

        List<Bed> beds = bedRepository.findByRoomId(roomId);
        if (beds == null || beds.isEmpty()) {
            int max = getMaxBedsForRoom(room);
            List<Bed> newBeds = new java.util.ArrayList<>();
            for (int i = 1; i <= max; i++) {
                String bedNo = "B" + i;
                if (!Boolean.TRUE.equals(bedRepository.existsByRoomAndBedNumber(room, bedNo))) {
                    Bed b = new Bed(room, bedNo);
                    b.setStatus("AVAILABLE");
                    newBeds.add(b);
                }
            }
            if (!newBeds.isEmpty()) {
                try {
                    bedRepository.saveAll(newBeds);
                    floorService.evictCaches();
                } catch (Exception ignored) {}
            }
            beds = bedRepository.findByRoomId(roomId);
        }

        if (beds != null) {
            beds.forEach(this::populateBedDetails);
        } else {
            beds = java.util.Collections.emptyList();
        }

        List<com.stayeaze.backend.payload.response.BedDTO> dtos = beds.stream().map(com.stayeaze.backend.payload.response.BedDTO::fromEntity).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/beds/minimal")
    @Transactional(readOnly = true)
    public ResponseEntity<List<MinimalBedDTO>> getMinimalBeds(
            @RequestParam(required = false) UUID roomId,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();

        List<Bed> beds;
        if (roomId != null) {
            beds = bedRepository.findByRoomId(roomId);
        } else if (organization != null) {
            beds = bedRepository.findByOrganizationId(organization.getId());
        } else {
            beds = bedRepository.findAll();
        }

        List<MinimalBedDTO> dtos = beds.stream()
                .filter(b -> {
                    UUID propId = null;
                    try {
                        if (b.getRoom() != null && b.getRoom().getFloor() != null
                                && b.getRoom().getFloor().getBuilding() != null
                                && b.getRoom().getFloor().getBuilding().getProperty() != null) {
                            propId = b.getRoom().getFloor().getBuilding().getProperty().getId();
                        }
                    } catch (Exception ignored) {}
                    if (assignedProps != null && propId != null && !assignedProps.contains(propId)) {
                        return false;
                    }
                    if (propertyId != null && propId != null && !propertyId.equals(propId)) {
                        return false;
                    }
                    return true;
                })
                .map(MinimalBedDTO::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/beds")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getFlatBeds(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<com.stayeaze.backend.payload.response.BedDTO> all = bedService.getBedsByOrg(organization);
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            all = all.stream().filter(b -> b.getPropertyId() != null && assignedProps.contains(b.getPropertyId())).collect(Collectors.toList());
        }
        if (propertyId != null) {
            all = all.stream().filter(b -> propertyId.equals(b.getPropertyId())).collect(Collectors.toList());
        }
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(all, page, pageSize));
    }

    @PostMapping("/beds")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createFlatBed(@RequestBody BedRequest request) {
        UUID roomId = request.getRoomId();
        if (roomId == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: roomId is required!"));
        }
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null || !isRoomAuthorizedForUser(room)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Room not found or unauthorized"));
        }

        try {
            Organization org = getLoggedUserOrg();
            enforcementService.validateBedCreation(org, 1);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(new MessageResponse(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
        if (request.getFloorId() != null && room.getFloor() != null && !room.getFloor().getId().equals(request.getFloorId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Specified room does not belong to the selected floor!"));
        }
        if (request.getBuildingId() != null && room.getFloor() != null && room.getFloor().getBuilding() != null && !room.getFloor().getBuilding().getId().equals(request.getBuildingId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Specified room/floor does not belong to the selected building!"));
        }
        if (request.getPropertyId() != null && room.getFloor() != null && room.getFloor().getBuilding() != null && room.getFloor().getBuilding().getProperty() != null && !room.getFloor().getBuilding().getProperty().getId().equals(request.getPropertyId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Specified room/building does not belong to the selected property!"));
        }

        String bedNum = request.getBedNumber();
        if (bedNum == null || bedNum.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: bed number is required!"));
        }

        if (bedRepository.existsByRoomAndBedNumber(room, bedNum)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed number already exists in this room!"));
        }

        int currentBeds = bedRepository.findByRoom(room).size();
        int maxBeds = getMaxBedsForRoom(room);
        if (currentBeds >= maxBeds) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                "Error: This room allows a maximum of " + maxBeds + " bed(s) (" + room.getSharingType() + " sharing). Already has " + currentBeds + "."));
        }

        Bed bed = new Bed(room, bedNum);
        if (request.getStatus() != null) bed.setStatus(request.getStatus());
        if (request.getQrCode() != null && !request.getQrCode().isEmpty()) {
            if (bedRepository.findByQrCode(request.getQrCode()).isPresent()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: QR Code is already assigned to another bed!"));
            }
            bed.setQrCode(request.getQrCode());
        }

        Bed saved = bedService.saveBed(bed);
        occupancySyncService.syncStatsForRoom(room);
        return new ResponseEntity<>(com.stayeaze.backend.payload.response.BedDTO.fromEntity(populateBedDetails(saved)), HttpStatus.CREATED);
    }

    @GetMapping("/beds/{id}")
    public ResponseEntity<?> getFlatBedById(@PathVariable UUID id) {
        Bed bed = bedRepository.findById(id).orElse(null);
        if (bed == null || bed.getRoom() == null || !isRoomAuthorizedForUser(bed.getRoom())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found."));
        }
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.BedDTO.fromEntity(populateBedDetails(bed)));
    }

    @PutMapping("/rooms/{roomId}/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateBed(@PathVariable UUID roomId, @PathVariable UUID id, @Valid @RequestBody BedRequest request) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Bed bed = bedRepository.findByIdAndRoom(id, room).orElse(null);
        if (bed == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found in this room."));
        }

        if (!bed.getBedNumber().equals(request.getBedNumber()) && bedRepository.existsByRoomAndBedNumber(room, request.getBedNumber())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed number already exists in this room!"));
        }

        bed.setBedNumber(request.getBedNumber());
        if (request.getStatus() != null) {
            bed.setStatus(request.getStatus());
        }
        if (request.getQrCode() != null) {
            if (!request.getQrCode().equals(bed.getQrCode()) && bedRepository.findByQrCode(request.getQrCode()).isPresent()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: QR Code is already assigned to another bed!"));
            }
            bed.setQrCode(request.getQrCode());
        }

        Bed updated = bedService.saveBed(bed);
        occupancySyncService.syncStatsForRoom(bed.getRoom());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/rooms/{roomId}/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    @Transactional
    public ResponseEntity<?> deleteBed(@PathVariable UUID roomId, @PathVariable UUID id) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Bed bed = bedRepository.findByIdAndRoom(id, room).orElse(null);
        if (bed == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found."));
        }

        bed.setStatus("ARCHIVED");
        bedService.saveBed(bed);
        occupancySyncService.syncStatsForRoom(room);

        return ResponseEntity.ok(new MessageResponse("Bed successfully archived."));
    }

    @PutMapping("/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    @Transactional
    public ResponseEntity<?> updateFlatBed(@PathVariable UUID id, @RequestBody BedRequest request) {
        Bed bed = bedRepository.findById(id).orElse(null);
        if (bed == null || bed.getRoom() == null || !isRoomAuthorizedForUser(bed.getRoom())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found."));
        }

        if (request.getBedNumber() != null && !request.getBedNumber().equals(bed.getBedNumber())) {
            if (bedRepository.existsByRoomAndBedNumber(bed.getRoom(), request.getBedNumber())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed number already exists in this room!"));
            }
            bed.setBedNumber(request.getBedNumber());
        }
        if (request.getStatus() != null) bed.setStatus(request.getStatus());
        if (request.getQrCode() != null) {
            if (!request.getQrCode().equals(bed.getQrCode()) && bedRepository.findByQrCode(request.getQrCode()).isPresent()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: QR Code is already assigned to another bed!"));
            }
            bed.setQrCode(request.getQrCode());
        }

        Bed saved = bedService.saveBed(bed);
        occupancySyncService.syncStatsForRoom(bed.getRoom());
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.BedDTO.fromEntity(populateBedDetails(saved)));
    }

    @DeleteMapping("/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    @Transactional
    public ResponseEntity<?> deleteFlatBed(@PathVariable UUID id) {
        Bed bed = bedRepository.findById(id).orElse(null);
        if (bed == null || bed.getRoom() == null || !isRoomAuthorizedForUser(bed.getRoom())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found."));
        }
        bed.setStatus("ARCHIVED");
        bedService.saveBed(bed);
        occupancySyncService.syncStatsForRoom(bed.getRoom());
        return ResponseEntity.ok(new MessageResponse("Bed deleted successfully."));
    }
}
