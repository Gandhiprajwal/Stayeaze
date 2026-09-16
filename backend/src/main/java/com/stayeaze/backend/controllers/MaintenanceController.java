package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Maintenance;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.MaintenanceRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/maintenance")
public class MaintenanceController {

    @Autowired
    private MaintenanceRepository maintenanceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @GetMapping
    public ResponseEntity<?> getAllMaintenanceTasks(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null || propertyId != null) {
            List<Maintenance> filtered = maintenanceRepository.findByOrganizationId(organization.getId()).stream()
                    .filter(m -> m.getPropertyId() != null)
                    .filter(m -> assignedProps == null || assignedProps.contains(m.getPropertyId()))
                    .filter(m -> propertyId == null || propertyId.equals(m.getPropertyId()))
                    .collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(filtered, page, pageSize));
        }

        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));
        org.springframework.data.domain.Page<Maintenance> pageResult = maintenanceRepository.findByOrganizationId(organization.getId(), pageable);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.ofPage(pageResult));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createMaintenanceTask(@Valid @RequestBody Maintenance request) {
        Organization organization = getLoggedUserOrg();
        request.setOrganization(organization);
        if (request.getPropertyId() != null) {
            securityUtils.validatePropertyAccess(request.getPropertyId());
        }
        
        if (request.getTicketNumber() == null || request.getTicketNumber().isEmpty()) {
            request.setTicketNumber("MNT-" + String.valueOf(System.currentTimeMillis()).substring(8));
        }

        Maintenance saved = maintenanceRepository.save(request);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateMaintenanceTask(@PathVariable UUID id, @Valid @RequestBody Maintenance request) {
        Organization organization = getLoggedUserOrg();
        Maintenance task = maintenanceRepository.findById(id).orElse(null);
        if (task == null || !task.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Maintenance task not found."));
        }

        task.setAsset(request.getAsset());
        task.setPropertyId(request.getPropertyId());
        task.setType(request.getType());
        task.setPriority(request.getPriority());
        task.setDescription(request.getDescription());
        task.setCost(request.getCost());
        task.setVendor(request.getVendor());
        task.setStatus(request.getStatus());

        Maintenance updated = maintenanceRepository.save(task);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteMaintenanceTask(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Maintenance task = maintenanceRepository.findById(id).orElse(null);
        if (task == null || !task.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Maintenance task not found."));
        }

        maintenanceRepository.delete(task);
        return ResponseEntity.ok(new MessageResponse("Maintenance task successfully deleted."));
    }
}
