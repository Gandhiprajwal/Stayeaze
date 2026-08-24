package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SaaSInvoice;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.PageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import com.stayeaze.backend.services.SaaSInvoiceService;
import com.stayeaze.backend.services.SaaSSubscriptionCronService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/invoices")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminSaaSInvoiceController {

    private static final Set<String> ALLOWED_STATUSES = Set.of("PAID", "UNPAID", "PENDING", "CANCELLED", "OVERDUE", "VOID");
    private static final Set<String> ALLOWED_CYCLES = Set.of("MONTHLY", "QUARTERLY", "ANNUAL", "YEARLY");

    @Autowired
    private SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private SaaSPlanRepository planRepository;

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    private com.stayeaze.backend.repository.OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private SaaSInvoiceService saasInvoiceService;

    @Autowired
    private SaaSSubscriptionCronService saasSubscriptionCronService;

    @GetMapping
    public ResponseEntity<?> getInvoices(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        int validatedPage = Math.max(1, page);
        int validatedSize = Math.min(100, Math.max(1, pageSize));

        OffsetDateTime from = OffsetDateTime.of(1970, 1, 1, 0, 0, 0, 0, java.time.ZoneOffset.UTC);
        OffsetDateTime to = OffsetDateTime.of(2099, 12, 31, 23, 59, 59, 0, java.time.ZoneOffset.UTC);
        try {
            if (fromDate != null && !fromDate.isBlank()) from = OffsetDateTime.parse(fromDate);
            if (toDate != null && !toDate.isBlank()) to = OffsetDateTime.parse(toDate);
        } catch (DateTimeParseException ignored) {}

        PageRequest pageRequest = PageRequest.of(validatedPage - 1, validatedSize, Sort.by("createdAt").descending());
        Page<SaaSInvoice> invoicePage = invoiceRepository.searchInvoices(search, status, from, to, pageRequest);
        Page<com.stayeaze.backend.payload.response.SaaSInvoiceSummaryDTO> dtoPage = invoicePage.map(com.stayeaze.backend.payload.response.SaaSInvoiceSummaryDTO::fromEntity);
        return ResponseEntity.ok(PageResponse.ofPage(dtoPage));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getInvoiceStats() {
        Map<String, Object> stats = saasInvoiceService.getInvoiceStats();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/check-duplicate/{orgId}")
    public ResponseEntity<?> checkDuplicate(
            @PathVariable UUID orgId,
            @RequestParam(defaultValue = "MONTHLY") String billingCycle) {
        String cycle = billingCycle != null ? billingCycle.toUpperCase().trim() : "MONTHLY";
        SaaSInvoice existing = saasInvoiceService.checkDuplicateInvoice(orgId, cycle);
        Map<String, Object> res = new HashMap<>();
        res.put("hasDuplicate", existing != null);
        if (existing != null) {
            res.put("invoiceNumber", existing.getInvoiceNumber());
            res.put("status", existing.getStatus());
            res.put("amount", existing.getTotalAmount());
            res.put("invoiceDate", existing.getInvoiceDate());
            res.put("billingCycle", existing.getBillingCycle());
        }
        return ResponseEntity.ok(res);
    }

    @PostMapping("/generate/{orgId}")
    public ResponseEntity<?> generateInvoice(
            @PathVariable UUID orgId,
            @RequestBody(required = false) Map<String, Object> req) {

        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Organization not found"));
        }

        Double customAmount = null;
        if (req != null && req.containsKey("customAmount") && req.get("customAmount") != null) {
            try {
                customAmount = Double.parseDouble(req.get("customAmount").toString());
                if (customAmount <= 0) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Error: Custom invoice amount must be greater than 0."));
                }
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid numeric value for customAmount."));
            }
        }

        String status = "UNPAID";
        if (req != null && req.containsKey("status") && req.get("status") != null) {
            status = req.get("status").toString().toUpperCase().trim();
            if (!ALLOWED_STATUSES.contains(status)) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid status '" + status + "'. Allowed: " + ALLOWED_STATUSES));
            }
        }

        String billingCycle = "MONTHLY";
        if (req != null && req.containsKey("billingCycle") && req.get("billingCycle") != null) {
            billingCycle = req.get("billingCycle").toString().toUpperCase().trim();
            if (!ALLOWED_CYCLES.contains(billingCycle)) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid billingCycle '" + billingCycle + "'. Allowed: MONTHLY, QUARTERLY, ANNUAL"));
            }
        }

        String planName = (req != null && req.containsKey("planName")) ? (String) req.get("planName") : null;
        Boolean force = req != null && Boolean.TRUE.equals(req.get("force"));
        String notes = (req != null && req.containsKey("notes")) ? (String) req.get("notes") : null;

        try {
            SaaSInvoice invoice = saasInvoiceService.generateInvoiceForOrg(orgId, customAmount, status, planName, billingCycle, force, notes);
            if ("PAID".equalsIgnoreCase(invoice.getStatus())) {
                saasSubscriptionCronService.reconcilePaidSubscription(invoice.getId());
            }
            return ResponseEntity.ok(invoice);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/batch-generate")
    public ResponseEntity<?> batchGenerateInvoices() {
        Map<String, Object> result = saasInvoiceService.runBatchMonthlyBilling();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/trigger-subscription-cron")
    public ResponseEntity<?> triggerSubscriptionCron() {
        Map<String, Object> result = saasSubscriptionCronService.processDailySubscriptionLifecycle();
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {

        SaaSInvoice invoice = invoiceRepository.findById(id).orElse(null);
        if (invoice == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Invoice not found"));
        }

        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Status field is required."));
        }

        String upper = newStatus.toUpperCase().trim();
        if (!ALLOWED_STATUSES.contains(upper)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid invoice status '" + upper + "'. Allowed: " + ALLOWED_STATUSES));
        }

        invoice.setStatus(upper);
        invoiceRepository.save(invoice);

        // Reconcile workspace validity upon payment
        if ("PAID".equalsIgnoreCase(upper)) {
            saasSubscriptionCronService.reconcilePaidSubscription(invoice.getId());
        }

        return ResponseEntity.ok(invoice);
    }

    @GetMapping("/{id}/html")
    public ResponseEntity<String> getInvoiceHtml(@PathVariable UUID id) {
        String html = saasInvoiceService.getInvoiceHtml(id);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<String> downloadInvoiceHtml(@PathVariable UUID id) {
        String html = saasInvoiceService.getInvoiceHtml(id);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }
}
