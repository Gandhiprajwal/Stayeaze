package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.request.OrganizationRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    @Autowired
    private OrganizationRepository organizationRepository;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<Organization>> getAllOrganizations() {
        List<Organization> orgs = organizationRepository.findAll();
        return ResponseEntity.ok(orgs);
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createOrganization(@Valid @RequestBody OrganizationRequest request) {
        String subdomain = request.getSubdomain().toLowerCase().replaceAll("[^a-z0-9]", "");
        if (subdomain.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Subdomain must contain valid alphanumeric characters!"));
        }

        if (organizationRepository.existsBySubdomain(subdomain)) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Subdomain is already registered!"));
        }

        Organization org = new Organization(request.getName(), subdomain);
        Organization saved = organizationRepository.save(org);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }
}
