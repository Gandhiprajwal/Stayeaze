package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.services.SubscriptionEnforcementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
@RequestMapping("/api/v1/billing/monthly-rent-run")
public class BulkRentRunController {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubscriptionEnforcementService enforcementService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst().orElse(null);
    }

    @PostMapping
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
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(new MessageResponse(e.getMessage()));
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
            String invNumber = String.format("INV-%d%02d-%s", billingYear, billingMonth,
                    tenant.getId().toString().substring(0, 8).toUpperCase());

            // Check if invoice already exists for this cycle
            boolean alreadyExists = invoiceRepository.findByTenant(tenant).stream()
                    .anyMatch(i -> invNumber.equalsIgnoreCase(i.getInvoiceNumber()));

            if (alreadyExists) {
                continue;
            }

            BigDecimal rentAmount = tenant.getRent();
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

            String itemDesc = String.format("Monthly Rent — %s %d (Room: %s, Bed: %s)",
                    monthName, billingYear,
                    tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "N/A",
                    tenant.getBedNumber() != null ? tenant.getBedNumber() : "N/A");
            InvoiceItem item = new InvoiceItem(invoice, itemDesc, rentAmount);

            invoice.getItems().add(item);
            newInvoices.add(invoice);
        }

        if (!updatedTenants.isEmpty()) {
            tenantRepository.saveAll(updatedTenants);
        }
        if (!newInvoices.isEmpty()) {
            invoiceRepository.saveAll(newInvoices);
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
}
