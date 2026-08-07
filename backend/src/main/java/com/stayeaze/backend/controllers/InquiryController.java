package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Inquiry;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.request.InquiryRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.InquiryRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.UserRepository;
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
@RequestMapping("/api/v1/inquiries")
public class InquiryController {

    @Autowired
    private InquiryRepository inquiryRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createInquiry(@Valid @RequestBody InquiryRequest request) {
        Organization organization = getLoggedUserOrg();

        Inquiry inquiry = new Inquiry(organization, request.getName(), request.getMobile());
        inquiry.setEmail(request.getEmail());
        inquiry.setGender(request.getGender());
        inquiry.setPreferredSharing(request.getPreferredSharing());
        inquiry.setExpectedMoveInDate(request.getExpectedMoveInDate());
        inquiry.setSource(request.getSource());
        if (request.getStatus() != null) {
            inquiry.setStatus(request.getStatus());
        }

        if (request.getPropertyId() != null) {
            Property property = propertyRepository.findByIdAndOrganization(request.getPropertyId(), organization)
                    .orElse(null);
            inquiry.setProperty(property);
        }

        if (request.getAssignedToUserId() != null) {
            User assignedTo = userRepository.findById(request.getAssignedToUserId()).orElse(null);
            inquiry.setAssignedTo(assignedTo);
        }

        Inquiry saved = inquiryRepository.save(inquiry);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Inquiry>> getAllInquiries() {
        Organization organization = getLoggedUserOrg();
        List<Inquiry> inquiries = inquiryRepository.findByOrganization(organization);
        return ResponseEntity.ok(inquiries);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateInquiry(@PathVariable UUID id, @Valid @RequestBody InquiryRequest request) {
        Organization organization = getLoggedUserOrg();
        Inquiry inquiry = inquiryRepository.findByIdAndOrganization(id, organization)
                .orElse(null);

        if (inquiry == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Inquiry not found."));
        }

        inquiry.setName(request.getName());
        inquiry.setMobile(request.getMobile());
        inquiry.setEmail(request.getEmail());
        inquiry.setGender(request.getGender());
        inquiry.setPreferredSharing(request.getPreferredSharing());
        inquiry.setExpectedMoveInDate(request.getExpectedMoveInDate());
        inquiry.setSource(request.getSource());
        if (request.getStatus() != null) {
            inquiry.setStatus(request.getStatus());
        }

        if (request.getPropertyId() != null) {
            Property property = propertyRepository.findByIdAndOrganization(request.getPropertyId(), organization)
                    .orElse(null);
            inquiry.setProperty(property);
        } else {
            inquiry.setProperty(null);
        }

        if (request.getAssignedToUserId() != null) {
            User assignedTo = userRepository.findById(request.getAssignedToUserId()).orElse(null);
            inquiry.setAssignedTo(assignedTo);
        } else {
            inquiry.setAssignedTo(null);
        }

        Inquiry updated = inquiryRepository.save(inquiry);
        return ResponseEntity.ok(updated);
    }
}
