package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.services.SubscriptionEnforcementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/billing")
public class BulkRentRunController {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private SubscriptionEnforcementService enforcementService;

    @Autowired
    private com.stayeaze.backend.services.AutoBillingService autoBillingService;

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

    @PostMapping({"/monthly-rent-run", "/monthly-rent-run/"})
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
    @Transactional
    public ResponseEntity<?> executeMonthlyRentRun(@RequestBody Map<String, Object> request) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new MessageResponse("Error: User does not belong to an active organization."));
        }

        try {
            enforcementService.validateOperationalAccess(org);
            enforcementService.validateBulkRentRunAccess(org);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(new MessageResponse(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse(e.getMessage()));
        }

        LocalDate now = LocalDate.now();
        int billingMonth = request.containsKey("billingMonth") ? Integer.parseInt(request.get("billingMonth").toString()) : now.getMonthValue();
        int billingYear = request.containsKey("billingYear") ? Integer.parseInt(request.get("billingYear").toString()) : now.getYear();
        int dueDateDays = request.containsKey("dueDateDays") ? Integer.parseInt(request.get("dueDateDays").toString()) : 5;

        UUID targetPropertyId = null;
        if (request.containsKey("propertyId") && request.get("propertyId") != null && !request.get("propertyId").toString().isBlank()) {
            try {
                targetPropertyId = UUID.fromString(request.get("propertyId").toString());
            } catch (Exception ignored) {}
        }

        if (billingMonth < 1 || billingMonth > 12) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid billing month (1-12)."));
        }
        if (billingYear < 2020 || billingYear > 2035) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid billing year."));
        }

        String monthName = Month.of(billingMonth).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        LocalDate issueDate = LocalDate.of(billingYear, billingMonth, 1);
        int maxDaysInMonth = issueDate.lengthOfMonth();
        LocalDate dueDate = LocalDate.of(billingYear, billingMonth, Math.min(dueDateDays, maxDaysInMonth));

        // 1. Single batch fetch of active tenants
        List<Tenant> rawTenants = tenantRepository.findByOrganizationIdNative(org.getId());
        if (rawTenants.isEmpty()) {
            rawTenants = tenantRepository.findByOrganization(org);
        }

        List<Tenant> activeTenants = rawTenants.stream()
                .filter(t -> "ACTIVE".equalsIgnoreCase(t.getStatus()))
                .filter(t -> !"CORPORATE_SPONSORED".equalsIgnoreCase(t.getBillingResponsibility()))
                .filter(t -> t.getRent() != null && t.getRent().compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList());

        if (targetPropertyId != null) {
            securityUtils.validatePropertyAccess(targetPropertyId);
            final UUID pId = targetPropertyId;
            activeTenants = activeTenants.stream()
                    .filter(t -> pId.equals(t.getPropertyId()))
                    .collect(Collectors.toList());
        } else {
            Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
            if (assignedProps != null) {
                activeTenants = activeTenants.stream()
                        .filter(t -> t.getPropertyId() != null && assignedProps.contains(t.getPropertyId()))
                        .collect(Collectors.toList());
            }
        }

        List<Invoice> newInvoices = new ArrayList<>();
        List<Tenant> updatedTenants = new ArrayList<>();

        BigDecimal totalBillingAmount = BigDecimal.ZERO;
        BigDecimal totalAdvanceOffset = BigDecimal.ZERO;
        BigDecimal totalDueRemaining = BigDecimal.ZERO;

        for (Tenant tenant : activeTenants) {
            // Cycle Guard 1: Skip if resident's lease starts in a future month
            if (tenant.getLeaseStart() != null && !tenant.getLeaseStart().isBlank()) {
                try {
                    LocalDate leaseStart = LocalDate.parse(tenant.getLeaseStart());
                    LocalDate endOfBillingMonth = LocalDate.of(billingYear, billingMonth, maxDaysInMonth);
                    if (leaseStart.isAfter(endOfBillingMonth)) {
                        continue;
                    }
                } catch (Exception ignored) {}
            }

            // Cycle Guard 2: Skip if resident's lease already ended before this billing cycle
            if (tenant.getLeaseEnd() != null && !tenant.getLeaseEnd().isBlank()) {
                try {
                    LocalDate leaseEnd = LocalDate.parse(tenant.getLeaseEnd());
                    LocalDate startOfBillingMonth = LocalDate.of(billingYear, billingMonth, 1);
                    if (leaseEnd.isBefore(startOfBillingMonth)) {
                        continue;
                    }
                } catch (Exception ignored) {}
            }

            String invNumber = String.format("INV-%d%02d-%s", billingYear, billingMonth,
                    tenant.getId().toString().substring(0, 8).toUpperCase());

            // Check if invoice already exists for this cycle or if onboarding invoice was already generated for this cycle
            boolean alreadyExists = invoiceRepository.findByTenant(tenant).stream()
                    .anyMatch(i -> {
                        if (invNumber.equalsIgnoreCase(i.getInvoiceNumber())) return true;
                        LocalDate iDate = i.getIssueDate() != null ? i.getIssueDate() : i.getDueDate();
                        boolean isRent = i.getInvoiceNumber() == null || !i.getInvoiceNumber().startsWith("UTIL");
                        return isRent && iDate != null && iDate.getYear() == billingYear && iDate.getMonthValue() == billingMonth;
                    });

            if (alreadyExists) {
                continue;
            }

            BigDecimal rentAmount = tenant.getRent();
            String itemDesc = String.format("Monthly Rent — %s %d (Room: %s, Bed: %s)",
                    monthName, billingYear,
                    tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "N/A",
                    tenant.getBedNumber() != null ? tenant.getBedNumber() : "N/A");

            // Mid-Month Move-In Proration (P0.2)
            if (tenant.getLeaseStart() != null && !tenant.getLeaseStart().isBlank()) {
                try {
                    LocalDate leaseStart = LocalDate.parse(tenant.getLeaseStart());
                    if (leaseStart.getYear() == billingYear && leaseStart.getMonthValue() == billingMonth && leaseStart.getDayOfMonth() > 1) {
                        int startDay = leaseStart.getDayOfMonth();
                        int remainingDays = maxDaysInMonth - startDay + 1;
                        rentAmount = tenant.getRent()
                                .multiply(BigDecimal.valueOf(remainingDays))
                                .divide(BigDecimal.valueOf(maxDaysInMonth), 0, java.math.RoundingMode.HALF_UP);
                        itemDesc = String.format("Pro-Rata Rent (%d days: %s %d–%d) — Room: %s, Bed: %s",
                                remainingDays, monthName, startDay, maxDaysInMonth,
                                tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "N/A",
                                tenant.getBedNumber() != null ? tenant.getBedNumber() : "N/A");
                    }
                } catch (Exception ignored) {}
            }

            BigDecimal advance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;

            BigDecimal paidFromAdvance = BigDecimal.ZERO;
            String status = "UNPAID";

            if (advance.compareTo(BigDecimal.ZERO) > 0) {
                if (advance.compareTo(rentAmount) >= 0) {
                    paidFromAdvance = rentAmount;
                    tenant.setAdvanceBalance(advance.subtract(rentAmount));
                    status = "PAID";
                } else {
                    paidFromAdvance = advance;
                    tenant.setAdvanceBalance(BigDecimal.ZERO);
                    status = "PARTIALLY_PAID";
                }
                updatedTenants.add(tenant);
            }

            BigDecimal remainingDue = rentAmount.subtract(paidFromAdvance);

            totalBillingAmount = totalBillingAmount.add(rentAmount);
            totalAdvanceOffset = totalAdvanceOffset.add(paidFromAdvance);
            totalDueRemaining = totalDueRemaining.add(remainingDue);

            Invoice invoice = new Invoice();
            invoice.setTenant(tenant);
            invoice.setInvoiceNumber(invNumber);
            invoice.setIssueDate(issueDate);
            invoice.setDueDate(dueDate);
            invoice.setAmountDue(rentAmount);
            invoice.setAmountPaid(paidFromAdvance);
            invoice.setStatus(status);
            invoice.setPaymentMethod(paidFromAdvance.compareTo(BigDecimal.ZERO) > 0 ? "ADVANCE_OFFSET" : "CASH");

            InvoiceItem item = new InvoiceItem(invoice, itemDesc, rentAmount);

            invoice.getItems().add(item);
            newInvoices.add(invoice);
        }

        if (!updatedTenants.isEmpty()) {
            tenantRepository.saveAll(updatedTenants);
        }
        if (!newInvoices.isEmpty()) {
            List<Invoice> savedInvoices = invoiceRepository.saveAll(newInvoices);
            List<Payment> advancePayments = new ArrayList<>();
            for (Invoice inv : savedInvoices) {
                if (inv.getAmountPaid() != null && inv.getAmountPaid().compareTo(BigDecimal.ZERO) > 0) {
                    Payment p = new Payment(inv, inv.getAmountPaid(), "ADVANCE_OFFSET");
                    p.setStatus("COMPLETED");
                    p.setPaymentDate(java.time.OffsetDateTime.now());
                    p.setTransactionReference("ADV-OFFSET-" + billingYear + String.format("%02d", billingMonth) + "-" + (inv.getTenant() != null ? inv.getTenant().getId().toString().substring(0, 6).toUpperCase() : "TENANT"));
                    advancePayments.add(p);
                }
            }
            if (!advancePayments.isEmpty()) {
                paymentRepository.saveAll(advancePayments);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("month", monthName);
        result.put("year", billingYear);
        result.put("totalTenantsEvaluated", activeTenants.size());
        result.put("invoicesGenerated", newInvoices.size());
        result.put("totalBillingAmount", totalBillingAmount);
        result.put("totalAdvanceOffset", totalAdvanceOffset);
        result.put("totalDueRemaining", totalDueRemaining);
        result.put("message", String.format("Successfully generated %d invoice(s) for %s %d. Advance adjusted: ₹%s, Balance due: ₹%s.",
                newInvoices.size(), monthName, billingYear, totalAdvanceOffset, totalDueRemaining));

        return ResponseEntity.ok(result);
    }

    @PostMapping("/evaluate-late-fees")
    public ResponseEntity<?> triggerLateFeeAccrual() {
        Map<String, Object> res = autoBillingService.autoAccrueLateFees();
        return ResponseEntity.ok(res);
    }

    /**
     * P2.1: Dry-run preview of the monthly rent batch.
     * Returns a per-tenant breakdown of what invoices WOULD be generated without committing anything.
     * Accepts optional excludeTenantIds[] to simulate selective exclusion.
     */
    @PostMapping("/rent-run-preview")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
    public ResponseEntity<?> previewMonthlyRentRun(@RequestBody Map<String, Object> request) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new MessageResponse("Error: User does not belong to an active organization."));
        }

        LocalDate now = LocalDate.now();
        int billingMonth = request.containsKey("billingMonth") ? Integer.parseInt(request.get("billingMonth").toString()) : now.getMonthValue();
        int billingYear  = request.containsKey("billingYear")  ? Integer.parseInt(request.get("billingYear").toString())  : now.getYear();
        int dueDateDays  = request.containsKey("dueDateDays")  ? Integer.parseInt(request.get("dueDateDays").toString())  : 5;

        UUID targetPropertyId = null;
        if (request.containsKey("propertyId") && request.get("propertyId") != null && !request.get("propertyId").toString().isBlank()) {
            try { targetPropertyId = UUID.fromString(request.get("propertyId").toString()); } catch (Exception ignored) {}
        }

        List<UUID> excludeIds = new ArrayList<>();
        if (request.containsKey("excludeTenantIds") && request.get("excludeTenantIds") instanceof List<?> raw) {
            for (Object item : raw) {
                try { excludeIds.add(UUID.fromString(item.toString())); } catch (Exception ignored) {}
            }
        }

        if (billingMonth < 1 || billingMonth > 12) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid billing month (1-12)."));
        }

        try {
            List<Map<String, Object>> preview = autoBillingService.previewRentRun(
                    org, billingMonth, billingYear, dueDateDays, targetPropertyId, excludeIds);

            String monthName = java.time.Month.of(billingMonth).getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH);
            BigDecimal totalCalcRent = preview.stream()
                    .map(r -> (BigDecimal) r.get("calculatedRent"))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalNetDue = preview.stream()
                    .map(r -> (BigDecimal) r.get("netDue"))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalAdvance = preview.stream()
                    .map(r -> (BigDecimal) r.get("advanceOffset"))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> result = new HashMap<>();
            result.put("dryRun", true);
            result.put("month", monthName);
            result.put("year", billingYear);
            result.put("tenantCount", preview.size());
            result.put("totalCalculatedRent", totalCalcRent);
            result.put("totalAdvanceOffset", totalAdvance);
            result.put("totalNetDue", totalNetDue);
            result.put("tenants", preview);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Preview failed: " + e.getMessage()));
        }
    }
}

