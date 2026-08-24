package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.PaymentRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PaymentRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
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
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.services.UserJourneyAuditService userJourneyAuditService;

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

    @PostMapping("/tenants/{tenantId}/invoices/{invoiceId}/payments")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
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

        // Ledger reconciliation
        BigDecimal currentPaid = invoice.getAmountPaid().add(request.getAmount());
        invoice.setAmountPaid(currentPaid);

        if (currentPaid.compareTo(invoice.getAmountDue()) >= 0) {
            invoice.setStatus("PAID");
        } else if (currentPaid.compareTo(BigDecimal.ZERO) > 0) {
            invoice.setStatus("PARTIALLY_PAID");
        }

        invoiceRepository.save(invoice);

        // Record payment transaction
        Payment payment = new Payment(invoice, request.getAmount(), request.getPaymentMethod());
        payment.setTransactionReference(request.getTransactionReference());
        
        // Mock receipt URL link
        String receiptNumber = "REC-" + System.currentTimeMillis();
        payment.setReceiptUrl("https://stayeaze-receipts.s3.amazonaws.com/receipts/" + receiptNumber + ".pdf");

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
                java.util.Map.of("invoiceId", invoiceId.toString(), "method", request.getPaymentMethod(), "transactionRef", request.getTransactionReference() != null ? request.getTransactionReference() : ""),
                null
        );

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
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
        
        String receiptNumber = (String) req.get("receiptNumber");
        if (receiptNumber == null || receiptNumber.isBlank()) {
            receiptNumber = "RCPT-" + System.currentTimeMillis();
        }

        String tenantName = (String) req.get("tenantName");
        String propertyIdStr = (String) req.get("propertyId");
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

        if (invoice == null && tenant != null) {
            List<Invoice> tenantInvoices = invoiceRepository.findByTenant(tenant);
            invoice = tenantInvoices.stream()
                    .filter(i -> i != null && !"PAID".equalsIgnoreCase(i.getStatus()))
                    .findFirst()
                    .orElse(null);
            if (invoice != null) {
                BigDecimal currentPaid = (invoice.getAmountPaid() != null ? invoice.getAmountPaid() : BigDecimal.ZERO).add(amount);
                invoice.setAmountPaid(currentPaid);
                if (currentPaid.compareTo(invoice.getAmountDue()) >= 0) {
                    invoice.setStatus("PAID");
                } else if (currentPaid.compareTo(BigDecimal.ZERO) > 0) {
                    invoice.setStatus("PARTIALLY_PAID");
                }
                invoice = invoiceRepository.save(invoice);
            }
        }

        if (invoice == null) {
            if (tenant == null) {
                List<Tenant> tenants = tenantRepository.findByOrganization(organization);
                if (tenants.isEmpty()) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Error: Please register at least one tenant before recording payments."));
                }
                tenant = tenants.get(0);
            }

            // Record as Advance Rent Credit Balance for the Tenant
            tenant.setAdvanceBalance(tenant.getAdvanceBalance().add(amount));
            tenant = tenantRepository.save(tenant);

            String advInvoiceNo = "ADV-" + invoiceSequenceService.nextRentalInvoiceNumber(tenant);
            invoice = new Invoice(tenant, advInvoiceNo, java.time.LocalDate.now().plusDays(30), java.time.LocalDate.now(), amount);
            invoice.setStatus("PAID");
            invoice.setAmountPaid(amount);
            invoice.setPaymentMethod(method != null ? method.toUpperCase() : "CASH");
            invoice.setPaymentReference(paymentReference != null ? paymentReference : "ADV-RCPT-" + System.currentTimeMillis());
            invoice = invoiceRepository.save(invoice);
        }

        Payment payment = new Payment(invoice, amount, method != null ? method.toUpperCase() : "CASH");
        payment.setTransactionReference(paymentReference != null ? paymentReference : "REF-" + System.currentTimeMillis());
        payment.setStatus(status != null && status.equalsIgnoreCase("success") ? "COMPLETED" : "PENDING");
        payment.setReceiptUrl("https://stayeaze-receipts.s3.amazonaws.com/receipts/" + receiptNumber + ".pdf");
        payment.setPaymentDate(java.time.OffsetDateTime.now());

        Payment saved = paymentRepository.save(payment);

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("id", saved.getId());
        res.put("receiptNumber", receiptNumber);
        res.put("tenantName", tenantName != null ? tenantName : (invoice.getTenant() != null ? invoice.getTenant().getFirstName() + " " + invoice.getTenant().getLastName() : "Tenant"));
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
            @RequestParam(required = false) String status) {
        Organization organization = getLoggedUserOrg();
        List<Payment> rawPayments = paymentRepository.findByOrganizationId(organization.getId());

        java.util.List<java.util.Map<String, Object>> mapped = new java.util.ArrayList<>();
        for (Payment p : rawPayments) {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", p.getId());
            m.put("receiptNumber", "RCPT-" + (p.getId().toString().substring(0, 6).toUpperCase()));
            m.put("invoiceId", p.getInvoice() != null ? p.getInvoice().getId().toString() : "");
            
            Tenant tenant = p.getInvoice() != null ? p.getInvoice().getTenant() : null;
            m.put("tenantName", tenant != null ? tenant.getFirstName() + " " + tenant.getLastName() : "Tenant");
            
            String propertyId = "";
            if (tenant != null && tenant.getPropertyId() != null) {
                propertyId = tenant.getPropertyId().toString();
            }
            m.put("propertyId", propertyId);

            m.put("amount", p.getAmount());
            m.put("method", p.getPaymentMethod() != null ? p.getPaymentMethod().toLowerCase() : "cash");
            m.put("status", "COMPLETED".equalsIgnoreCase(p.getStatus()) ? "success" : "pending");
            m.put("date", p.getPaymentDate() != null ? p.getPaymentDate().toLocalDate().toString() : java.time.LocalDate.now().toString());
            m.put("collectedBy", "Property Admin");
            m.put("paymentReference", p.getTransactionReference());
            m.put("razorpayPaymentId", p.getTransactionReference());

            mapped.add(m);
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
    @PreAuthorize("hasRole('OWNER') or hasRole('ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deletePaymentRecord(@PathVariable UUID id) {
        if (!paymentRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Payment record not found"));
        }
        paymentRepository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("Payment deleted successfully"));
    }
}
