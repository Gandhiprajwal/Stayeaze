package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.BedRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.repository.OrganizationRepository;
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
import java.util.stream.Collectors;

import com.stayeaze.backend.models.Booking;
import com.stayeaze.backend.repository.BookingRepository;
import org.springframework.transaction.annotation.Transactional;

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
    private TenantRepository tenantRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private com.stayeaze.backend.services.BedService bedService;

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private com.stayeaze.backend.services.FloorService floorService;

    @Transactional(readOnly = true)
    public Bed populateBedDetails(Bed bed) {
        if (bed == null) return bed;
        String roomNum = null;
        try {
            if (bed.getRoom() != null) {
                roomNum = bed.getRoom().getRoomNumber();
            }
        } catch (Exception ignored) {}

        try {
            Organization org = getLoggedUserOrg();
            List<Tenant> activeTenants = org != null ? tenantRepository.findByOrganization(org) : tenantRepository.findAll();
            if (activeTenants != null) {
                for (Tenant t : activeTenants) {
                    boolean statusOk = t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()) || "NOTICE_PERIOD".equalsIgnoreCase(t.getStatus());
                    if (statusOk) {
                        boolean roomMatch = roomNum != null && roomNum.equalsIgnoreCase(t.getRoomNumber());
                        boolean bedMatch = bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(t.getBedNumber());
                        if (roomMatch && bedMatch) {
                            bed.setStatus("OCCUPIED");
                            bed.setTenantId(t.getId().toString());
                            bed.setTenantName(t.getName());
                            return bed;
                        }
                    }
                }
            }

            // Check bookings for reserved bed
            List<Booking> activeBookings = org != null ? bookingRepository.findByOrganizationId(org.getId()) : bookingRepository.findAll();
            if (activeBookings != null) {
                for (Booking b : activeBookings) {
                    boolean statusOk = b.getStatus() == null || "CONFIRMED".equalsIgnoreCase(b.getStatus()) || "CHECKED_IN".equalsIgnoreCase(b.getStatus()) || "PENDING".equalsIgnoreCase(b.getStatus());
                    if (statusOk) {
                        boolean roomMatch = roomNum != null && roomNum.equalsIgnoreCase(b.getRoomNumber());
                        boolean bedMatch = bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(b.getBedNumber());
                        boolean directBedMatch = b.getBed() != null && b.getBed().getId().equals(bed.getId());
                        if (directBedMatch || (roomMatch && bedMatch)) {
                            if ("CHECKED_IN".equalsIgnoreCase(b.getStatus())) {
                                bed.setStatus("OCCUPIED");
                            } else {
                                bed.setStatus("RESERVED");
                            }
                            if (b.getTenant() != null) {
                                bed.setTenantId(b.getTenant().getId().toString());
                                bed.setTenantName(b.getTenant().getName());
                            } else if (b.getTenantName() != null) {
                                bed.setTenantName(b.getTenantName());
                            }
                            return bed;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return bed;
    }

    private Organization getLoggedUserOrg() {
        try {
            UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                    .getAuthentication().getPrincipal();
            if (userDetails.getOrgId() == null) return null;
            return organizationRepository.findById(userDetails.getOrgId()).orElse(null);
        } catch (Exception ignored) {
            return null;
        }
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

        Bed saved = bedRepository.save(bed);
        return new ResponseEntity<>(populateBedDetails(saved), HttpStatus.CREATED);
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

    @GetMapping("/beds")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getFlatBeds(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = null;
        try { organization = getLoggedUserOrg(); } catch (Exception ignored) {}
        List<com.stayeaze.backend.payload.response.BedDTO> all = bedService.getBedsByOrg(organization);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(all, page, pageSize));
    }

    @PostMapping("/beds")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createFlatBed(@RequestBody BedRequest request) {
        UUID roomId = request.getRoomId();
        if (roomId == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: roomId is required!"));
        }
        Organization organization = getLoggedUserOrg();
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null || !room.getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Room not found or unauthorized"));
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

        Bed saved = bedRepository.save(bed);
        occupancySyncService.syncStatsForRoom(room);
        return new ResponseEntity<>(populateBedDetails(saved), HttpStatus.CREATED);
    }

    @GetMapping("/beds/{id}")
    public ResponseEntity<?> getFlatBedById(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Bed bed = bedRepository.findById(id).orElse(null);
        if (bed == null || !bed.getRoom().getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found."));
        }
        return ResponseEntity.ok(populateBedDetails(bed));
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

        Bed updated = bedRepository.save(bed);
        occupancySyncService.syncStatsForRoom(bed.getRoom());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/rooms/{roomId}/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
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
        bedRepository.save(bed);
        occupancySyncService.syncStatsForRoom(room);

        return ResponseEntity.ok(new MessageResponse("Bed successfully archived."));
    }

    @PutMapping("/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateFlatBed(@PathVariable UUID id, @RequestBody BedRequest request) {
        Organization organization = getLoggedUserOrg();
        Bed bed = bedRepository.findById(id).orElse(null);
        if (bed == null || !bed.getRoom().getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
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

        Bed saved = bedRepository.save(bed);
        occupancySyncService.syncStatsForRoom(bed.getRoom());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/beds/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteFlatBed(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Bed bed = bedRepository.findById(id).orElse(null);
        if (bed == null || !bed.getRoom().getFloor().getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Bed not found."));
        }
        bed.setStatus("ARCHIVED");
        bedRepository.save(bed);
        occupancySyncService.syncStatsForRoom(bed.getRoom());
        return ResponseEntity.ok(new MessageResponse("Bed deleted successfully."));
    }
}
