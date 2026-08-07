package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Maintenance;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.MaintenanceRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/maintenance")
public class MaintenanceController {

    @Autowired
    private MaintenanceRepository maintenanceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @GetMapping
    public ResponseEntity<?> getAllMaintenanceTasks() {
        Organization organization = getLoggedUserOrg();
        List<Maintenance> tasks = maintenanceRepository.findByOrganizationId(organization.getId());
        return ResponseEntity.ok(tasks);
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createMaintenanceTask(@Valid @RequestBody Maintenance request) {
        Organization organization = getLoggedUserOrg();
        request.setOrganization(organization);
        
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
