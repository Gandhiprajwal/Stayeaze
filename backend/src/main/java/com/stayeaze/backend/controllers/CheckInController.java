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

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

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
            (t.getFirstName() + " " + t.getLastName()).trim().equalsIgnoreCase(checkIn.getTenantName().trim()) ||
            (t.getName() != null && t.getName().trim().equalsIgnoreCase(checkIn.getTenantName().trim())) ||
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

        // 3. Mark Bed OCCUPIED
        Room matchedRoom = null;
        if (checkIn.getRoomNumber() != null && checkIn.getBedNumber() != null) {
            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            matchedRoom = orgRooms.stream().filter(r -> checkIn.getRoomNumber().equalsIgnoreCase(r.getRoomNumber())).findFirst().orElse(null);
            if (matchedRoom != null) {
                List<Bed> rBeds = bedRepository.findByRoom(matchedRoom);
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

        occupancySyncService.syncStatsForRoom(matchedRoom);
    }

    @GetMapping
    public ResponseEntity<?> getAllCheckIns(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = getLoggedUserOrg();
        List<CheckIn> checkIns = checkInRepository.findAll().stream()
                .filter(c -> c.getOrganization() != null && c.getOrganization().getId().equals(organization.getId()))
                .collect(java.util.stream.Collectors.toList());

        try {
            List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);

            // If a tenant is already checked-in (ACTIVE, CHECKED_IN, COMPLETED), sync existing CheckIn record status to completed
            for (CheckIn c : checkIns) {
                if ("pending".equalsIgnoreCase(c.getStatus())) {
                    boolean tenantCheckedIn = orgTenants.stream().anyMatch(t -> {
                        String ts = t.getStatus();
                        boolean isCheckedIn = ts != null && ("ACTIVE".equalsIgnoreCase(ts) || "CHECKED_IN".equalsIgnoreCase(ts) || "COMPLETED".equalsIgnoreCase(ts));
                        if (!isCheckedIn) return false;
                        String fullName = ((t.getFirstName() != null ? t.getFirstName() : "") + " " + (t.getLastName() != null ? t.getLastName() : "")).trim();
                        return (c.getTenantName() != null && c.getTenantName().equalsIgnoreCase(fullName)) ||
                               (t.getRoomNumber() != null && !t.getRoomNumber().isBlank() && t.getRoomNumber().equalsIgnoreCase(c.getRoomNumber()) &&
                                t.getBedNumber() != null && !t.getBedNumber().isBlank() && t.getBedNumber().equalsIgnoreCase(c.getBedNumber()));
                    });
                    if (tenantCheckedIn) {
                        c.setStatus("completed");
                        checkInRepository.save(c);
                    }
                }
            }

            // Auto-discover pending tenants (PENDING_CHECKIN status) — add VIRTUAL (unsaved) entries for display
            for (Tenant t : orgTenants) {
                String tStat = t.getStatus();
                boolean isPendingTenant = tStat != null && (
                    "PENDING_CHECKIN".equalsIgnoreCase(tStat) ||
                    "PENDING".equalsIgnoreCase(tStat) ||
                    "RESERVED".equalsIgnoreCase(tStat) ||
                    "CHECKIN_PENDING".equalsIgnoreCase(tStat)
                );
                if (!isPendingTenant) continue;

                String fullName = ((t.getFirstName() != null ? t.getFirstName() : "") + " " + (t.getLastName() != null ? t.getLastName() : "")).trim();
                if (fullName.isBlank()) fullName = t.getName() != null ? t.getName() : "Tenant";

                final String finalFullName = fullName;
                final Tenant finalTenant = t;

                // Skip if real check-in already exists for this tenant
                boolean exists = checkIns.stream().anyMatch(c ->
                    (c.getTenantName() != null && c.getTenantName().equalsIgnoreCase(finalFullName)) ||
                    (finalTenant.getRoomNumber() != null && !finalTenant.getRoomNumber().isBlank() &&
                     finalTenant.getRoomNumber().equalsIgnoreCase(c.getRoomNumber()) &&
                     finalTenant.getBedNumber() != null && !finalTenant.getBedNumber().isBlank() &&
                     finalTenant.getBedNumber().equalsIgnoreCase(c.getBedNumber()))
                );
                if (exists) continue;

                UUID propId = t.getPropertyId();
                if (propId == null) {
                    List<Property> props = propertyRepository.findByOrganization(organization);
                    if (props != null && !props.isEmpty()) propId = props.get(0).getId();
                }
                if (propId == null) continue;

                // Build a VIRTUAL (unsaved) check-in for display only
                CheckIn virtual = new CheckIn();
                virtual.setId(UUID.randomUUID());
                virtual.setOrganization(organization);
                virtual.setCode("CI-T" + String.valueOf(System.currentTimeMillis() % 100000000L));
                virtual.setTenantName(fullName);
                virtual.setPropertyId(propId);
                virtual.setRoomNumber(t.getRoomNumber() != null ? t.getRoomNumber() : "");
                virtual.setBedNumber(t.getBedNumber() != null ? t.getBedNumber() : "");

                if (t.getLeaseStart() != null && !t.getLeaseStart().isBlank()) {
                    try { virtual.setCheckInDate(java.time.LocalDate.parse(t.getLeaseStart())); }
                    catch (Exception ignored) { virtual.setCheckInDate(java.time.LocalDate.now()); }
                } else {
                    virtual.setCheckInDate(java.time.LocalDate.now());
                }
                if (t.getLeaseEnd() != null && !t.getLeaseEnd().isBlank()) {
                    try { virtual.setLeaseEnd(java.time.LocalDate.parse(t.getLeaseEnd())); }
                    catch (Exception ignored) {}
                }

                virtual.setRent(t.getRent() != null ? t.getRent() : java.math.BigDecimal.valueOf(8000));
                virtual.setDepositPaid(t.getDeposit() != null ? t.getDeposit() : java.math.BigDecimal.valueOf(16000));
                virtual.setStatus("pending");
                virtual.setIdVerified("VERIFIED".equalsIgnoreCase(t.getKycStatus()));
                checkIns.add(virtual); // NOT saved to DB
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(checkIns, page, pageSize));
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

        if (checkIn.getStatus() != null && ("completed".equalsIgnoreCase(checkIn.getStatus()) || "checked_in".equalsIgnoreCase(checkIn.getStatus()) || "active".equalsIgnoreCase(checkIn.getStatus()))) {
            return ResponseEntity.badRequest().body(new MessageResponse("Check-in is already completed."));
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
