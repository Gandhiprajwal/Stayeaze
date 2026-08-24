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

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
        if (userDetails != null && userDetails.getOrgId() != null) {
            return organizationRepository.findById(userDetails.getOrgId())
                    .orElseGet(() -> organizationRepository.findAll().stream().findFirst().orElse(null));
        }
        return organizationRepository.findAll().stream().findFirst()
                .orElse(null);
    }

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private com.stayeaze.backend.services.InvoiceService invoiceService;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private InvoiceRepository invoiceRepository;

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

        // 4. Automatically generate Check-In Tax Invoice only if no paid move-in invoice already exists
        try {
            List<Invoice> existingInvoices = tenant != null ? invoiceRepository.findByTenant(tenant) : java.util.Collections.emptyList();
            boolean alreadyPaid = existingInvoices.stream().anyMatch(inv -> "PAID".equalsIgnoreCase(inv.getStatus()));
            if (!alreadyPaid) {
                invoiceService.createCheckInInvoice(checkIn, tenant, checkIn.getPaymentMethod(), checkIn.getRazorpayPaymentId());
            }
        } catch (Exception invEx) {
            invEx.printStackTrace();
        }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAllCheckIns(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = getLoggedUserOrg();
        if (organization == null) {
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(new java.util.ArrayList<>(), page, pageSize));
        }

        List<CheckIn> rawCheckIns = checkInRepository.findAll().stream()
                .filter(c -> c.getOrganization() != null && c.getOrganization().getId().equals(organization.getId()))
                .collect(java.util.stream.Collectors.toList());

        List<CheckIn> checkIns = new java.util.ArrayList<>();

        try {
            List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
            List<Booking> orgBookings = bookingRepository.findByOrganizationId(organization.getId());

            java.util.Map<UUID, Booking> bookingByIdMap = new java.util.HashMap<>();
            if (orgBookings != null) {
                for (Booking b : orgBookings) {
                    if (b != null && b.getId() != null) {
                        bookingByIdMap.put(b.getId(), b);
                    }
                }
            }

            for (CheckIn c : rawCheckIns) {
                if (c == null) continue;
                // Find matching booking
                Booking linkedBooking = null;
                if (c.getBookingId() != null) {
                    linkedBooking = bookingByIdMap.get(c.getBookingId());
                }
                if (linkedBooking == null && c.getTenantName() != null && orgBookings != null) {
                    linkedBooking = orgBookings.stream()
                            .filter(b -> b != null && b.getTenantName() != null && b.getTenantName().equalsIgnoreCase(c.getTenantName()))
                            .findFirst().orElse(null);
                }

                // If booking status is CANCELLED or EXPIRED, EXCLUDE from check-in page
                if (linkedBooking != null && linkedBooking.getStatus() != null) {
                    String bStat = linkedBooking.getStatus().toUpperCase();
                    if ("CANCELLED".equals(bStat) || "EXPIRED".equals(bStat)) {
                        continue; // Do not display cancelled or expired bookings in check-in page
                    }
                }

                // Sync status in memory
                if (linkedBooking != null && linkedBooking.getStatus() != null) {
                    String bStat = linkedBooking.getStatus().toUpperCase();
                    if ("PENDING".equals(bStat) || "CONFIRMED".equals(bStat)) {
                        c.setStatus("pending");
                    } else if ("CHECKED_IN".equals(bStat) || "COMPLETED".equals(bStat)) {
                        c.setStatus("completed");
                    }
                } else if ("pending".equalsIgnoreCase(c.getStatus()) && orgTenants != null) {
                    // Check if tenant is explicitly active
                    boolean tenantActive = orgTenants.stream().anyMatch(t -> {
                        if (t == null) return false;
                        String ts = t.getStatus();
                        if (ts == null || !"ACTIVE".equalsIgnoreCase(ts)) return false;
                        String fullName = ((t.getFirstName() != null ? t.getFirstName() : "") + " " + (t.getLastName() != null ? t.getLastName() : "")).trim();
                        return (c.getTenantName() != null && c.getTenantName().equalsIgnoreCase(fullName));
                    });
                    if (tenantActive) {
                        c.setStatus("completed");
                    }
                }

                if (linkedBooking != null) {
                    if (linkedBooking.getAdvanceAmount() != null) {
                        c.setAdvanceAmount(linkedBooking.getAdvanceAmount());
                    }
                    if (c.getTenantEmail() == null || c.getTenantEmail().isBlank()) {
                        String bEmail = linkedBooking.getTenantEmail();
                        if (bEmail == null && linkedBooking.getTenant() != null) bEmail = linkedBooking.getTenant().getEmail();
                        c.setTenantEmail(bEmail);
                    }
                    if (c.getTenantPhone() == null || c.getTenantPhone().isBlank()) {
                        String bPhone = linkedBooking.getTenantPhone();
                        if (bPhone == null && linkedBooking.getTenant() != null) bPhone = linkedBooking.getTenant().getMobile();
                        c.setTenantPhone(bPhone);
                    }
                }

                checkIns.add(c);
            }

            // Auto-discover tenants (READY_FOR_CHECKIN / PENDING_CHECKIN / ACTIVE) — add VIRTUAL (unsaved) entries for display
            if (orgTenants != null) {
                for (Tenant t : orgTenants) {
                    if (t == null) continue;
                    String tStat = t.getStatus();
                    if (tStat == null || "CHECKED_OUT".equalsIgnoreCase(tStat) || "ARCHIVED".equalsIgnoreCase(tStat) || "BLACKLISTED".equalsIgnoreCase(tStat)) {
                        continue;
                    }

                    boolean isPending = "READY_FOR_CHECKIN".equalsIgnoreCase(tStat) ||
                                        "PENDING_CHECKIN".equalsIgnoreCase(tStat) ||
                                        "PENDING".equalsIgnoreCase(tStat) ||
                                        "RESERVED".equalsIgnoreCase(tStat) ||
                                        "CHECKIN_PENDING".equalsIgnoreCase(tStat);

                    boolean isActive = "ACTIVE".equalsIgnoreCase(tStat) || "CHECKED_IN".equalsIgnoreCase(tStat);

                    if (!isPending && !isActive) continue;

                    String fullName = ((t.getFirstName() != null ? t.getFirstName() : "") + " " + (t.getLastName() != null ? t.getLastName() : "")).trim();
                    if (fullName.isBlank()) fullName = t.getName() != null ? t.getName() : "Tenant";

                    final String finalFullName = fullName;
                    final Tenant finalTenant = t;

                    // Check matching booking for CANCELLED or EXPIRED
                    Booking tenantBooking = (orgBookings != null) ? orgBookings.stream()
                            .filter(b -> b != null && ((b.getTenant() != null && b.getTenant().getId().equals(finalTenant.getId())) ||
                                         (b.getTenantName() != null && b.getTenantName().equalsIgnoreCase(finalFullName))))
                            .findFirst().orElse(null) : null;

                    if (tenantBooking != null && tenantBooking.getStatus() != null) {
                        String tbStat = tenantBooking.getStatus().toUpperCase();
                        if ("CANCELLED".equals(tbStat) || "EXPIRED".equals(tbStat)) {
                            continue; // Exclude cancelled/expired from check-in page
                        }
                    }

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

                    // Build a VIRTUAL (unsaved) check-in for display
                    CheckIn virtual = new CheckIn();
                    virtual.setId(UUID.randomUUID());
                    virtual.setOrganization(organization);
                    virtual.setCode("CI-T" + String.valueOf(System.currentTimeMillis() % 100000000L));
                    virtual.setTenantName(fullName);
                    virtual.setPropertyId(propId);
                    virtual.setRoomNumber(t.getRoomNumber() != null ? t.getRoomNumber() : "");
                    virtual.setBedNumber(t.getBedNumber() != null ? t.getBedNumber() : "");

                    String vEmail = t.getEmail();
                    if ((vEmail == null || vEmail.isBlank()) && tenantBooking != null) {
                        vEmail = tenantBooking.getTenantEmail();
                        if (vEmail == null && tenantBooking.getTenant() != null) vEmail = tenantBooking.getTenant().getEmail();
                    }
                    String vPhone = t.getMobile();
                    if ((vPhone == null || vPhone.isBlank()) && tenantBooking != null) {
                        vPhone = tenantBooking.getTenantPhone();
                        if (vPhone == null && tenantBooking.getTenant() != null) vPhone = tenantBooking.getTenant().getMobile();
                    }
                    virtual.setTenantEmail(vEmail);
                    virtual.setTenantPhone(vPhone);

                    if (tenantBooking != null) {
                        virtual.setBookingId(tenantBooking.getId());
                        if (tenantBooking.getAdvanceAmount() != null) {
                            virtual.setAdvanceAmount(tenantBooking.getAdvanceAmount());
                        }
                    }

                    // Discover paid invoices for this tenant
                    try {
                        List<Invoice> tInvoices = invoiceRepository.findByTenant(t);
                        BigDecimal totalPaid = tInvoices.stream()
                                .filter(inv -> "PAID".equalsIgnoreCase(inv.getStatus()))
                                .map(inv -> inv.getAmountPaid() != null ? inv.getAmountPaid() : inv.getAmountDue())
                                .filter(java.util.Objects::nonNull)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                        if (totalPaid.compareTo(BigDecimal.ZERO) > 0) {
                            if (virtual.getAdvanceAmount() == null || totalPaid.compareTo(virtual.getAdvanceAmount()) > 0) {
                                virtual.setAdvanceAmount(totalPaid);
                            }
                            Invoice paidInv = tInvoices.stream().filter(inv -> "PAID".equalsIgnoreCase(inv.getStatus())).findFirst().orElse(null);
                            if (paidInv != null) {
                                virtual.setPaymentMethod(paidInv.getPaymentMethod());
                                virtual.setRazorpayPaymentId(paidInv.getRazorpayPaymentId());
                            }
                        }
                    } catch (Exception ignored) {}

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
                    virtual.setStatus(isActive ? "completed" : "pending");
                    virtual.setIdVerified("VERIFIED".equalsIgnoreCase(t.getKycStatus()));
                    checkIns.add(virtual);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        List<com.stayeaze.backend.payload.response.CheckInDTO> dtoList = checkIns.stream()
                .map(com.stayeaze.backend.payload.response.CheckInDTO::fromEntity)
                .collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(dtoList, page, pageSize));
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
            // Check if this is a virtual check-in for a tenant registered in the system
            List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
            Tenant matchingTenant = null;
            if (id != null) {
                matchingTenant = orgTenants.stream().filter(t -> id.equals(t.getId())).findFirst().orElse(null);
            }
            if (matchingTenant == null && requestPayload != null && requestPayload.getTenantName() != null) {
                String targetName = requestPayload.getTenantName().trim().toLowerCase();
                matchingTenant = orgTenants.stream().filter(t -> {
                    String fullName = ((t.getFirstName() != null ? t.getFirstName() : "") + " " + (t.getLastName() != null ? t.getLastName() : "")).trim().toLowerCase();
                    String tName = t.getName() != null ? t.getName().trim().toLowerCase() : "";
                    return fullName.equals(targetName) || tName.equals(targetName);
                }).findFirst().orElse(null);
            }
            if (matchingTenant == null && requestPayload != null && requestPayload.getRoomNumber() != null && requestPayload.getBedNumber() != null) {
                matchingTenant = orgTenants.stream().filter(t ->
                    requestPayload.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                    requestPayload.getBedNumber().equalsIgnoreCase(t.getBedNumber())
                ).findFirst().orElse(null);
            }

            if (matchingTenant != null) {
                checkIn = new CheckIn();
                checkIn.setOrganization(organization);
                checkIn.setCode("CI-" + String.valueOf(System.currentTimeMillis()).substring(7));
                String resolvedName = ((matchingTenant.getFirstName() != null ? matchingTenant.getFirstName() : "") + " " + (matchingTenant.getLastName() != null ? matchingTenant.getLastName() : "")).trim();
                if (resolvedName.isBlank()) resolvedName = matchingTenant.getName() != null ? matchingTenant.getName() : "Tenant";
                checkIn.setTenantName(resolvedName);
                checkIn.setPropertyId(matchingTenant.getPropertyId());
                checkIn.setRoomNumber(matchingTenant.getRoomNumber() != null ? matchingTenant.getRoomNumber() : (requestPayload != null ? requestPayload.getRoomNumber() : ""));
                checkIn.setBedNumber(matchingTenant.getBedNumber() != null ? matchingTenant.getBedNumber() : (requestPayload != null ? requestPayload.getBedNumber() : ""));
                checkIn.setRent(matchingTenant.getRent() != null ? matchingTenant.getRent() : BigDecimal.valueOf(8000));
                checkIn.setDepositPaid(matchingTenant.getDeposit() != null ? matchingTenant.getDeposit() : BigDecimal.valueOf(16000));
                checkIn.setIdVerified(true);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-in record not found."));
            }
        }

        if (checkIn.getStatus() != null && ("completed".equalsIgnoreCase(checkIn.getStatus()) || "checked_in".equalsIgnoreCase(checkIn.getStatus()) || "active".equalsIgnoreCase(checkIn.getStatus()))) {
            return ResponseEntity.badRequest().body(new MessageResponse("Check-in is already completed."));
        }

        if (requestPayload != null) {
            if (requestPayload.getCheckInDate() != null) {
                checkIn.setCheckInDate(requestPayload.getCheckInDate());
            }
            if (requestPayload.getPaymentMethod() != null) {
                checkIn.setPaymentMethod(requestPayload.getPaymentMethod());
            }
            if (requestPayload.getRazorpayPaymentId() != null) {
                checkIn.setRazorpayPaymentId(requestPayload.getRazorpayPaymentId());
            }
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

    @GetMapping("/{id}/invoice")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('TENANT')")
    public ResponseEntity<?> getCheckInInvoice(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        CheckIn checkIn = checkInRepository.findById(id).orElse(null);
        if (checkIn == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-in record not found."));
        }

        BigDecimal rent = checkIn.getRent() != null ? checkIn.getRent() : java.math.BigDecimal.valueOf(8000);
        BigDecimal deposit = checkIn.getDepositPaid() != null ? checkIn.getDepositPaid() : java.math.BigDecimal.valueOf(16000);
        BigDecimal totalCharges = rent.add(deposit);
        BigDecimal advance = checkIn.getAdvanceAmount() != null ? checkIn.getAdvanceAmount() : java.math.BigDecimal.ZERO;
        BigDecimal netBalance = totalCharges.subtract(advance);
        if (netBalance.compareTo(java.math.BigDecimal.ZERO) < 0) netBalance = java.math.BigDecimal.ZERO;

        String propName = "StayEaze Property";
        if (checkIn.getPropertyId() != null) {
            Property p = propertyRepository.findById(checkIn.getPropertyId()).orElse(null);
            if (p != null) propName = p.getName();
        }

        Tenant tenant = null;
        if (checkIn.getTenantEmail() != null && !checkIn.getTenantEmail().isBlank()) {
            tenant = tenantRepository.findFirstByEmail(checkIn.getTenantEmail().trim()).orElse(null);
        }
        if (tenant == null && checkIn.getTenantPhone() != null && !checkIn.getTenantPhone().isBlank()) {
            tenant = tenantRepository.findFirstByMobile(checkIn.getTenantPhone().trim()).orElse(null);
        }

        String invNum = null;
        if (tenant != null) {
            invNum = invoiceRepository.findByTenant(tenant).stream()
                    .map(Invoice::getInvoiceNumber)
                    .filter(num -> num != null && !num.isBlank())
                    .findFirst().orElse(null);
        }
        if (invNum == null) {
            invNum = invoiceSequenceService.nextRentalInvoiceNumber(tenant);
        }

        Map<String, Object> invoiceMap = new HashMap<>();
        invoiceMap.put("invoiceNumber", invNum);
        invoiceMap.put("checkInId", checkIn.getId());
        invoiceMap.put("tenantName", checkIn.getTenantName());
        invoiceMap.put("tenantEmail", checkIn.getTenantEmail());
        invoiceMap.put("tenantPhone", checkIn.getTenantPhone());
        invoiceMap.put("propertyName", propName);
        invoiceMap.put("roomNumber", checkIn.getRoomNumber());
        invoiceMap.put("bedNumber", checkIn.getBedNumber());
        invoiceMap.put("rent", rent);
        invoiceMap.put("deposit", deposit);
        invoiceMap.put("totalCharges", totalCharges);
        invoiceMap.put("advanceAmount", advance);
        invoiceMap.put("netBalancePaid", netBalance);
        invoiceMap.put("paymentMethod", checkIn.getPaymentMethod() != null ? checkIn.getPaymentMethod() : "CASH");
        invoiceMap.put("status", checkIn.getStatus());
        invoiceMap.put("checkInDate", checkIn.getCheckInDate() != null ? checkIn.getCheckInDate().toString() : java.time.LocalDate.now().toString());
        invoiceMap.put("razorpayPaymentId", checkIn.getRazorpayPaymentId());

        return ResponseEntity.ok(invoiceMap);
    }
}
