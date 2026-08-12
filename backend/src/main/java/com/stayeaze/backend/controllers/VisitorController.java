package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.Visitor;
import com.stayeaze.backend.payload.request.VisitorRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.VisitorRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class VisitorController {

    @Autowired
    private VisitorRepository visitorRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        Organization organization = getLoggedUserOrg();
        return tenantRepository.findByIdAndOrganization(tenantId, organization)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found or unauthorized"));
    }

    @PostMapping("/tenants/{tenantId}/visitors")
    public ResponseEntity<?> preRegisterVisitor(@PathVariable UUID tenantId, @Valid @RequestBody VisitorRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Visitor visitor = new Visitor(tenant, request.getVisitorName(), request.getMobileNumber());
        visitor.setPurpose(request.getPurpose());
        
        Visitor saved = visitorRepository.save(visitor);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping("/tenants/{tenantId}/visitors")
    public ResponseEntity<?> getTenantVisitors(@PathVariable UUID tenantId) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<Visitor> visitors = visitorRepository.findByTenant(tenant);
        return ResponseEntity.ok(visitors);
    }

    @GetMapping("/visitors")
    public ResponseEntity<?> getFlatVisitors(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = getLoggedUserOrg();
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));
        org.springframework.data.domain.Page<Visitor> pageResult = visitorRepository.findByOrganizationId(organization.getId(), pageable);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.ofPage(pageResult));
    }

    @PutMapping("/tenants/{tenantId}/visitors/{id}/checkin")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> checkInVisitor(@PathVariable UUID tenantId, @PathVariable UUID id) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Visitor visitor = visitorRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Visitor record not found."));
        }

        visitor.setStatus("CHECKED_IN");
        visitor.setCheckInTime(OffsetDateTime.now());

        Visitor updated = visitorRepository.save(visitor);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/tenants/{tenantId}/visitors/{id}/checkout")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> checkOutVisitor(@PathVariable UUID tenantId, @PathVariable UUID id) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Visitor visitor = visitorRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (visitor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Visitor record not found."));
        }

        visitor.setStatus("CHECKED_OUT");
        visitor.setCheckOutTime(OffsetDateTime.now());

        Visitor updated = visitorRepository.save(visitor);
        return ResponseEntity.ok(updated);
    }
}
