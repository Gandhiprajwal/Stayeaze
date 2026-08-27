package com.stayeaze.backend.controllers;

import com.stayeaze.backend.services.UtilityBillingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/utilities")
public class UtilityBillingController {

    @Autowired
    private UtilityBillingService utilityBillingService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(UtilityBillingController.class);

    @GetMapping("/properties/{propertyId}/stats")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
    public ResponseEntity<?> getPropertyUtilityStats(
            @PathVariable UUID propertyId,
            @RequestParam(required = false) UUID buildingId,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year) {
        try {
            securityUtils.validatePropertyAccess(propertyId);
            Map<String, Object> stats = utilityBillingService.getPropertyUtilityStats(propertyId, buildingId, month, year);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error generating utility stats for property {}", propertyId, e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Failed to compute stats"));
        }
    }

    @GetMapping("/properties/{propertyId}/meter-sheet")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
    public ResponseEntity<?> getPropertyMeterSheet(
            @PathVariable UUID propertyId,
            @RequestParam(required = false) UUID buildingId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            securityUtils.validatePropertyAccess(propertyId);
            Map<String, Object> sheet = utilityBillingService.getPropertyMeterSheetPaginated(propertyId, buildingId, search, month, year, page, size);
            return ResponseEntity.ok(sheet);
        } catch (Exception e) {
            logger.error("Error fetching paginated meter sheet for property {}", propertyId, e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Failed to load meter sheet"));
        }
    }

    @PostMapping("/calculate-preview")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
    public ResponseEntity<?> calculatePreview(@RequestBody Map<String, Object> request) {
        try {
            UtilityBillingService.RoomUtilityCalculation calc = utilityBillingService.calculateRoomUtility(request);
            return ResponseEntity.ok(calc);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/properties/{propertyId}/bulk-record-readings")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
    public ResponseEntity<?> bulkRecordReadings(
            @PathVariable UUID propertyId,
            @RequestBody Map<String, Object> payload) {
        try {
            securityUtils.validatePropertyAccess(propertyId);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> readings = (List<Map<String, Object>>) payload.get("readings");
            boolean appendToRentInvoices = payload.containsKey("appendToRentInvoices") && Boolean.TRUE.equals(payload.get("appendToRentInvoices"));

            Map<String, Object> result = utilityBillingService.bulkRecordAndApply(propertyId, readings, appendToRentInvoices);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
