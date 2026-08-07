package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Booking;
import com.stayeaze.backend.models.CheckinChecklist;
import com.stayeaze.backend.payload.request.CheckinChecklistRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.BookingRepository;
import com.stayeaze.backend.repository.CheckinChecklistRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/bookings/{bookingId}/checkin-checklist")
public class CheckinChecklistController {

    @Autowired
    private CheckinChecklistRepository checkinChecklistRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createCheckinChecklist(@PathVariable UUID bookingId, @Valid @RequestBody CheckinChecklistRequest request) {
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking record not found."));
        }

        if (checkinChecklistRepository.findByBooking(booking).isPresent()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Check-in checklist is already logged for this booking!"));
        }

        CheckinChecklist checklist = new CheckinChecklist(booking, request.getKeysHandedOver(), request.getAmenitiesHandedOver(), request.getSubMeterReading());
        checklist.setNotes(request.getNotes());

        CheckinChecklist saved = checkinChecklistRepository.save(checklist);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<?> getCheckinChecklist(@PathVariable UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking record not found."));
        }

        CheckinChecklist checklist = checkinChecklistRepository.findByBooking(booking).orElse(null);
        if (checklist == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Checklist not recorded yet."));
        }

        return ResponseEntity.ok(checklist);
    }
}
