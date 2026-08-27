package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SafetyIncident;
import com.stayeaze.backend.payload.request.SafetyIncidentRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SafetyIncidentRepository;
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
@RequestMapping("/api/v1/safety-incidents")
public class SafetyIncidentController {

    @Autowired
    private SafetyIncidentRepository safetyIncidentRepository;

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

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> logIncident(@Valid @RequestBody SafetyIncidentRequest request) {
        Organization organization = getLoggedUserOrg();

        SafetyIncident incident = new SafetyIncident(organization, request.getReportedBy(), request.getDescription());
        if (request.getSeverity() != null) {
            incident.setSeverity(request.getSeverity());
        }

        SafetyIncident saved = safetyIncidentRepository.save(incident);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<?> getIncidents() {
        Organization organization = getLoggedUserOrg();
        List<SafetyIncident> incidents = safetyIncidentRepository.findByOrganization(organization);
        return ResponseEntity.ok(incidents);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateIncidentStatus(@PathVariable UUID id, @RequestParam String status) {
        Organization organization = getLoggedUserOrg();
        SafetyIncident incident = safetyIncidentRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (incident == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Safety incident record not found."));
        }

        incident.setStatus(status);
        SafetyIncident updated = safetyIncidentRepository.save(incident);
        return ResponseEntity.ok(updated);
    }
}
