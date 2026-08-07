package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.MeterReading;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.MeterReadingRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.MeterReadingRepository;
import com.stayeaze.backend.repository.RoomRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/rooms/{roomId}/meter-readings")
public class MeterReadingController {

    @Autowired
    private MeterReadingRepository meterReadingRepository;

    @Autowired
    private RoomRepository roomRepository;

    private Room getAuthorizedRoom(UUID roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found or unauthorized"));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> logMeterReading(@PathVariable UUID roomId, @Valid @RequestBody MeterReadingRequest request) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        BigDecimal total = request.getReadingValue().multiply(request.getUnitRate());

        MeterReading reading = new MeterReading(room, request.getReadingDate(), request.getReadingValue(), request.getUnitRate(), total);
        MeterReading saved = meterReadingRepository.save(reading);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<?> getMeterReadings(@PathVariable UUID roomId) {
        Room room;
        try {
            room = getAuthorizedRoom(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<MeterReading> readings = meterReadingRepository.findByRoom(room);
        return ResponseEntity.ok(readings);
    }
}
