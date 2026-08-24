package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.UserJourneyAudit;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.PageResponse;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.UserJourneyAuditRepository;
import com.stayeaze.backend.services.UserJourneyAuditService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.web.bind.annotation.*;

import java.io.PrintWriter;
import java.time.OffsetDateTime;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/user-tracking")
@PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('SUPPORT')")
public class SuperAdminUserTrackingController {

    @Autowired
    private UserJourneyAuditRepository auditRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private UserJourneyAuditService auditService;

    @GetMapping("/events")
    public ResponseEntity<?> getEvents(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {

        int validPage = Math.max(1, page);
        int validSize = Math.min(100, Math.max(1, pageSize));
        Pageable pageable = PageRequest.of(validPage - 1, validSize, Sort.by("createdAt").descending());

        final String q = (search != null && !search.isBlank()) ? search.trim() : null;
        final String cat = (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) ? category.trim() : null;
        final String stat = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.trim() : null;

        Specification<UserJourneyAudit> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (orgId != null) {
                predicates.add(cb.equal(root.get("orgId"), orgId));
            }
            if (cat != null) {
                predicates.add(cb.equal(cb.upper(root.get("category")), cat.toUpperCase()));
            }
            if (stat != null) {
                predicates.add(cb.equal(cb.upper(root.get("status")), stat.toUpperCase()));
            }
            if (q != null) {
                String pattern = "%" + q.toLowerCase() + "%";
                Predicate emailMatch = cb.like(cb.lower(root.get("userEmail")), pattern);
                Predicate orgMatch = cb.like(cb.lower(root.get("orgName")), pattern);
                Predicate actionMatch = cb.like(cb.lower(root.get("action")), pattern);
                Predicate resourceMatch = cb.like(cb.lower(root.get("resourceId")), pattern);
                Predicate ipMatch = cb.like(cb.lower(root.get("clientIp")), pattern);
                predicates.add(cb.or(emailMatch, orgMatch, actionMatch, resourceMatch, ipMatch));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<UserJourneyAudit> auditPage = auditRepository.findAll(spec, pageable);

        return ResponseEntity.ok(new PageResponse<>(
                auditPage.getContent(),
                auditPage.getTotalElements(),
                validPage,
                validSize,
                auditPage.getTotalPages()
        ));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalEvents = auditRepository.countTotalEvents();
        long paymentFailures = auditRepository.countPaymentFailures();
        long criticalAnomalies = auditRepository.countCriticalAnomalies();
        long authFailures = auditRepository.countAuthFailures();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalEvents", totalEvents);
        stats.put("paymentFailures", paymentFailures);
        stats.put("criticalAnomalies", criticalAnomalies);
        stats.put("authFailures", authFailures);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/anomalies")
    public ResponseEntity<?> getAnomalies(@RequestParam(defaultValue = "10") int limit) {
        Pageable pageable = PageRequest.of(0, Math.min(50, Math.max(1, limit)));
        List<UserJourneyAudit> anomalies = auditRepository.findTopAnomalies(pageable);
        return ResponseEntity.ok(anomalies);
    }

    @GetMapping("/user-timeline")
    public ResponseEntity<?> getUserTimeline(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) UUID userId,
            @RequestParam(defaultValue = "50") int limit) {

        if ((email == null || email.isBlank()) && userId == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Email or userId is required"));
        }

        Pageable pageable = PageRequest.of(0, Math.min(100, Math.max(1, limit)));
        List<UserJourneyAudit> timeline = auditRepository.findUserTimeline(email != null ? email.trim() : "", userId, pageable);
        return ResponseEntity.ok(timeline);
    }

    @PostMapping("/reconcile/{auditId}")
    public ResponseEntity<?> reconcilePayment(
            @PathVariable UUID auditId,
            @RequestBody(required = false) Map<String, Object> body) {

        UserJourneyAudit audit = auditRepository.findById(auditId)
                .orElseThrow(() -> new RuntimeException("Audit record not found with ID: " + auditId));

        String notes = body != null && body.get("notes") != null ? body.get("notes").toString() : "Manually verified by Super Admin";

        // Reconcile and update status
        audit.setStatus("SUCCESS");
        audit.setAction(audit.getAction() + "_RECONCILED");

        Map<String, Object> resolution = new HashMap<>();
        resolution.put("reconciledBy", "SUPER_ADMIN");
        resolution.put("reconciledAt", OffsetDateTime.now().toString());
        resolution.put("notes", notes);
        resolution.put("originalDetails", audit.getDetails());

        audit.setDetails(resolution.toString());
        auditRepository.save(audit);

        // If this audit was for SaaS subscription billing, ensure organization billing is active
        if (audit.getOrgId() != null && "SAAS_BILLING".equalsIgnoreCase(audit.getCategory())) {
            organizationRepository.findById(audit.getOrgId()).ifPresent(org -> {
                org.setStatus("ACTIVE");
                organizationRepository.save(org);

                OrganizationBillingProfile profile = billingProfileRepository.findByOrganization(org).orElse(null);
                if (profile != null) {
                    profile.setSubscriptionStatus("ACTIVE");
                    if (profile.getSubscriptionEndDate() == null || profile.getSubscriptionEndDate().isBefore(OffsetDateTime.now())) {
                        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(30));
                    }
                    if (audit.getResourceId() != null) {
                        profile.setSubscriptionPaymentId(audit.getResourceId());
                    }
                    billingProfileRepository.save(profile);
                }
            });
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Payment record reconciled and subscriber workspace verified.",
                "audit", audit
        ));
    }

    @GetMapping("/export")
    public void exportCsv(
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            HttpServletResponse response) {

        try {
            response.setContentType("text/csv");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"user_journey_audit_" + System.currentTimeMillis() + ".csv\"");

            Pageable pageable = PageRequest.of(0, 1000, Sort.by("createdAt").descending());
            Page<UserJourneyAudit> page = auditRepository.searchAudits(orgId, category, status, search, pageable);

            PrintWriter writer = response.getWriter();
            writer.println("ID,Timestamp,Organization,User Email,Category,Action,Status,Resource ID,Amount,IP Address,Device");

            for (UserJourneyAudit a : page.getContent()) {
                writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                        a.getId(),
                        a.getCreatedAt(),
                        a.getOrgName() != null ? a.getOrgName().replace("\"", "\"\"") : "N/A",
                        a.getUserEmail() != null ? a.getUserEmail() : "N/A",
                        a.getCategory(),
                        a.getAction(),
                        a.getStatus(),
                        a.getResourceId() != null ? a.getResourceId() : "N/A",
                        a.getAmount() != null ? a.getAmount().toString() : "0.00",
                        a.getClientIp() != null ? a.getClientIp() : "N/A",
                        a.getDevice() != null ? a.getDevice().replace("\"", "\"\"") : "N/A"
                );
            }
            writer.flush();
        } catch (Exception e) {
            throw new RuntimeException("Failed to export audit report", e);
        }
    }
}
