package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.CheckoutAuditRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.BookingRepository;
import com.stayeaze.backend.repository.CheckoutAuditRepository;
import com.stayeaze.backend.repository.TenantRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/bookings/{bookingId}/checkout-audit")
public class CheckoutAuditController {

    @Autowired
    private CheckoutAuditRepository checkoutAuditRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createCheckoutAudit(@PathVariable UUID bookingId, @Valid @RequestBody CheckoutAuditRequest request) {
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking record not found."));
        }

        if (checkoutAuditRepository.findByBooking(booking).isPresent()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Checkout audit has already been completed for this booking."));
        }

        // Complete Checkout Audit details
        CheckoutAudit audit = new CheckoutAudit(booking, request.getDamagesChecked(), request.getDamageCharges(), request.getKeysReturned(), request.getRefundAmount());
        audit.setNotes(request.getNotes());

        CheckoutAudit saved = checkoutAuditRepository.save(audit);

        // Update Booking status to CHECKED_OUT and set CheckoutDate
        booking.setStatus("CHECKED_OUT");
        booking.setCheckoutDate(LocalDate.now());
        bookingRepository.save(booking);

        // Release Bed: change bed status back to AVAILABLE
        Bed bed = booking.getBed();
        if (bed != null) {
            bed.setStatus("AVAILABLE");
            bedRepository.save(bed);
        }

        // Update Tenant status to CHECKED_OUT if they have no other active bookings
        Tenant tenant = booking.getTenant();
        if (tenant != null) {
            tenant.setStatus("CHECKED_OUT");
            tenantRepository.save(tenant);
        }

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<?> getCheckoutAudit(@PathVariable UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking record not found."));
        }

        CheckoutAudit audit = checkoutAuditRepository.findByBooking(booking).orElse(null);
        if (audit == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Checkout audit not completed yet."));
        }

        return ResponseEntity.ok(audit);
    }
}
