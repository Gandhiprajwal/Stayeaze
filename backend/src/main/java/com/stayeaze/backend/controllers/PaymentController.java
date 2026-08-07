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
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping("/tenants/{tenantId}/invoices/{invoiceId}/payments")
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

    @GetMapping("/payments")
    public ResponseEntity<?> getFlatPayments() {
        Organization organization = getLoggedUserOrg();
        List<Payment> payments = paymentRepository.findByOrganizationId(organization.getId());
        return ResponseEntity.ok(payments);
    }
}
