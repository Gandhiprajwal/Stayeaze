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
@RequestMapping("/api/v1/check-ins")
public class CheckInController {

    @Autowired
    private CheckInRepository checkInRepository;

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

    @Autowired
    private PropertyRepository propertyRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private void processCheckInCompletion(CheckIn checkIn, Organization organization) {
        java.time.LocalDate effectiveCheckInDate = checkIn.getCheckInDate();
        // If checkInDate is null or in the future when performing early check-in, set to today's date
        if (effectiveCheckInDate == null || effectiveCheckInDate.isAfter(java.time.LocalDate.now())) {
            effectiveCheckInDate = java.time.LocalDate.now();
        }
        checkIn.setCheckInDate(effectiveCheckInDate);

        // 1. Update Tenant status to ACTIVE & sync tenant leaseStart to early checkInDate
        List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
        Tenant tenant = orgTenants.stream().filter(t ->
            (t.getFirstName() + " " + t.getLastName()).equalsIgnoreCase(checkIn.getTenantName()) ||
            (checkIn.getRoomNumber() != null && checkIn.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
             checkIn.getBedNumber() != null && checkIn.getBedNumber().equalsIgnoreCase(t.getBedNumber()))
        ).findFirst().orElse(null);

        if (tenant != null) {
            tenant.setStatus("ACTIVE");
            tenant.setLeaseStart(effectiveCheckInDate.toString());
            tenantRepository.save(tenant);
        }

        // 2. Update all matching organization bookings to CHECKED_IN and sync early checkin date
        List<Booking> allOrgBookings = bookingRepository.findByOrganizationId(organization.getId());
        for (Booking b : allOrgBookings) {
            boolean matches = (checkIn.getBookingId() != null && checkIn.getBookingId().equals(b.getId()))
                    || (tenant != null && b.getTenant() != null && b.getTenant().getId().equals(tenant.getId()))
                    || (tenant != null && b.getTenantEmail() != null && tenant.getEmail() != null && b.getTenantEmail().equalsIgnoreCase(tenant.getEmail()))
                    || (b.getTenantName() != null && checkIn.getTenantName() != null && b.getTenantName().equalsIgnoreCase(checkIn.getTenantName()))
                    || (checkIn.getRoomNumber() != null && checkIn.getRoomNumber().equalsIgnoreCase(b.getRoomNumber()) &&
                        checkIn.getBedNumber() != null && checkIn.getBedNumber().equalsIgnoreCase(b.getBedNumber()));
            if (matches) {
                b.setStatus("CHECKED_IN");
                b.setCheckinDate(effectiveCheckInDate);
                bookingRepository.save(b);
            }
        }

        // 2. Mark Bed OCCUPIED
        if (checkIn.getRoomNumber() != null && checkIn.getBedNumber() != null) {
            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            Room room = orgRooms.stream().filter(r -> checkIn.getRoomNumber().equalsIgnoreCase(r.getRoomNumber())).findFirst().orElse(null);
            if (room != null) {
                List<Bed> rBeds = bedRepository.findByRoom(room);
                Bed bed = rBeds.stream().filter(b -> checkIn.getBedNumber().equalsIgnoreCase(b.getBedNumber())).findFirst().orElse(null);
                if (bed != null) {
                    bed.setStatus("OCCUPIED");
                    if (tenant != null) {
                        bed.setTenantId(tenant.getId().toString());
                        bed.setTenantName(tenant.getFirstName() + " " + tenant.getLastName());
                    }
                    bedRepository.save(bed);
                }
            }
        }
    }

    @GetMapping
    @Transactional
    public ResponseEntity<?> getAllCheckIns() {
        Organization organization = getLoggedUserOrg();
        List<CheckIn> checkIns = checkInRepository.findAll().stream()
                .filter(c -> c.getOrganization() != null && c.getOrganization().getId().equals(organization.getId()))
                .collect(java.util.stream.Collectors.toList());

        try {
            List<Booking> activeBookings = bookingRepository.findByOrganizationId(organization.getId());
            for (Booking b : activeBookings) {
                boolean isPendingCheckIn = b.getStatus() == null || "CONFIRMED".equalsIgnoreCase(b.getStatus()) || "PENDING".equalsIgnoreCase(b.getStatus());
                if (isPendingCheckIn) {
                    boolean exists = checkIns.stream().anyMatch(c -> b.getId().equals(c.getBookingId()) 
                        || (b.getTenantName() != null && b.getTenantName().equalsIgnoreCase(c.getTenantName()))
                        || (b.getTenant() != null && (b.getTenant().getFirstName() + " " + b.getTenant().getLastName()).equalsIgnoreCase(c.getTenantName())));
                    if (!exists) {
                        CheckIn newCheckIn = new CheckIn();
                        newCheckIn.setOrganization(organization);
                        newCheckIn.setCode(b.getBookingCode() != null ? "CI-" + b.getBookingCode() : "CI-B" + String.valueOf(System.currentTimeMillis()).substring(8));
                        newCheckIn.setBookingId(b.getId());
                        String name = b.getTenantName();
                        if (name == null && b.getTenant() != null) name = b.getTenant().getName();
                        if (name == null || name.isBlank()) name = "Guest";
                        newCheckIn.setTenantName(name);

                        UUID propId = b.getPropertyId();
                        if (propId == null && b.getTenant() != null) propId = b.getTenant().getPropertyId();
                        if (propId == null) {
                            List<Property> props = propertyRepository.findByOrganization(organization);
                            if (props != null && !props.isEmpty()) propId = props.get(0).getId();
                        }
                        if (propId != null) {
                            newCheckIn.setPropertyId(propId);

                            String rNum = b.getRoomNumber();
                            try {
                                if (rNum == null && b.getBed() != null && b.getBed().getRoom() != null) rNum = b.getBed().getRoom().getRoomNumber();
                            } catch (Exception ignored) {}
                            if (rNum == null && b.getTenant() != null) rNum = b.getTenant().getRoomNumber();
                            newCheckIn.setRoomNumber(rNum != null ? rNum : "101");

                            String bNum = b.getBedNumber();
                            try {
                                if (bNum == null && b.getBed() != null) bNum = b.getBed().getBedNumber();
                            } catch (Exception ignored) {}
                            if (bNum == null && b.getTenant() != null) bNum = b.getTenant().getBedNumber();
                            newCheckIn.setBedNumber(bNum != null ? bNum : "B1");

                            newCheckIn.setCheckInDate(b.getCheckinDate() != null ? b.getCheckinDate() : java.time.LocalDate.now());
                            if (b.getCheckoutDate() != null) {
                                newCheckIn.setLeaseEnd(b.getCheckoutDate());
                            }

                            newCheckIn.setRent(b.getRentAgreed() != null ? b.getRentAgreed() : java.math.BigDecimal.valueOf(8000));
                            newCheckIn.setDepositPaid(b.getDepositAgreed() != null ? b.getDepositAgreed() : java.math.BigDecimal.valueOf(16000));
                            newCheckIn.setStatus("pending");
                            newCheckIn.setIdVerified(false);

                            CheckIn saved = checkInRepository.save(newCheckIn);
                            checkIns.add(saved);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return ResponseEntity.ok(checkIns);
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createCheckIn(@Valid @RequestBody CheckIn request) {
        Organization organization = getLoggedUserOrg();
        request.setOrganization(organization);

        if (request.getCode() == null || request.getCode().isEmpty()) {
            request.setCode("CI-" + String.valueOf(System.currentTimeMillis()).substring(8));
        }

        if ("completed".equalsIgnoreCase(request.getStatus())) {
            processCheckInCompletion(request, organization);
        }

        CheckIn saved = checkInRepository.save(request);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateCheckIn(@PathVariable UUID id, @Valid @RequestBody CheckIn request) {
        Organization organization = getLoggedUserOrg();
        CheckIn checkIn = checkInRepository.findById(id).orElse(null);
        if (checkIn == null || !checkIn.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-in record not found."));
        }

        checkIn.setTenantName(request.getTenantName());
        checkIn.setPropertyId(request.getPropertyId());
        checkIn.setRoomNumber(request.getRoomNumber());
        checkIn.setBedNumber(request.getBedNumber());
        checkIn.setCheckInDate(request.getCheckInDate());
        checkIn.setLeaseEnd(request.getLeaseEnd());
        checkIn.setRent(request.getRent());
        checkIn.setDepositPaid(request.getDepositPaid());
        checkIn.setIdVerified(request.getIdVerified());
        checkIn.setStatus(request.getStatus());

        if ("completed".equalsIgnoreCase(request.getStatus())) {
            processCheckInCompletion(checkIn, organization);
        }

        CheckIn updated = checkInRepository.save(checkIn);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/mark-completed")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> markCheckInCompleted(@PathVariable UUID id, @RequestBody(required = false) CheckIn requestPayload) {
        Organization organization = getLoggedUserOrg();
        CheckIn checkIn = checkInRepository.findById(id).orElse(null);
        if (checkIn == null || !checkIn.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-in record not found."));
        }

        if (requestPayload != null && requestPayload.getCheckInDate() != null) {
            checkIn.setCheckInDate(requestPayload.getCheckInDate());
        }

        checkIn.setStatus("completed");
        processCheckInCompletion(checkIn, organization);
        CheckIn updated = checkInRepository.save(checkIn);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> deleteCheckIn(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        CheckIn checkIn = checkInRepository.findById(id).orElse(null);
        if (checkIn == null || !checkIn.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-in record not found."));
        }

        checkInRepository.delete(checkIn);
        return ResponseEntity.ok(new MessageResponse("Check-in record successfully deleted."));
    }
}
