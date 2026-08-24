package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping({"/api/v1/accountant", "/api/v1/reports"})
public class AccountantPortalController {

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    private boolean isSuperAdminUser() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return false;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities() != null) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") || a.getAuthority().equalsIgnoreCase("SUPER_ADMIN"));
        }
        return false;
    }

    private Organization getLoggedUserOrg() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                    ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                    : null;

            if (principal instanceof UserDetailsImpl userDetails) {
                if (userDetails.getOrgId() != null) {
                    Organization org = organizationRepository.findById(userDetails.getOrgId()).orElse(null);
                    if (org != null) return org;
                }
            }
        } catch (Exception ignored) {}

        // Fallback for Super Admin preview or first organization
        return organizationRepository.findAll().stream().findFirst().orElse(null);
    }

    /**
     * Resolves the set of authorized property IDs for the requesting user.
     */
    private Set<UUID> getAuthorizedPropertyIds(UUID filterPropertyId) {
        Set<UUID> userAssigned = new HashSet<>();
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                    ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                    : null;
            if (principal instanceof UserDetailsImpl userDetails) {
                User user = userRepository.findById(userDetails.getId()).orElse(null);
                if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                    for (UUID pId : user.getPropertyIds()) {
                        if (pId != null) userAssigned.add(pId);
                    }
                }
            }
        } catch (Exception ignored) {}

        if (filterPropertyId != null) {
            if (!userAssigned.isEmpty() && !userAssigned.contains(filterPropertyId)) {
                return Collections.emptySet();
            }
            Set<UUID> single = new HashSet<>();
            single.add(filterPropertyId);
            return single;
        }

        return userAssigned.isEmpty() ? null : userAssigned;
    }

    // 1. Accountant Overview Financial Summary (Property-isolated & Null-Safe)
    @GetMapping("/overview")
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getAccountantOverview(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            Map<String, Object> emptySummary = new HashMap<>();
            emptySummary.put("totalCollections", BigDecimal.ZERO);
            emptySummary.put("totalExpenses", BigDecimal.ZERO);
            emptySummary.put("netCashFlow", BigDecimal.ZERO);
            emptySummary.put("totalEscrowDeposit", BigDecimal.ZERO);
            emptySummary.put("pendingRefundCount", 0L);
            emptySummary.put("estimatedGstLiability", BigDecimal.ZERO);
            emptySummary.put("activeTenantsCount", 0L);
            return ResponseEntity.ok(emptySummary);
        }

        UUID orgId = org.getId();
        Set<UUID> propIds = getAuthorizedPropertyIds(propertyId);

        List<Payment> payments = paymentRepository.findByOrganizationId(orgId);
        if (payments == null) payments = Collections.emptyList();
        if (propIds != null) {
            payments = payments.stream()
                    .filter(p -> p.getInvoice() != null && p.getInvoice().getTenant() != null &&
                            p.getInvoice().getTenant().getPropertyId() != null &&
                            propIds.contains(p.getInvoice().getTenant().getPropertyId()))
                    .collect(Collectors.toList());
        }

        BigDecimal paymentSum = payments.stream()
                .filter(p -> p != null && p.getStatus() != null && ("COMPLETED".equalsIgnoreCase(p.getStatus()) || "SUCCESS".equalsIgnoreCase(p.getStatus()) || "PAID".equalsIgnoreCase(p.getStatus())))
                .map(Payment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Expense> expenses = expenseRepository.findByOrganizationOrderByExpenseDateDesc(org);
        if (expenses == null) expenses = Collections.emptyList();
        if (propIds != null) {
            expenses = expenses.stream()
                    .filter(e -> e != null && e.getProperty() != null && e.getProperty().getId() != null && propIds.contains(e.getProperty().getId()))
                    .collect(Collectors.toList());
        }

        BigDecimal totalExpenses = expenses.stream()
                .filter(Objects::nonNull)
                .map(Expense::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Tenant> tenants = tenantRepository.findByOrganization(org);
        if (tenants == null) tenants = Collections.emptyList();
        if (propIds != null) {
            tenants = tenants.stream()
                    .filter(t -> t != null && t.getPropertyId() != null && propIds.contains(t.getPropertyId()))
                    .collect(Collectors.toList());
        }

        BigDecimal totalEscrowDeposit = tenants.stream()
                .filter(Objects::nonNull)
                .map(Tenant::getDeposit)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long pendingRefundCount = tenants.stream()
                .filter(t -> t != null && t.getStatus() != null && ("notice_period".equalsIgnoreCase(t.getStatus()) || "checked_out".equalsIgnoreCase(t.getStatus())))
                .count();

        List<Invoice> invoices = invoiceRepository.findByOrganizationIdNative(orgId);
        if (invoices == null) invoices = Collections.emptyList();
        if (propIds != null) {
            invoices = invoices.stream()
                    .filter(inv -> inv != null && inv.getTenant() != null && inv.getTenant().getPropertyId() != null && propIds.contains(inv.getTenant().getPropertyId()))
                    .collect(Collectors.toList());
        }

        BigDecimal paidInvoiceSum = invoices.stream()
                .filter(inv -> inv != null && inv.getAmountPaid() != null)
                .map(Invoice::getAmountPaid)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Combined Collections: Ensures revenue is not 0 if invoices were marked paid
        BigDecimal totalCollections = paymentSum.compareTo(paidInvoiceSum) > 0 ? paymentSum : paidInvoiceSum;

        BigDecimal totalBilled = invoices.stream()
                .filter(Objects::nonNull)
                .map(Invoice::getAmountDue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean isGstEnabled = Boolean.TRUE.equals(org.getGstEnabled());
        BigDecimal defaultGstRate = org.getDefaultGstRate() != null ? org.getDefaultGstRate() : new BigDecimal("18.00");
        BigDecimal gstMultiplier = defaultGstRate.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);

        BigDecimal estimatedGstLiability = isGstEnabled
                ? totalBilled.multiply(gstMultiplier).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal netCashFlow = totalCollections.subtract(totalExpenses);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalCollections", totalCollections);
        summary.put("totalExpenses", totalExpenses);
        summary.put("netCashFlow", netCashFlow);
        summary.put("totalEscrowDeposit", totalEscrowDeposit);
        summary.put("pendingRefundCount", pendingRefundCount);
        summary.put("estimatedGstLiability", estimatedGstLiability);
        summary.put("gstEnabled", isGstEnabled);
        summary.put("gstin", org.getGstin() != null ? org.getGstin() : "");
        summary.put("defaultGstRate", defaultGstRate);
        summary.put("activeTenantsCount", tenants.stream().filter(t -> t != null && "active".equalsIgnoreCase(t.getStatus())).count());

        return ResponseEntity.ok(summary);
    }

    // 2. Financial Ledger & Cashbook Transactions (Property-isolated & Null-Safe)
    @GetMapping({"/ledger", "/financial-ledger"})
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getFinancialLedger(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        UUID orgId = org.getId();
        Set<UUID> propIds = getAuthorizedPropertyIds(propertyId);

        List<Map<String, Object>> ledgerEntries = new ArrayList<>();

        // Add Payments as Credits
        List<Payment> payments = paymentRepository.findByOrganizationId(orgId);
        if (payments != null) {
            for (Payment p : payments) {
                if (propIds != null) {
                    if (p.getInvoice() == null || p.getInvoice().getTenant() == null ||
                            p.getInvoice().getTenant().getPropertyId() == null ||
                            !propIds.contains(p.getInvoice().getTenant().getPropertyId())) {
                        continue;
                    }
                }

                Map<String, Object> entry = new HashMap<>();
                entry.put("id", "PAY-" + p.getId());
                entry.put("date", p.getPaymentDate() != null ? p.getPaymentDate().toLocalDate().toString() : LocalDate.now().toString());
                entry.put("type", "CREDIT");
                entry.put("category", "Rent & Fee Collection");
                entry.put("description", "Payment received via " + (p.getPaymentMethod() != null ? p.getPaymentMethod() : "OFFLINE") + " (Ref: " + (p.getTransactionReference() != null ? p.getTransactionReference() : "N/A") + ")");
                entry.put("amount", p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO);
                entry.put("status", p.getStatus() != null ? p.getStatus() : "COMPLETED");
                ledgerEntries.add(entry);
            }
        }

        // Add Expenses as Debits
        List<Expense> expenses = expenseRepository.findByOrganizationOrderByExpenseDateDesc(org);
        if (expenses != null) {
            for (Expense e : expenses) {
                if (propIds != null && e.getProperty() != null && e.getProperty().getId() != null) {
                    if (!propIds.contains(e.getProperty().getId())) {
                        continue;
                    }
                }

                Map<String, Object> entry = new HashMap<>();
                entry.put("id", "EXP-" + e.getId());
                entry.put("date", e.getExpenseDate() != null ? e.getExpenseDate().toString() : LocalDate.now().toString());
                entry.put("type", "DEBIT");
                entry.put("category", e.getCategory() != null ? e.getCategory() : "Operating Expense");
                entry.put("description", e.getDescription() != null ? e.getDescription() : "Property operational expenditure");
                entry.put("amount", e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO);
                entry.put("vendor", e.getVendorName() != null ? e.getVendorName() : "N/A");
                entry.put("status", "PAID");
                ledgerEntries.add(entry);
            }
        }

        ledgerEntries.sort((a, b) -> ((String) b.get("date")).compareTo((String) a.get("date")));

        return ResponseEntity.ok(ledgerEntries);
    }

    // 3. GST & Tax Compliance Breakdown (Property-isolated & Null-Safe)
    @GetMapping({"/gst-reports", "/gst-tax"})
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getGstTaxReports(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        boolean isGstEnabled = org != null && Boolean.TRUE.equals(org.getGstEnabled());
        if (org == null || !isGstEnabled) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("gstEnabled", false);
            empty.put("gstin", org != null && org.getGstin() != null ? org.getGstin() : "");
            empty.put("message", "GST Tracking is currently disabled for your organization under residential hostel exemption.");
            empty.put("taxPeriod", LocalDate.now().getYear() + "-" + String.format("%02d", LocalDate.now().getMonthValue()));
            empty.put("totalTaxableValue", BigDecimal.ZERO);
            empty.put("totalCgst", BigDecimal.ZERO);
            empty.put("totalSgst", BigDecimal.ZERO);
            empty.put("totalIgst", BigDecimal.ZERO);
            empty.put("totalGstLiability", BigDecimal.ZERO);
            empty.put("invoiceBreakdown", Collections.emptyList());
            return ResponseEntity.ok(empty);
        }

        Set<UUID> propIds = getAuthorizedPropertyIds(propertyId);

        List<Invoice> invoices = invoiceRepository.findByOrganizationIdNative(org.getId());
        if (invoices == null) invoices = Collections.emptyList();
        if (propIds != null) {
            invoices = invoices.stream()
                    .filter(inv -> inv != null && inv.getTenant() != null && inv.getTenant().getPropertyId() != null && propIds.contains(inv.getTenant().getPropertyId()))
                    .collect(Collectors.toList());
        }

        List<Map<String, Object>> gstRows = new ArrayList<>();
        BigDecimal totalTaxable = BigDecimal.ZERO;
        BigDecimal totalCgst = BigDecimal.ZERO;
        BigDecimal totalSgst = BigDecimal.ZERO;
        BigDecimal totalIgst = BigDecimal.ZERO;

        for (Invoice inv : invoices) {
            if (inv == null) continue;
            BigDecimal amount = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
            BigDecimal taxable = amount.divide(new BigDecimal("1.18"), 2, RoundingMode.HALF_UP);
            BigDecimal gstAmount = amount.subtract(taxable);
            BigDecimal cgst = gstAmount.divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP);
            BigDecimal sgst = gstAmount.subtract(cgst);

            totalTaxable = totalTaxable.add(taxable);
            totalCgst = totalCgst.add(cgst);
            totalSgst = totalSgst.add(sgst);

            Map<String, Object> row = new HashMap<>();
            row.put("invoiceNumber", inv.getInvoiceNumber() != null ? inv.getInvoiceNumber() : "INV-" + inv.getId());
            row.put("date", inv.getDueDate() != null ? inv.getDueDate().toString() : LocalDate.now().toString());
            row.put("tenantName", inv.getTenant() != null && inv.getTenant().getName() != null ? inv.getTenant().getName() : "Tenant");
            row.put("sacCode", "998314");
            row.put("totalAmount", amount);
            row.put("taxableAmount", taxable);
            row.put("cgstRate", "9%");
            row.put("cgstAmount", cgst);
            row.put("sgstRate", "9%");
            row.put("sgstAmount", sgst);
            row.put("status", inv.getStatus() != null ? inv.getStatus().toUpperCase() : "UNPAID");
            gstRows.add(row);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("gstEnabled", true);
        response.put("gstin", org.getGstin() != null ? org.getGstin() : "");
        response.put("sacCode", "998314");
        response.put("taxPeriod", LocalDate.now().getYear() + "-" + String.format("%02d", LocalDate.now().getMonthValue()));
        response.put("totalTaxableValue", totalTaxable);
        response.put("totalCgst", totalCgst);
        response.put("totalSgst", totalSgst);
        response.put("totalIgst", totalIgst);
        response.put("totalGstLiability", totalCgst.add(totalSgst));
        response.put("invoiceBreakdown", gstRows);

        return ResponseEntity.ok(response);
    }

    // 4. Security Deposit Escrow & Refunds (Property-isolated & Null-Safe)
    @GetMapping({"/security-deposits", "/deposit-ledger"})
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getSecurityDepositLedger(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("totalEscrowHolding", BigDecimal.ZERO);
            empty.put("tenantsDeposits", Collections.emptyList());
            return ResponseEntity.ok(empty);
        }

        Set<UUID> propIds = getAuthorizedPropertyIds(propertyId);

        List<Tenant> tenants = tenantRepository.findByOrganization(org);
        if (tenants == null) tenants = Collections.emptyList();
        if (propIds != null) {
            tenants = tenants.stream()
                    .filter(t -> t != null && t.getPropertyId() != null && propIds.contains(t.getPropertyId()))
                    .collect(Collectors.toList());
        }

        List<Map<String, Object>> depositRows = new ArrayList<>();
        BigDecimal totalEscrow = BigDecimal.ZERO;

        for (Tenant t : tenants) {
            if (t == null) continue;
            BigDecimal dep = t.getDeposit() != null ? t.getDeposit() : BigDecimal.ZERO;
            totalEscrow = totalEscrow.add(dep);

            Map<String, Object> row = new HashMap<>();
            row.put("tenantId", t.getId());
            row.put("tenantName", t.getName());
            row.put("email", t.getEmail());
            row.put("phone", t.getPhone());
            row.put("status", t.getStatus() != null ? t.getStatus() : "active");
            row.put("depositAmount", dep);
            depositRows.add(row);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("totalEscrowHolding", totalEscrow);
        response.put("tenantsDeposits", depositRows);

        return ResponseEntity.ok(response);
    }

    // 5. Accounts Receivable (AR) Aging Analysis (Property-isolated & Null-Safe)
    @GetMapping("/ar-aging")
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> getArAgingAnalysis(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("current0to30Days", BigDecimal.ZERO);
            empty.put("overdue31to60Days", BigDecimal.ZERO);
            empty.put("overdue61to90Days", BigDecimal.ZERO);
            empty.put("overdue90PlusDays", BigDecimal.ZERO);
            empty.put("totalOutstandingAR", BigDecimal.ZERO);
            return ResponseEntity.ok(empty);
        }

        Set<UUID> propIds = getAuthorizedPropertyIds(propertyId);

        List<Invoice> invoices = invoiceRepository.findByOrganizationId(org.getId());
        if (invoices == null) invoices = Collections.emptyList();
        if (propIds != null) {
            invoices = invoices.stream()
                    .filter(inv -> inv != null && inv.getTenant() != null && inv.getTenant().getPropertyId() != null && propIds.contains(inv.getTenant().getPropertyId()))
                    .collect(Collectors.toList());
        }

        BigDecimal current0to30 = BigDecimal.ZERO;
        BigDecimal overdue31to60 = BigDecimal.ZERO;
        BigDecimal overdue61to90 = BigDecimal.ZERO;
        BigDecimal overdue90Plus = BigDecimal.ZERO;

        LocalDate today = LocalDate.now();

        for (Invoice inv : invoices) {
            if (inv == null || "PAID".equalsIgnoreCase(inv.getStatus())) continue;

            BigDecimal pending = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
            if (inv.getAmountPaid() != null) {
                pending = pending.subtract(inv.getAmountPaid());
            }
            if (pending.compareTo(BigDecimal.ZERO) <= 0) continue;

            LocalDate due = inv.getDueDate() != null ? inv.getDueDate() : today;
            long daysOverdue = java.time.temporal.ChronoUnit.DAYS.between(due, today);

            if (daysOverdue <= 30) {
                current0to30 = current0to30.add(pending);
            } else if (daysOverdue <= 60) {
                overdue31to60 = overdue31to60.add(pending);
            } else if (daysOverdue <= 90) {
                overdue61to90 = overdue61to90.add(pending);
            } else {
                overdue90Plus = overdue90Plus.add(pending);
            }
        }

        Map<String, Object> arMap = new HashMap<>();
        arMap.put("current0to30Days", current0to30);
        arMap.put("overdue31to60Days", overdue31to60);
        arMap.put("overdue61to90Days", overdue61to90);
        arMap.put("overdue90PlusDays", overdue90Plus);
        arMap.put("totalOutstandingAR", current0to30.add(overdue31to60).add(overdue61to90).add(overdue90Plus));

        return ResponseEntity.ok(arMap);
    }

    // 6. Record New Property Operational Expense
    @PostMapping("/expenses")
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('OWNER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createExpense(@Valid @RequestBody Map<String, Object> req) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.badRequest().body("Organization not found.");
        }

        String category = req.get("category") != null ? req.get("category").toString() : "Maintenance";
        String description = req.get("description") != null ? req.get("description").toString() : "";
        BigDecimal amount = req.get("amount") != null ? new BigDecimal(req.get("amount").toString()) : BigDecimal.ZERO;
        String paymentMethod = req.get("paymentMethod") != null ? req.get("paymentMethod").toString() : "CASH";
        String vendorName = req.get("vendorName") != null ? req.get("vendorName").toString() : "";
        String referenceNumber = req.get("referenceNumber") != null ? req.get("referenceNumber").toString() : "";

        Property property = null;
        if (req.get("propertyId") != null && !req.get("propertyId").toString().isBlank()) {
            try {
                UUID pId = UUID.fromString(req.get("propertyId").toString());
                property = propertyRepository.findByIdAndOrganization(pId, org).orElse(null);
            } catch (Exception ignored) {}
        }

        Expense expense = new Expense(org, property, category, description, amount, paymentMethod, vendorName, referenceNumber, LocalDate.now());
        Expense saved = expenseRepository.save(expense);

        return ResponseEntity.ok(saved);
    }
}
