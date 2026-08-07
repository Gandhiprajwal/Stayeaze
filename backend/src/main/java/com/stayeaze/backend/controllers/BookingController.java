package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.BookingRequest;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class BookingController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Map<String, Object> formatBooking(Booking b) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", b.getId());
        map.put("bookingCode", b.getBookingCode() != null ? b.getBookingCode() : ("BK-" + b.getId().toString().substring(0, 4).toUpperCase()));
        
        String tName = b.getTenantName();
        String tEmail = b.getTenantEmail();
        String tPhone = b.getTenantPhone();
        if (b.getTenant() != null) {
            if (tName == null || tName.isBlank()) tName = b.getTenant().getFirstName() + " " + b.getTenant().getLastName();
            if (tEmail == null || tEmail.isBlank()) tEmail = b.getTenant().getEmail();
            if (tPhone == null || tPhone.isBlank()) tPhone = b.getTenant().getMobile();
        }
        map.put("tenantName", tName != null ? tName : "Guest");
        map.put("tenantEmail", tEmail != null ? tEmail : "");
        map.put("tenantPhone", tPhone != null ? tPhone : "");

        UUID propId = b.getPropertyId();
        if (propId == null && b.getTenant() != null) propId = b.getTenant().getPropertyId();
        if (propId == null && b.getBed() != null && b.getBed().getRoom() != null && b.getBed().getRoom().getFloor() != null && b.getBed().getRoom().getFloor().getBuilding() != null) {
            propId = b.getBed().getRoom().getFloor().getBuilding().getProperty().getId();
        }
        if (propId == null) {
            Organization org = getLoggedUserOrg();
            propId = propertyRepository.findAll().stream().filter(p -> p.getOrganization().getId().equals(org.getId())).map(Property::getId).findFirst().orElse(null);
        }
        map.put("propertyId", propId);

        String rNum = b.getRoomNumber();
        if (rNum == null && b.getBed() != null && b.getBed().getRoom() != null) rNum = b.getBed().getRoom().getRoomNumber();
        map.put("roomNumber", rNum != null ? rNum : "101");

        String bNum = b.getBedNumber();
        if (bNum == null && b.getBed() != null) bNum = b.getBed().getBedNumber();
        map.put("bedNumber", bNum != null ? bNum : "B1");

        map.put("checkInDate", b.getCheckinDate() != null ? b.getCheckinDate().toString() : java.time.LocalDate.now().toString());
        map.put("durationMonths", b.getDurationMonths() != null ? b.getDurationMonths() : 6);
        map.put("rent", b.getRentAgreed() != null ? b.getRentAgreed() : 8000);
        map.put("deposit", b.getDepositAgreed() != null ? b.getDepositAgreed() : 16000);

        String st = b.getStatus();
        map.put("status", st != null ? st.toLowerCase() : "pending");

        String src = b.getSource();
        map.put("source", src != null ? src.toLowerCase() : "direct");
        map.put("createdAt", b.getCreatedAt());

        return map;
    }

    @PostMapping("/tenants/{tenantId}/bookings")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createBooking(@PathVariable UUID tenantId, @Valid @RequestBody BookingRequest request) {
        Organization organization = getLoggedUserOrg();
        
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant not found."));
        }

        Bed bed = request.getBedId() != null ? bedRepository.findById(request.getBedId()).orElse(null) : null;
        if (bed != null && !"AVAILABLE".equalsIgnoreCase(bed.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed is not available. Current status: " + bed.getStatus()));
        }

        if (bed != null) {
            bed.setStatus("OCCUPIED");
            bedRepository.save(bed);
        }

        java.math.BigDecimal rent = request.getRentAgreed() != null ? request.getRentAgreed() : java.math.BigDecimal.valueOf(8000);
        java.math.BigDecimal deposit = request.getDepositAgreed() != null ? request.getDepositAgreed() : java.math.BigDecimal.valueOf(16000);
        java.time.LocalDate checkin = request.getCheckinDate() != null ? request.getCheckinDate() : java.time.LocalDate.now();

        Booking booking = new Booking(tenant, bed, checkin, rent, deposit);
        if (request.getStatus() != null) booking.setStatus(request.getStatus().toUpperCase());
        Booking saved = bookingRepository.save(booking);

        return new ResponseEntity<>(formatBooking(saved), HttpStatus.CREATED);
    }

    @PostMapping("/bookings")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createFlatBooking(@RequestBody BookingRequest request) {
        try {
            Organization organization = getLoggedUserOrg();

            // Find or create tenant stub safely
            Tenant tenant = null;
            if (request.getTenantPhone() != null && !request.getTenantPhone().isBlank()) {
                tenant = tenantRepository.findFirstByMobile(request.getTenantPhone()).orElse(null);
            }
            if (tenant == null && request.getTenantEmail() != null && !request.getTenantEmail().isBlank()) {
                tenant = tenantRepository.findFirstByEmail(request.getTenantEmail()).orElse(null);
            }

            java.math.BigDecimal rent = request.getRentAgreed() != null ? request.getRentAgreed() : java.math.BigDecimal.valueOf(8000);
            java.math.BigDecimal deposit = request.getDepositAgreed() != null ? request.getDepositAgreed() : java.math.BigDecimal.valueOf(16000);
            java.time.LocalDate checkin = request.getCheckinDate() != null ? request.getCheckinDate() : java.time.LocalDate.now();
            int duration = request.getDurationMonths() != null ? request.getDurationMonths() : 6;

            if (tenant == null) {
                String fName = request.getTenantName() != null && !request.getTenantName().isBlank() ? request.getTenantName().trim() : "Guest";
                String lName = "-";
                if (fName.contains(" ")) {
                    String[] parts = fName.split("\\s+", 2);
                    fName = parts[0];
                    lName = parts[1];
                }
                if (lName.isBlank()) lName = "-";
                String mobile = request.getTenantPhone() != null && !request.getTenantPhone().isBlank() ? request.getTenantPhone() : ("9" + (System.currentTimeMillis() % 1000000000L));
                tenant = new Tenant(organization, fName, lName, mobile);
                tenant.setEmail(request.getTenantEmail() != null && !request.getTenantEmail().isBlank() ? request.getTenantEmail() : ("guest" + System.currentTimeMillis() + "@stayeaze.com"));
            }

            if (request.getPropertyId() != null) tenant.setPropertyId(request.getPropertyId());
            if (request.getRoomNumber() != null) tenant.setRoomNumber(request.getRoomNumber());
            if (request.getBedNumber() != null) tenant.setBedNumber(request.getBedNumber());
            tenant.setRent(rent);
            tenant.setDeposit(deposit);
            tenant.setLeaseStart(checkin.toString());
            tenant.setLeaseEnd(checkin.plusMonths(duration).toString());
            tenant = tenantRepository.save(tenant);

            Bed bed = null;
            if (request.getBedId() != null) {
                bed = bedRepository.findById(request.getBedId()).orElse(null);
            }

            Booking booking = new Booking(tenant, bed, checkin, rent, deposit);
            if (request.getBookingCode() != null) booking.setBookingCode(request.getBookingCode());
            if (request.getTenantName() != null) booking.setTenantName(request.getTenantName());
            if (request.getTenantEmail() != null) booking.setTenantEmail(request.getTenantEmail());
            if (request.getTenantPhone() != null) booking.setTenantPhone(request.getTenantPhone());
            if (request.getPropertyId() != null) booking.setPropertyId(request.getPropertyId());
            if (request.getRoomNumber() != null) booking.setRoomNumber(request.getRoomNumber());
            if (request.getBedNumber() != null) booking.setBedNumber(request.getBedNumber());
            booking.setDurationMonths(duration);
            if (request.getStatus() != null) booking.setStatus(request.getStatus().toUpperCase());
            if (request.getSource() != null) booking.setSource(request.getSource());

            Booking saved = bookingRepository.save(booking);

            // Auto-create CheckIn record
            try {
                UUID propId = request.getPropertyId();
                if (propId == null && tenant != null) propId = tenant.getPropertyId();
                if (propId == null) {
                    List<Property> props = propertyRepository.findByOrganization(organization);
                    if (props != null && !props.isEmpty()) propId = props.get(0).getId();
                }

                if (propId != null) {
                    CheckIn checkIn = new CheckIn();
                    checkIn.setOrganization(organization);
                    checkIn.setTenantName(tenant != null ? (tenant.getFirstName() + " " + tenant.getLastName()).trim() : (request.getTenantName() != null ? request.getTenantName() : "Guest"));
                    checkIn.setPropertyId(propId);
                    checkIn.setRoomNumber(request.getRoomNumber() != null ? request.getRoomNumber() : (tenant != null && tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "101"));
                    checkIn.setBedNumber(request.getBedNumber() != null ? request.getBedNumber() : (tenant != null && tenant.getBedNumber() != null ? tenant.getBedNumber() : "B1"));
                    checkIn.setRent(saved.getRentAgreed() != null ? saved.getRentAgreed() : java.math.BigDecimal.valueOf(8000));
                    checkIn.setDepositPaid(saved.getDepositAgreed() != null ? saved.getDepositAgreed() : java.math.BigDecimal.valueOf(16000));
                    checkIn.setCheckInDate(saved.getCheckinDate() != null ? saved.getCheckinDate() : java.time.LocalDate.now());
                    checkIn.setStatus("pending");
                    checkIn.setBookingId(saved.getId());
                    checkIn.setCode("CI-" + (System.currentTimeMillis() % 100000000L));
                    checkInRepository.save(checkIn);
                }
            } catch(Exception ex) {
                ex.printStackTrace();
            }

            return new ResponseEntity<>(formatBooking(saved), HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error processing booking: " + e.getMessage()));
        }
    }

    @PutMapping("/bookings/{id}")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateBooking(@PathVariable UUID id, @RequestBody BookingRequest request) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null || !booking.getTenant().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking not found."));
        }

        if (request.getCheckinDate() != null) booking.setCheckinDate(request.getCheckinDate());
        if (request.getRentAgreed() != null) booking.setRentAgreed(request.getRentAgreed());
        if (request.getDepositAgreed() != null) booking.setDepositAgreed(request.getDepositAgreed());
        if (request.getStatus() != null) booking.setStatus(request.getStatus().toUpperCase());
        if (request.getTenantName() != null) booking.setTenantName(request.getTenantName());
        if (request.getTenantEmail() != null) booking.setTenantEmail(request.getTenantEmail());
        if (request.getTenantPhone() != null) booking.setTenantPhone(request.getTenantPhone());
        if (request.getPropertyId() != null) booking.setPropertyId(request.getPropertyId());
        if (request.getRoomNumber() != null) booking.setRoomNumber(request.getRoomNumber());
        if (request.getBedNumber() != null) booking.setBedNumber(request.getBedNumber());
        if (request.getDurationMonths() != null) booking.setDurationMonths(request.getDurationMonths());
        if (request.getSource() != null) booking.setSource(request.getSource());

        // Update linked tenant entity
        Tenant tenant = booking.getTenant();
        if (tenant != null) {
            if (booking.getRentAgreed() != null) tenant.setRent(booking.getRentAgreed());
            if (booking.getDepositAgreed() != null) tenant.setDeposit(booking.getDepositAgreed());
            if (booking.getPropertyId() != null) tenant.setPropertyId(booking.getPropertyId());
            if (booking.getRoomNumber() != null) tenant.setRoomNumber(booking.getRoomNumber());
            if (booking.getBedNumber() != null) tenant.setBedNumber(booking.getBedNumber());
            if (booking.getCheckinDate() != null) tenant.setLeaseStart(booking.getCheckinDate().toString());
            tenantRepository.save(tenant);
        }

        Booking saved = bookingRepository.save(booking);
        return ResponseEntity.ok(formatBooking(saved));
    }

    @DeleteMapping("/bookings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteBooking(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null || !booking.getTenant().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking not found."));
        }
        booking.setStatus("CANCELLED");
        bookingRepository.save(booking);
        return ResponseEntity.ok(new MessageResponse("Booking cancelled successfully."));
    }

    @GetMapping("/tenants/{tenantId}/bookings")
    public ResponseEntity<?> getTenantBookings(@PathVariable UUID tenantId) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant not found."));
        }

        List<Booking> bookings = bookingRepository.findByTenant(tenant);
        List<Map<String, Object>> response = new ArrayList<>();
        for (Booking b : bookings) {
            response.add(formatBooking(b));
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/bookings")
    public ResponseEntity<?> getFlatBookings() {
        Organization organization = getLoggedUserOrg();
        List<Booking> bookings = bookingRepository.findByOrganizationId(organization.getId());
        List<Map<String, Object>> response = new ArrayList<>();
        for (Booking b : bookings) {
            response.add(formatBooking(b));
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/bookings/{id}")
    public ResponseEntity<?> getBookingById(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null || !booking.getTenant().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking not found."));
        }
        return ResponseEntity.ok(formatBooking(booking));
    }
}
