package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.TenantDocument;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.request.TenantDocumentRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.TenantDocumentRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
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
@RequestMapping("/api/v1/tenants/{tenantId}/documents")
public class TenantDocumentController {

    @Autowired
    private TenantDocumentRepository tenantDocumentRepository;

    @Autowired
    private TenantRepository tenantRepository;

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

    private boolean isSuperAdminUser() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return false;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities() != null) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") || a.getAuthority().equalsIgnoreCase("SUPER_ADMIN"));
        }
        return false;
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        if (tenantId == null) return null;
        if (isSuperAdminUser()) {
            return tenantRepository.findByIdSuperAdmin(tenantId).orElse(null);
        }
        try {
            Organization organization = getLoggedUserOrg();
            if (organization != null) {
                return tenantRepository.findByIdAndOrganization(tenantId, organization)
                        .orElseGet(() -> tenantRepository.findByIdSuperAdmin(tenantId).orElse(null));
            }
        } catch (Exception ignored) {}

        return tenantRepository.findByIdSuperAdmin(tenantId).orElse(null);
    }

    @Autowired
    private com.stayeaze.backend.services.FileStorageService fileStorageService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> uploadDocument(@PathVariable UUID tenantId,
            @Valid @RequestBody TenantDocumentRequest request) {
        Tenant tenant = getAuthorizedTenant(tenantId);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant record not found."));
        }

        TenantDocument doc = new TenantDocument(tenant, request.getDocumentType(), request.getDocumentNumber());
        doc.setFileUrl(request.getFileUrl());
        TenantDocument saved = tenantDocumentRepository.save(doc);

        if (request.getDocumentType() != null && !request.getDocumentType().isBlank()) {
            tenant.setIdType(request.getDocumentType().toLowerCase());
        }
        if (request.getDocumentNumber() != null && !request.getDocumentNumber().isBlank()) {
            tenant.setIdNumber(request.getDocumentNumber());
        }
        tenantRepository.save(tenant);

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PostMapping(value = "/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> uploadDocumentFile(
            @PathVariable UUID tenantId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam(value = "documentNumber", required = false) String documentNumber) {
        Tenant tenant = getAuthorizedTenant(tenantId);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant record not found."));
        }

        try {
            String fileUrl = fileStorageService.storeFile(file, "kyc");
            TenantDocument doc = new TenantDocument(tenant, documentType, documentNumber);
            doc.setFileUrl(fileUrl);
            TenantDocument saved = tenantDocumentRepository.save(doc);

            if (documentType != null && !documentType.isBlank()) {
                tenant.setIdType(documentType.toLowerCase());
            }
            if (documentNumber != null && !documentNumber.isBlank()) {
                tenant.setIdNumber(documentNumber);
            }
            tenantRepository.save(tenant);

            return new ResponseEntity<>(saved, HttpStatus.CREATED);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Failed to upload document file: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllDocuments(@PathVariable UUID tenantId) {
        Tenant tenant = getAuthorizedTenant(tenantId);
        if (tenant == null) {
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }

        List<TenantDocument> docs = tenantDocumentRepository.findByTenant(tenant);
        if (docs == null) {
            docs = new java.util.ArrayList<>();
        }

        if (docs.isEmpty() && tenant.getIdNumber() != null && !tenant.getIdNumber().isBlank()) {
            TenantDocument initialDoc = new TenantDocument(tenant, tenant.getIdType() != null ? tenant.getIdType().toUpperCase() : "AADHAAR", tenant.getIdNumber());
            initialDoc.setVerificationStatus(tenant.getKycStatus() != null ? tenant.getKycStatus() : "PENDING");
            initialDoc.setFileUrl(null);
            TenantDocument saved = tenantDocumentRepository.save(initialDoc);
            docs.add(saved);
        }

        return ResponseEntity.ok(docs);
    }

    @PutMapping("/{id}/verify")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> verifyDocument(@PathVariable UUID tenantId, @PathVariable UUID id,
            @RequestParam String status) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        TenantDocument doc = tenantDocumentRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (doc == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Document not found."));
        }

        if (!"VERIFIED".equals(status) && !"REJECTED".equals(status)) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Invalid verification status. Use 'VERIFIED' or 'REJECTED'."));
        }

        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication()
                .getPrincipal();
        User verifier = userRepository.findById(userDetails.getId()).orElse(null);

        doc.setVerificationStatus(status);
        doc.setVerifiedAt(OffsetDateTime.now());
        doc.setVerifiedBy(verifier);

        TenantDocument updated = tenantDocumentRepository.save(doc);

        // Evaluate overall tenant KYC status
        List<TenantDocument> allDocs = tenantDocumentRepository.findByTenant(tenant);
        boolean anyRejected = allDocs.stream().anyMatch(d -> "REJECTED".equalsIgnoreCase(d.getVerificationStatus()));
        boolean allVerified = !allDocs.isEmpty() && allDocs.stream().allMatch(d -> "VERIFIED".equalsIgnoreCase(d.getVerificationStatus()));

        if (anyRejected) {
            tenant.setKycStatus("REJECTED");
        } else if (allVerified) {
            tenant.setKycStatus("VERIFIED");
        } else {
            tenant.setKycStatus("PENDING");
        }
        tenantRepository.save(tenant);

        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteDocument(@PathVariable UUID tenantId, @PathVariable UUID id) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        TenantDocument doc = tenantDocumentRepository.findByIdAndTenant(id, tenant).orElse(null);
        if (doc == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Document not found."));
        }

        tenantDocumentRepository.delete(doc);

        // Re-evaluate tenant KYC status
        List<TenantDocument> remainingDocs = tenantDocumentRepository.findByTenant(tenant);
        if (remainingDocs.isEmpty()) {
            tenant.setKycStatus("PENDING");
        } else {
            boolean allVerified = remainingDocs.stream().allMatch(d -> "VERIFIED".equals(d.getVerificationStatus()));
            boolean anyRejected = remainingDocs.stream().anyMatch(d -> "REJECTED".equals(d.getVerificationStatus()));
            if (allVerified)
                tenant.setKycStatus("VERIFIED");
            else if (anyRejected)
                tenant.setKycStatus("REJECTED");
            else
                tenant.setKycStatus("PENDING");
        }
        tenantRepository.save(tenant);

        return ResponseEntity.ok(new MessageResponse("Document deleted successfully."));
    }
}
