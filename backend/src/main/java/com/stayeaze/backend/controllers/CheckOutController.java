package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/check-outs")
public class CheckOutController {

    @Autowired
    private CheckOutRepository checkOutRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private BookingRepository bookingRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    private void processCheckOutCompletion(CheckOut checkOut, Organization organization) {
        // 1. Find matching Tenant and archive (do NOT delete!)
        List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
        Tenant tenant = orgTenants.stream().filter(t ->
            (t.getFirstName() + " " + t.getLastName()).equalsIgnoreCase(checkOut.getTenantName()) ||
            (checkOut.getRoomNumber() != null && checkOut.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
             checkOut.getBedNumber() != null && checkOut.getBedNumber().equalsIgnoreCase(t.getBedNumber()))
        ).findFirst().orElse(null);

        if (tenant != null) {
            tenant.setStatus("ARCHIVED");
            if (checkOut.getCheckOutDate() != null) {
                tenant.setLeaseEnd(checkOut.getCheckOutDate().toString());
            }
            tenant.setRoomNumber(null);
            tenant.setBedNumber(null);
            tenantRepository.save(tenant);

            // Sync associated booking status if present
            try {
                List<Booking> tenantBookings = bookingRepository.findByTenant(tenant);
                for (Booking b : tenantBookings) {
                    if ("CONFIRMED".equalsIgnoreCase(b.getStatus()) || "CHECKED_IN".equalsIgnoreCase(b.getStatus()) || "PENDING".equalsIgnoreCase(b.getStatus())) {
                        b.setStatus("CHECKED_OUT");
                        b.setCheckoutDate(checkOut.getCheckOutDate() != null ? checkOut.getCheckOutDate() : java.time.LocalDate.now());
                        bookingRepository.save(b);
                    }
                }
            } catch (Exception ignored) {}
        }

        // 2. Release Bed back to AVAILABLE
        Room matchedRoom = null;
        if (checkOut.getRoomNumber() != null && checkOut.getBedNumber() != null) {
            try {
                List<Bed> orgBeds = bedRepository.findByOrganizationId(organization.getId());
                Bed bed = orgBeds.stream().filter(b ->
                    checkOut.getBedNumber().equalsIgnoreCase(b.getBedNumber()) &&
                    b.getRoom() != null &&
                    checkOut.getRoomNumber().equalsIgnoreCase(b.getRoom().getRoomNumber())
                ).findFirst().orElse(null);

                if (bed != null) {
                    bed.setStatus("AVAILABLE");
                    bed.setTenantId(null);
                    bed.setTenantName(null);
                    bedRepository.save(bed);
                    matchedRoom = bed.getRoom();
                }
            } catch (Exception ignored) {}
        }

        if (matchedRoom != null) {
            occupancySyncService.syncStatsForRoom(matchedRoom);
        }
        occupancySyncService.syncAllStatsForOrg(organization);
    }

    @GetMapping
    public ResponseEntity<?> getAllCheckOuts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = getLoggedUserOrg();
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));
        org.springframework.data.domain.Page<CheckOut> pageResult = checkOutRepository.findByOrganizationId(organization.getId(), pageable);
        org.springframework.data.domain.Page<com.stayeaze.backend.payload.response.CheckOutDTO> dtoPage =
                pageResult.map(com.stayeaze.backend.payload.response.CheckOutDTO::fromEntity);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.ofPage(dtoPage));
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createCheckOut(@Valid @RequestBody CheckOut request) {
        Organization organization = getLoggedUserOrg();
        request.setOrganization(organization);

        if (request.getPropertyId() == null) {
            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            if (orgRooms != null && !orgRooms.isEmpty() && orgRooms.get(0).getFloor() != null && orgRooms.get(0).getFloor().getBuilding() != null) {
                request.setPropertyId(orgRooms.get(0).getFloor().getBuilding().getId());
            } else {
                request.setPropertyId(organization.getId());
            }
        }

        if (request.getCode() == null || request.getCode().isEmpty()) {
            request.setCode("CO-" + String.valueOf(System.currentTimeMillis()).substring(8));
        }

        if ("completed".equalsIgnoreCase(request.getStatus())) {
            processCheckOutCompletion(request, organization);
        }

        CheckOut saved = checkOutRepository.save(request);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateCheckOut(@PathVariable UUID id, @Valid @RequestBody CheckOut request) {
        return ResponseEntity.badRequest().body(new MessageResponse("Check-out records are immutable and cannot be edited."));
    }

    @PostMapping("/{id}/mark-completed")
    @Transactional
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> markCheckOutCompleted(@PathVariable UUID id, @RequestBody(required = false) CheckOut payload) {
        try {
            Organization organization = getLoggedUserOrg();
            CheckOut checkOut = checkOutRepository.findById(id).orElse(null);
            if (checkOut == null || !checkOut.getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-out record not found."));
            }

            if ("completed".equalsIgnoreCase(checkOut.getStatus())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Check-out is already completed."));
            }

            if (payload != null) {
                if (payload.getCheckOutDate() != null) checkOut.setCheckOutDate(payload.getCheckOutDate());
                if (payload.getDepositRefund() != null) checkOut.setDepositRefund(payload.getDepositRefund());
                if (payload.getDeductions() != null) checkOut.setDeductions(payload.getDeductions());
                if (payload.getReason() != null) checkOut.setReason(payload.getReason());
            }

            checkOut.setStatus("completed");
            processCheckOutCompletion(checkOut, organization);
            CheckOut updated = checkOutRepository.save(checkOut);
            return ResponseEntity.ok(updated);
        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new MessageResponse("Check-out completion error: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> deleteCheckOut(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        CheckOut checkOut = checkOutRepository.findById(id).orElse(null);
        if (checkOut == null || !checkOut.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-out record not found."));
        }

        checkOutRepository.delete(checkOut);
        return ResponseEntity.ok(new MessageResponse("Check-out record successfully deleted."));
    }
}
