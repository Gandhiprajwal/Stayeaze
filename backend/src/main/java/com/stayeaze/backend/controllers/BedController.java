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
            List<Tenant> activeTenants = tenantRepository.findByOrganization(org);
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

            // Check bookings for reserved bed
            List<Booking> activeBookings = bookingRepository.findByOrganizationId(org.getId());
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
        } catch (Exception ignored) {}
        return bed;
    }

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        if (userDetails.getOrgId() == null) return null;
        return organizationRepository.findById(userDetails.getOrgId()).orElse(null);
    }

    private Room getAuthorizedRoom(UUID roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found or unauthorized"));
    }

    private int getMaxBedsForRoom(Room room) {
        if (room.getSharingType() == null) return 1;
        return switch (room.getSharingType().toUpperCase()) {
            case "SINGLE" -> 1;
            case "DOUBLE" -> 2;
            case "TRIPLE" -> 3;
            case "FOUR_SHARING" -> 4;
            case "DORMITORY" -> 8;
            default -> 1;
        };
    }

    @PostMapping("/rooms/{roomId}/beds")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createBed(@PathVariable UUID roomId, @Valid @RequestBody BedRequest request) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        if (bedRepository.existsByRoomAndBedNumber(room, request.getBedNumber())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed number already exists in this room!"));
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
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAllBeds(@PathVariable UUID roomId) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<Bed> beds = bedRepository.findByRoom(room);
        beds.forEach(this::populateBedDetails);
        return ResponseEntity.ok(beds);
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
