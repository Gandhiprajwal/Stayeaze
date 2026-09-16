package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.PaymentRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PaymentRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.TenantRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class PaymentController {

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.services.UserJourneyAuditService userJourneyAuditService;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        if (securityUtils.isSuperAdmin()) {
            return organizationRepository.findAll().stream().findFirst().orElse(null);
        }
        return null;
    }

    private Tenant getAuthorizedTenant(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant profile not found or unauthorized"));
        if (!securityUtils.isSuperAdmin()) {
            Organization organization = getLoggedUserOrg();
            if (organization != null && tenant.getOrganization() != null && !organization.getId().equals(tenant.getOrganization().getId())) {
                throw new IllegalArgumentException("Tenant profile belongs to another organization");
            }
        }
        if (tenant.getPropertyId() != null) {
            securityUtils.validatePropertyAccess(tenant.getPropertyId());
        }
        return tenant;
    }

    @PostMapping("/tenants/{tenantId}/invoices/{invoiceId}/payments")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> receivePayment(@PathVariable UUID tenantId, @PathVariable UUID invoiceId, @Valid @RequestBody PaymentRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Invoice invoice = invoiceRepository.findByIdAndTenant(invoiceId, tenant).orElse(null);
        if (invoice == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Invoice record not found."));
        }

        if ("PAID".equals(invoice.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invoice is already fully paid."));
        }

        // Ledger reconciliation & overpayment handling (P0.1)
        BigDecimal amountPaidBefore = invoice.getAmountPaid() != null ? invoice.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal remainingDue = invoice.getAmountDue().subtract(amountPaidBefore);
        if (remainingDue.compareTo(BigDecimal.ZERO) < 0) remainingDue = BigDecimal.ZERO;

        BigDecimal paymentAmount = request.getAmount();
        BigDecimal appliedToInvoice = paymentAmount;
        BigDecimal surplusCreditedToAdvance = BigDecimal.ZERO;

        if (paymentAmount.compareTo(remainingDue) > 0) {
            appliedToInvoice = remainingDue;
            surplusCreditedToAdvance = paymentAmount.subtract(remainingDue);
            invoice.setAmountPaid(invoice.getAmountDue());
            invoice.setStatus("PAID");

            // Credit surplus amount to resident's Advance Wallet balance
            BigDecimal currentAdvance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
            tenant.setAdvanceBalance(currentAdvance.add(surplusCreditedToAdvance));
            tenantRepository.save(tenant);
        } else {
            BigDecimal newAmountPaid = amountPaidBefore.add(paymentAmount);
            invoice.setAmountPaid(newAmountPaid);
            if (newAmountPaid.compareTo(invoice.getAmountDue()) >= 0) {
                invoice.setStatus("PAID");
            } else {
                invoice.setStatus("PARTIALLY_PAID");
            }
        }

        invoiceRepository.save(invoice);

        // Record payment transaction
        Payment payment = new Payment(invoice, paymentAmount, request.getPaymentMethod());
        payment.setTransactionReference(request.getTransactionReference());
        
        // Sequential receipt number
        String receiptNumber = invoiceSequenceService.nextReceiptNumber(tenant);
        payment.setReceiptNumber(receiptNumber);
        payment.setReceiptUrl("https://stayeaze-receipts.s3.amazonaws.com/receipts/" + receiptNumber.replaceAll("[/\\\\\\s]", "-") + ".pdf");

        Payment saved = paymentRepository.save(payment);

        userJourneyAuditService.logPayment(
                tenant.getOrganization(),
                null,
                tenant.getEmail(),
                "TENANT_RENT",
                "RENT_PAYMENT_COLLECTED",
                "SUCCESS",
                receiptNumber,
                request.getAmount(),
                java.util.Map.of(
                        "invoiceId", invoiceId.toString(),
                        "method", request.getPaymentMethod(),
                        "transactionRef", request.getTransactionReference() != null ? request.getTransactionReference() : "",
                        "appliedToInvoice", appliedToInvoice.toString(),
                        "surplusCreditedToAdvance", surplusCreditedToAdvance.toString()
                ),
                null
        );

        if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
            try {
                emailService.sendPaymentReceiptEmail(
                        tenant.getEmail(),
                        tenant.getName(),
                        receiptNumber,
                        invoice.getInvoiceNumber(),
                        request.getAmount(),
                        request.getPaymentMethod(),
                        request.getTransactionReference(),
                        tenant.getAdvanceBalance(),
                        saved.getReceiptUrl()
                );
            } catch (Exception e) {
                // Log and continue, do not block payment transaction
            }
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("id", saved.getId());
        response.put("payment", saved);
        response.put("appliedToInvoice", appliedToInvoice);
        response.put("surplusCreditedToAdvance", surplusCreditedToAdvance);
        response.put("newAdvanceBalance", tenant.getAdvanceBalance());
        response.put("invoiceStatus", invoice.getStatus());
        response.put("receiptNumber", receiptNumber);

        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/tenants/{tenantId}/payments/lump-sum")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> receiveLumpSumPayment(@PathVariable UUID tenantId, @Valid @RequestBody PaymentRequest request) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        BigDecimal remainingPayment = request.getAmount();
        if (remainingPayment == null || remainingPayment.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Payment amount must be greater than zero."));
        }

        List<Invoice> unpaidInvoices = invoiceRepository.findByTenant(tenant).stream()
                .filter(i -> "UNPAID".equalsIgnoreCase(i.getStatus()) || "PARTIALLY_PAID".equalsIgnoreCase(i.getStatus()) || "OVERDUE".equalsIgnoreCase(i.getStatus()))
                .sorted((a, b) -> {
                    boolean aIsUtil = a.getInvoiceNumber() != null && a.getInvoiceNumber().startsWith("UTIL");
                    boolean bIsUtil = b.getInvoiceNumber() != null && b.getInvoiceNumber().startsWith("UTIL");
                    if (aIsUtil != bIsUtil) return aIsUtil ? -1 : 1;
                    LocalDate aDue = a.getDueDate() != null ? a.getDueDate() : LocalDate.now();
                    LocalDate bDue = b.getDueDate() != null ? b.getDueDate() : LocalDate.now();
                    return aDue.compareTo(bDue);
                })
                .toList();

        List<Payment> createdPayments = new java.util.ArrayList<>();
        BigDecimal totalAppliedToInvoices = BigDecimal.ZERO;

        for (Invoice invoice : unpaidInvoices) {
            if (remainingPayment.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal amountPaidBefore = invoice.getAmountPaid() != null ? invoice.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal due = invoice.getAmountDue().subtract(amountPaidBefore);
            if (due.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal allocate = remainingPayment.min(due);
            BigDecimal newAmountPaid = amountPaidBefore.add(allocate);
            invoice.setAmountPaid(newAmountPaid);
            if (newAmountPaid.compareTo(invoice.getAmountDue()) >= 0) {
                invoice.setStatus("PAID");
            } else {
                invoice.setStatus("PARTIALLY_PAID");
            }
            invoiceRepository.save(invoice);

            Payment payment = new Payment(invoice, allocate, request.getPaymentMethod());
            payment.setTransactionReference(request.getTransactionReference());
            String receiptNumber = invoiceSequenceService.nextReceiptNumber(tenant);
            payment.setReceiptNumber(receiptNumber);
            payment.setReceiptUrl("https://stayeaze-receipts.s3.amazonaws.com/receipts/" + receiptNumber.replaceAll("[/\\\\\\s]", "-") + ".pdf");
            createdPayments.add(paymentRepository.save(payment));

            totalAppliedToInvoices = totalAppliedToInvoices.add(allocate);
            remainingPayment = remainingPayment.subtract(allocate);
        }

        BigDecimal surplusCredited = BigDecimal.ZERO;
        if (remainingPayment.compareTo(BigDecimal.ZERO) > 0) {
            surplusCredited = remainingPayment;
            BigDecimal currentAdvance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
            tenant.setAdvanceBalance(currentAdvance.add(surplusCredited));
            tenantRepository.save(tenant);
        }

        if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
            try {
                emailService.sendPaymentReceiptEmail(
                        tenant.getEmail(),
                        tenant.getName(),
                        "LUMP-SUM-" + (System.currentTimeMillis() % 1000000),
                        createdPayments.size() + " Invoices Settled",
                        request.getAmount(),
                        request.getPaymentMethod(),
                        request.getTransactionReference(),
                        tenant.getAdvanceBalance(),
                        "https://stayeaze.com/portal/billing"
                );
            } catch (Exception e) {
                // Log and continue
            }
        }

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("success", true);
        res.put("totalPaid", request.getAmount());
        res.put("totalAppliedToInvoices", totalAppliedToInvoices);
        res.put("surplusCreditedToAdvance", surplusCredited);
        res.put("newAdvanceBalance", tenant.getAdvanceBalance());
        res.put("settledInvoicesCount", createdPayments.size());
        res.put("payments", createdPayments);

        return ResponseEntity.ok(res);
    }

    @GetMapping("/tenants/{tenantId}/invoices/{invoiceId}/payments")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getInvoicePayments(@PathVariable UUID tenantId, @PathVariable UUID invoiceId) {
        Tenant tenant;
        try {
            tenant = getAuthorizedTenant(tenantId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Invoice invoice = invoiceRepository.findByIdAndTenant(invoiceId, tenant).orElse(null);
        if (invoice == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Invoice record not found."));
        }

        List<Payment> payments = paymentRepository.findByInvoice(invoice);
        return ResponseEntity.ok(payments);
    }

    @PostMapping("/payments")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createPaymentRecord(@RequestBody java.util.Map<String, Object> req) {
        Organization organization = getLoggedUserOrg();
        
        String propertyIdStr = (String) req.get("propertyId");
        String receiptNumber = (String) req.get("receiptNumber");
        if (receiptNumber == null || receiptNumber.isBlank()) {
            Property property = null;
            if (propertyIdStr != null && !propertyIdStr.isBlank()) {
                try {
                    property = propertyRepository.findById(UUID.fromString(propertyIdStr)).orElse(null);
                } catch (Exception ignored) {}
            }
            receiptNumber = invoiceSequenceService.nextReceiptNumber(property, organization);
        }
        BigDecimal amount = new BigDecimal(req.get("amount") != null ? req.get("amount").toString() : "0");
        String method = (String) req.get("method");
        String status = (String) req.get("status");
        String dateStr = (String) req.get("date");
        String collectedBy = (String) req.get("collectedBy");
        String paymentReference = (String) req.get("paymentReference");

        String tenantIdStr = (String) req.get("tenantId");
        Tenant tenant = null;
        if (tenantIdStr != null && !tenantIdStr.isBlank()) {
            try {
                tenant = tenantRepository.findById(UUID.fromString(tenantIdStr)).orElse(null);
            } catch (Exception ignored) {}
        }
        if (tenant != null && tenant.getOrganization() == null) {
            tenant.setOrganization(organization);
            tenant = tenantRepository.save(tenant);
        }

        // Find or associate an invoice for this payment
        Invoice invoice = null;
        String invoiceIdStr = (String) req.get("invoiceId");
        if (invoiceIdStr != null && !invoiceIdStr.isBlank()) {
            try {
                invoice = invoiceRepository.findById(UUID.fromString(invoiceIdStr)).orElse(null);
            } catch (Exception ignored) {}
        }

        BigDecimal unallocatedAmount = amount;
        Invoice primaryInvoice = invoice;

        if (tenant != null) {
            List<Invoice> tenantInvoices = invoiceRepository.findByTenant(tenant);
            // Sort FIFO: Oldest issue date first, Base Rent before Utilities
            List<Invoice> unpaidInvoices = tenantInvoices.stream()
                    .filter(i -> i != null && !"PAID".equalsIgnoreCase(i.getStatus()))
                    .sorted((a, b) -> {
                        LocalDate dateA = a.getIssueDate() != null ? a.getIssueDate() : a.getDueDate();
                        LocalDate dateB = b.getIssueDate() != null ? b.getIssueDate() : b.getDueDate();
                        if (dateA != null && dateB != null && !dateA.equals(dateB)) {
                            return dateA.compareTo(dateB);
                        }
                        boolean isUtilA = a.getInvoiceNumber() != null && a.getInvoiceNumber().startsWith("UTIL");
                        boolean isUtilB = b.getInvoiceNumber() != null && b.getInvoiceNumber().startsWith("UTIL");
                        return Boolean.compare(isUtilA, isUtilB);
                    })
                    .collect(java.util.stream.Collectors.toList());

            // If a specific invoice was selected, process it first
            if (primaryInvoice != null && unpaidInvoices.contains(primaryInvoice)) {
                unpaidInvoices.remove(primaryInvoice);
                unpaidInvoices.add(0, primaryInvoice);
            }

            for (Invoice inv : unpaidInvoices) {
                if (unallocatedAmount.compareTo(BigDecimal.ZERO) <= 0) break;
                BigDecimal currentPaid = inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO;
                BigDecimal remainingDue = inv.getAmountDue().subtract(currentPaid);
                if (remainingDue.compareTo(BigDecimal.ZERO) <= 0) continue;

                if (primaryInvoice == null) {
                    primaryInvoice = inv;
                }

                if (unallocatedAmount.compareTo(remainingDue) >= 0) {
                    // Fully settle this invoice
                    inv.setAmountPaid(inv.getAmountDue());
                    inv.setStatus("PAID");
                    unallocatedAmount = unallocatedAmount.subtract(remainingDue);
                } else {
                    // Partially settle this invoice
                    inv.setAmountPaid(currentPaid.add(unallocatedAmount));
                    inv.setStatus("PARTIALLY_PAID");
                    unallocatedAmount = BigDecimal.ZERO;
                }
                invoiceRepository.save(inv);
            }
        }

        // If there's surplus amount remaining after settling all unpaid invoices, credit to Advance Balance
        if (unallocatedAmount.compareTo(BigDecimal.ZERO) > 0 && tenant != null) {
            tenant.setAdvanceBalance(tenant.getAdvanceBalance().add(unallocatedAmount));
            tenant = tenantRepository.save(tenant);

            if (primaryInvoice == null) {
                String advInvoiceNo = "ADV-" + invoiceSequenceService.nextRentalInvoiceNumber(tenant);
                primaryInvoice = new Invoice(tenant, advInvoiceNo, java.time.LocalDate.now().plusDays(30), java.time.LocalDate.now(), unallocatedAmount);
                primaryInvoice.setStatus("PAID");
                primaryInvoice.setAmountPaid(unallocatedAmount);
                primaryInvoice.setPaymentMethod(method != null ? method.toUpperCase() : "CASH");
                primaryInvoice.setPaymentReference(paymentReference != null ? paymentReference : "ADV-RCPT-" + System.currentTimeMillis());
                primaryInvoice = invoiceRepository.save(primaryInvoice);
            }
        }

        if (primaryInvoice == null) {
            // Fallback if no prior invoices or tenants exist
            if (tenant == null) {
                List<Tenant> tenants = tenantRepository.findByOrganization(organization);
                if (tenants.isEmpty()) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Error: Please register at least one tenant before recording payments."));
                }
                tenant = tenants.get(0);
            }
            String fallbackInvNo = "INV-RCPT-" + System.currentTimeMillis();
            primaryInvoice = new Invoice(tenant, fallbackInvNo, java.time.LocalDate.now().plusDays(30), java.time.LocalDate.now(), amount);
            primaryInvoice.setStatus("PAID");
            primaryInvoice.setAmountPaid(amount);
            primaryInvoice = invoiceRepository.save(primaryInvoice);
        }

        invoice = primaryInvoice;

        Payment payment = new Payment(invoice, amount, method != null ? method.toUpperCase() : "CASH");
        payment.setReceiptNumber(receiptNumber);
        payment.setTransactionReference(paymentReference != null ? paymentReference : "REF-" + System.currentTimeMillis());
        payment.setStatus(status != null && status.equalsIgnoreCase("success") ? "COMPLETED" : "PENDING");
        payment.setReceiptUrl("https://stayeaze-receipts.s3.amazonaws.com/receipts/" + receiptNumber.replaceAll("[/\\\\\\s]", "-") + ".pdf");
        payment.setPaymentDate(java.time.OffsetDateTime.now());

        Payment saved = paymentRepository.save(payment);

        String tenantName = (String) req.get("tenantName");
        if (tenantName == null || tenantName.isBlank()) {
            if (invoice != null && invoice.getTenant() != null) {
                tenantName = (invoice.getTenant().getFirstName() + " " + (invoice.getTenant().getLastName() != null ? invoice.getTenant().getLastName() : "")).trim();
            } else {
                tenantName = "Tenant";
            }
        }

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("id", saved.getId());
        res.put("receiptNumber", receiptNumber);
        res.put("tenantName", tenantName);
        res.put("propertyId", propertyIdStr);
        res.put("amount", amount);
        res.put("method", method != null ? method.toLowerCase() : "cash");
        res.put("status", status != null ? status.toLowerCase() : "success");
        res.put("date", dateStr != null ? dateStr : java.time.LocalDate.now().toString());
        res.put("collectedBy", collectedBy != null ? collectedBy : "Manager");
        res.put("paymentReference", paymentReference);

        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @GetMapping("/payments")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ACCOUNTANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getFlatPayments(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<Payment> rawPayments = paymentRepository.findByOrganizationId(organization.getId());

        java.util.List<java.util.Map<String, Object>> mapped = new java.util.ArrayList<>();
        for (Payment p : rawPayments) {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", p.getId());
            m.put("receiptNumber", p.getReceiptNumber() != null ? p.getReceiptNumber() : ("REC/PROP/2026-27/" + (p.getId().toString().substring(0, 4).toUpperCase())));
            m.put("invoiceId", p.getInvoice() != null ? p.getInvoice().getId().toString() : "");
            
            Tenant tenant = p.getInvoice() != null ? p.getInvoice().getTenant() : null;
            m.put("tenantName", tenant != null ? tenant.getFirstName() + " " + tenant.getLastName() : "Tenant");
            
            String propIdStr = "";
            if (tenant != null && tenant.getPropertyId() != null) {
                propIdStr = tenant.getPropertyId().toString();
            }
            m.put("propertyId", propIdStr);

            m.put("amount", p.getAmount());
            m.put("method", p.getPaymentMethod() != null ? p.getPaymentMethod().toLowerCase() : "cash");
            m.put("status", "COMPLETED".equalsIgnoreCase(p.getStatus()) ? "success" : "pending");
            m.put("date", p.getPaymentDate() != null ? p.getPaymentDate().toLocalDate().toString() : java.time.LocalDate.now().toString());
            m.put("collectedBy", "Property Admin");
            m.put("paymentReference", p.getTransactionReference());
            m.put("razorpayPaymentId", p.getTransactionReference());

            mapped.add(m);
        }

        // Include any paid invoices (check-ins, advance deposits) not yet having a separate payment row
        try {
            java.util.Set<UUID> existingInvoiceIds = rawPayments.stream()
                    .filter(p -> p.getInvoice() != null)
                    .map(p -> p.getInvoice().getId())
                    .collect(java.util.stream.Collectors.toSet());

            List<Invoice> orgInvoices = invoiceRepository.findByOrganizationId(organization.getId());
            if (orgInvoices != null) {
                for (Invoice inv : orgInvoices) {
                    if (inv != null && "PAID".equalsIgnoreCase(inv.getStatus()) && !existingInvoiceIds.contains(inv.getId())) {
                        java.util.Map<String, Object> m = new java.util.HashMap<>();
                        m.put("id", inv.getId());
                        m.put("receiptNumber", "REC-" + (inv.getInvoiceNumber() != null ? inv.getInvoiceNumber().replace("INV-", "") : inv.getId().toString().substring(0, 6).toUpperCase()));
                        m.put("invoiceId", inv.getId().toString());

                        Tenant tenant = inv.getTenant();
                        m.put("tenantName", tenant != null ? (tenant.getFirstName() + " " + tenant.getLastName()).trim() : "Tenant");
                        m.put("propertyId", tenant != null && tenant.getPropertyId() != null ? tenant.getPropertyId().toString() : "");
                        m.put("amount", inv.getAmountPaid() != null ? inv.getAmountPaid() : inv.getAmountDue());
                        m.put("method", inv.getPaymentMethod() != null ? inv.getPaymentMethod().toLowerCase() : "cash");
                        m.put("status", "success");
                        m.put("date", inv.getIssueDate() != null ? inv.getIssueDate().toString() : java.time.LocalDate.now().toString());
                        m.put("collectedBy", "Reception Desk");
                        m.put("paymentReference", inv.getPaymentReference() != null ? inv.getPaymentReference() : ("REC-" + (inv.getInvoiceNumber() != null ? inv.getInvoiceNumber() : "DIRECT")));
                        m.put("razorpayPaymentId", inv.getRazorpayPaymentId());

                        mapped.add(m);
                    }
                }
            }
        } catch (Exception ignored) {}

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            mapped = mapped.stream().filter(m -> {
                Object pId = m.get("propertyId");
                if (pId == null || pId.toString().isBlank()) return false;
                try {
                    return assignedProps.contains(UUID.fromString(pId.toString()));
                } catch (Exception e) {
                    return false;
                }
            }).collect(java.util.stream.Collectors.toList());
        }

        if (propertyId != null) {
            mapped = mapped.stream().filter(m -> {
                Object pId = m.get("propertyId");
                return pId != null && propertyId.toString().equalsIgnoreCase(pId.toString());
            }).collect(java.util.stream.Collectors.toList());
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(mapped, page, pageSize));
    }

    @PutMapping("/payments/{id}")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updatePaymentRecord(@PathVariable UUID id, @RequestBody java.util.Map<String, Object> req) {
        return ResponseEntity.badRequest().body(new MessageResponse("Payment receipts and transactions are immutable and cannot be edited."));
    }

    @DeleteMapping("/payments/{id}")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deletePaymentRecord(@PathVariable UUID id) {
        com.stayeaze.backend.models.Payment payment = paymentRepository.findById(id).orElse(null);
        if (payment == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Payment record not found"));
        }

        // Multi-tenant check
        if (!securityUtils.isSuperAdmin()) {
            Organization loggedOrg = getLoggedUserOrg();
            if (payment.getInvoice() != null && payment.getInvoice().getTenant() != null &&
                payment.getInvoice().getTenant().getOrganization() != null && loggedOrg != null &&
                !payment.getInvoice().getTenant().getOrganization().getId().equals(loggedOrg.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized: Payment belongs to another organization"));
            }
        }

        if (payment.getRazorpayPaymentId() != null && !payment.getRazorpayPaymentId().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Online gateway transactions are permanent and cannot be deleted. Please initiate a refund instead."));
        }

        // Rebalance linked invoice
        Invoice linkedInvoice = payment.getInvoice();
        if (linkedInvoice != null && payment.getAmount() != null) {
            BigDecimal currentPaid = linkedInvoice.getAmountPaid() != null ? linkedInvoice.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal newPaid = currentPaid.subtract(payment.getAmount());
            if (newPaid.compareTo(BigDecimal.ZERO) < 0) {
                newPaid = BigDecimal.ZERO;
            }
            linkedInvoice.setAmountPaid(newPaid);

            BigDecimal due = linkedInvoice.getAmountDue() != null ? linkedInvoice.getAmountDue() : BigDecimal.ZERO;
            if (newPaid.compareTo(BigDecimal.ZERO) <= 0) {
                linkedInvoice.setStatus("UNPAID");
            } else if (newPaid.compareTo(due) < 0) {
                linkedInvoice.setStatus("PARTIALLY_PAID");
            } else {
                linkedInvoice.setStatus("PAID");
            }
            invoiceRepository.save(linkedInvoice);
        }

        paymentRepository.delete(payment);
        return ResponseEntity.ok(new MessageResponse("Payment deleted successfully and linked invoice balance restored."));
    }
}
