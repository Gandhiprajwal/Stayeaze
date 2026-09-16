package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class AutoBillingService {

    private static final Logger logger = LoggerFactory.getLogger(AutoBillingService.class);

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private InvoiceSequenceService invoiceSequenceService;

    private String nextInvoiceNumber(Tenant tenant) {
        return invoiceSequenceService.nextRentalInvoiceNumber(tenant);
    }

    private OrganizationBillingProfile getBillingProfile(Organization organization) {
        if (organization == null) return null;
        return organizationBillingProfileRepository.findByOrganization(organization)
                .orElseGet(() -> organizationBillingProfileRepository.save(new OrganizationBillingProfile(organization)));
    }

    /**
     * Nightly Cron Job: Runs every night at 2:00 AM (and on-demand).
     * Automatically evaluates overdue invoices past grace period and appends Late Payment Surcharge.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public Map<String, Object> autoAccrueLateFees() {
        logger.info("Starting automated late fee evaluation across unpaid/overdue invoices...");
        List<Invoice> unpaidInvoices = invoiceRepository.findAll().stream()
                .filter(i -> ("UNPAID".equalsIgnoreCase(i.getStatus()) || "PARTIALLY_PAID".equalsIgnoreCase(i.getStatus()) || "OVERDUE".equalsIgnoreCase(i.getStatus()))
                        && !"CANCELLED".equalsIgnoreCase(i.getStatus()))
                .toList();

        LocalDate today = LocalDate.now();
        int evaluatedCount = 0;
        int lateFeesAppliedCount = 0;
        BigDecimal totalLateFeesAccrued = BigDecimal.ZERO;

        for (Invoice invoice : unpaidInvoices) {
            try {
                evaluatedCount++;
                if (invoice.getDueDate() == null) continue;

                Tenant tenant = invoice.getTenant();
                if (tenant == null) continue;

                // Pull late fee policy from the org billing profile (admin-configurable in Settings)
                Organization org = tenant.getOrganization();
                OrganizationBillingProfile profile = getBillingProfile(org);
                int graceDays = (profile != null) ? profile.getLateFeeGracePeriodDays() : 5;
                double lateFeePct = (profile != null) ? profile.getLateFeePercentage().doubleValue() : 5.0;

                LocalDate overdueCutoff = invoice.getDueDate().plusDays(graceDays);

                if (today.isAfter(overdueCutoff)) {
                    // Check if late fee item already appended to avoid duplicate charges
                    boolean alreadyHasLateFee = false;
                    try {
                        if (invoice.getItems() != null) {
                            alreadyHasLateFee = invoice.getItems().stream()
                                    .anyMatch(it -> it.getDescription() != null && it.getDescription().toLowerCase().contains("late payment"));
                        }
                    } catch (Exception ignored) {}

                    if (!alreadyHasLateFee) {
                        BigDecimal paid = invoice.getAmountPaid() != null ? invoice.getAmountPaid() : BigDecimal.ZERO;
                        BigDecimal remainingDue = invoice.getAmountDue().subtract(paid);

                        if (remainingDue.compareTo(BigDecimal.ZERO) > 0) {
                            BigDecimal lateFeeAmount = remainingDue
                                    .multiply(BigDecimal.valueOf(lateFeePct))
                                    .divide(BigDecimal.valueOf(100), 0, java.math.RoundingMode.HALF_UP);

                            if (lateFeeAmount.compareTo(BigDecimal.valueOf(100)) < 0) {
                                lateFeeAmount = BigDecimal.valueOf(100); // Minimum ₹100 surcharge
                            }

                            String feeDesc = String.format("Late Payment Surcharge (%.1f%% after %d-day grace period)", lateFeePct, graceDays);
                            InvoiceItem feeItem = new InvoiceItem(invoice, feeDesc, lateFeeAmount);
                            if (invoice.getItems() == null) {
                                invoice.setItems(new ArrayList<>());
                            }
                            invoice.getItems().add(feeItem);

                            invoice.setAmountDue(invoice.getAmountDue().add(lateFeeAmount));
                            invoice.setStatus("OVERDUE");
                            invoiceRepository.save(invoice);

                            lateFeesAppliedCount++;
                            totalLateFeesAccrued = totalLateFeesAccrued.add(lateFeeAmount);
                        }
                    } else if (!"OVERDUE".equalsIgnoreCase(invoice.getStatus())) {
                        invoice.setStatus("OVERDUE");
                        invoiceRepository.save(invoice);
                    }
                }
            } catch (Exception e) {
                logger.warn("Skipping evaluation for invoice ID {} due to error: {}", invoice.getId(), e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("evaluatedInvoicesCount", evaluatedCount);
        result.put("lateFeesAppliedCount", lateFeesAppliedCount);
        result.put("totalLateFeesAccrued", totalLateFeesAccrued);
        logger.info("Late fee evaluation complete: {} fees applied totaling ₹{}", lateFeesAppliedCount, totalLateFeesAccrued);
        return result;
    }

    /**
     * Nightly Cron Job: Runs every night at 1:00 AM.
     * Iterates over all active tenants across all properties.
     * If a tenant's 1-month check-in anniversary is due in 1 day (or overdue),
     * auto-generates the next monthly rent invoice and skips checked-out tenants.
     */
    @Scheduled(cron = "0 0 1 * * ?")
    public Map<String, Object> autoGenerateMonthlyInvoices() {
        logger.info("Starting nightly automated monthly rent invoice generation via parallel Virtual Threads...");
        List<Tenant> allTenants = tenantRepository.findAll();
        LocalDate today = LocalDate.now();
        java.util.concurrent.atomic.AtomicInteger generatedCount = new java.util.concurrent.atomic.AtomicInteger(0);
        java.util.concurrent.atomic.AtomicInteger skippedCheckedOut = new java.util.concurrent.atomic.AtomicInteger(0);
        List<String> generatedDetails = Collections.synchronizedList(new ArrayList<>());

        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            List<java.util.concurrent.CompletableFuture<Void>> futures = allTenants.stream().map(tenant -> 
                java.util.concurrent.CompletableFuture.runAsync(() -> {
                    try {
                        processTenantAutoBilling(tenant, today, generatedCount, skippedCheckedOut, generatedDetails);
                    } catch (Exception e) {
                        logger.error("Error processing auto-billing for tenant ID {}: {}", tenant.getId(), e.getMessage());
                    }
                }, executor)
            ).toList();

            java.util.concurrent.CompletableFuture.allOf(futures.toArray(new java.util.concurrent.CompletableFuture[0])).join();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("generatedCount", generatedCount.get());
        result.put("skippedCheckedOutCount", skippedCheckedOut.get());
        result.put("details", new ArrayList<>(generatedDetails));
        result.put("timestamp", LocalDate.now().toString());
        return result;
    }

    @Transactional
    public void processTenantAutoBilling(
            Tenant tenant,
            LocalDate today,
            java.util.concurrent.atomic.AtomicInteger generatedCount,
            java.util.concurrent.atomic.AtomicInteger skippedCheckedOut,
            List<String> generatedDetails
    ) {
        // Rule 1: Exclude checked-out, archived, or inactive tenants
        if (tenant.getStatus() != null && 
           (tenant.getStatus().equalsIgnoreCase("CHECKED_OUT") || 
            tenant.getStatus().equalsIgnoreCase("ARCHIVED") || 
            tenant.getStatus().equalsIgnoreCase("BLACKLISTED") ||
            tenant.getStatus().equalsIgnoreCase("INACTIVE"))) {
            skippedCheckedOut.incrementAndGet();
            return;
        }

        // Only process ACTIVE tenants
        if (tenant.getStatus() != null && !tenant.getStatus().equalsIgnoreCase("ACTIVE")) {
            return;
        }

        // Determine Check-in / Start Date
        LocalDate checkInDate = null;
        if (tenant.getLeaseStart() != null && !tenant.getLeaseStart().trim().isEmpty()) {
            try {
                checkInDate = LocalDate.parse(tenant.getLeaseStart().trim().substring(0, 10));
            } catch (Exception ignored) {}
        }
        if (checkInDate == null && tenant.getCreatedAt() != null) {
            checkInDate = tenant.getCreatedAt().toLocalDate();
        }
        if (checkInDate == null) {
            checkInDate = today;
        }

        // Find existing rent invoices for this tenant (excluding deposits/utilities/opening dues)
        List<Invoice> existingInvoices = invoiceRepository.findByTenant(tenant);
        List<Invoice> existingRentInvoices = existingInvoices.stream()
                .filter(i -> i.getInvoiceNumber() == null || (!i.getInvoiceNumber().startsWith("UTIL") && !i.getInvoiceNumber().startsWith("DEP")))
                .filter(i -> i.getItems() == null || i.getItems().stream().noneMatch(it -> it.getDescription() != null && it.getDescription().toLowerCase().contains("deposit")))
                .sorted((a, b) -> {
                    LocalDate da = a.getIssueDate() != null ? a.getIssueDate() : a.getDueDate();
                    LocalDate db = b.getIssueDate() != null ? b.getIssueDate() : b.getDueDate();
                    return db.compareTo(da);
                })
                .toList();

        LocalDate cycleStart;
        LocalDate cycleEnd;

        if (existingRentInvoices.isEmpty()) {
            // For historical check-in dates (e.g. 4 months ago), advance cycle forward to the active cycle
            LocalDate start = checkInDate;
            while (start.plusMonths(1).isBefore(today)) {
                start = start.plusMonths(1);
            }
            cycleStart = start;
            cycleEnd = start.plusMonths(1);
        } else {
            Invoice latest = existingRentInvoices.get(0);
            LocalDate latestBase = latest.getIssueDate() != null ? latest.getIssueDate() : latest.getDueDate().minusDays(7);
            cycleStart = latestBase;
            cycleEnd = latestBase.plusMonths(1);

            while (cycleEnd.isBefore(today)) {
                cycleStart = cycleEnd;
                cycleEnd = cycleStart.plusMonths(1);
            }
        }

        // Trigger 1 Day Before Cycle End
        LocalDate triggerDate = cycleEnd.minusDays(1);

        if (today.isAfter(triggerDate) || today.isEqual(triggerDate)) {
            boolean alreadyExists = existingInvoices.stream()
                    .anyMatch(inv -> {
                        if (inv.getIssueDate() != null && inv.getIssueDate().equals(today)) return true;
                        LocalDate iDate = inv.getIssueDate() != null ? inv.getIssueDate() : inv.getDueDate();
                        return iDate != null && iDate.getYear() == today.getYear() && iDate.getMonthValue() == today.getMonthValue()
                                && (inv.getInvoiceNumber() == null || !inv.getInvoiceNumber().startsWith("UTIL"));
                    });

            if (!alreadyExists) {
                Organization org = tenant.getOrganization();
                OrganizationBillingProfile profile = getBillingProfile(org);
                String invoiceNum = nextInvoiceNumber(tenant);

                int dueDays = (profile != null && profile.getPaymentDueDays() != null) ? profile.getPaymentDueDays() : 7;
                LocalDate issueDate = today; // Generation / Issue Date is TODAY
                LocalDate dueDate = issueDate.plusDays(dueDays); // Due Date based on Organization paymentDueDays setting

                BigDecimal rentAmount = tenant.getRent();
                if (rentAmount == null || rentAmount.compareTo(BigDecimal.ZERO) <= 0) {
                    rentAmount = new BigDecimal("8000.00");
                }

                BigDecimal advance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
                BigDecimal paidFromAdvance = BigDecimal.ZERO;
                String invStatus = "UNPAID";

                if (advance.compareTo(BigDecimal.ZERO) > 0) {
                    if (advance.compareTo(rentAmount) >= 0) {
                        paidFromAdvance = rentAmount;
                        tenant.setAdvanceBalance(advance.subtract(rentAmount));
                        invStatus = "PAID";
                    } else {
                        paidFromAdvance = advance;
                        tenant.setAdvanceBalance(BigDecimal.ZERO);
                        invStatus = "PARTIALLY_PAID";
                    }
                    try { tenantRepository.save(tenant); } catch (Exception ignored) {}
                }

                Invoice newInvoice = new Invoice(tenant, invoiceNum, dueDate, issueDate, rentAmount);
                newInvoice.setAmountPaid(paidFromAdvance);
                newInvoice.setStatus(invStatus);
                if (profile != null) {
                    newInvoice.setIssuerSnapshot(new InvoiceIssuerSnapshot(profile));
                }

                List<InvoiceItem> items = new ArrayList<>();
                items.add(new InvoiceItem(newInvoice, "Monthly Rent (" + cycleStart + " to " + cycleEnd + ")", rentAmount));
                newInvoice.setItems(items);

                invoiceRepository.save(newInvoice);
                generatedCount.incrementAndGet();
                generatedDetails.add(tenant.getFirstName() + " " + tenant.getLastName() + " (" + invoiceNum + " - ₹" + rentAmount + (paidFromAdvance.compareTo(BigDecimal.ZERO) > 0 ? " [Offset: ₹" + paidFromAdvance + "]" : "") + ")");
                logger.info("Auto-generated invoice {} for tenant {} (Issued: {}, Due: {}, Status: {})", invoiceNum, tenant.getFirstName() + " " + tenant.getLastName(), issueDate, dueDate, invStatus);
            }
        }
    }

    /**
     * Manual Override Generation: Allows an owner/manager to manually generate the next monthly invoice
     * for a specific tenant immediately, taking into account their organization's payment due days settings.
     */
    @Transactional
    public Invoice generateMonthlyInvoiceForTenant(Tenant tenant, int cycleMonth, int cycleYear) {
        if (tenant == null || "CORPORATE_SPONSORED".equalsIgnoreCase(tenant.getBillingResponsibility())) {
            return null;
        }
        if (tenant.getRent() == null || tenant.getRent().compareTo(BigDecimal.ZERO) <= 0 || 
            (tenant.getStatus().equalsIgnoreCase("CHECKED_OUT") || 
            tenant.getStatus().equalsIgnoreCase("ARCHIVED") || 
            tenant.getStatus().equalsIgnoreCase("INACTIVE"))) {
            throw new IllegalStateException("Cannot generate rent invoice for a checked-out tenant.");
        }

        LocalDate today = LocalDate.now();
        LocalDate checkInDate = null;
        if (tenant.getLeaseStart() != null && !tenant.getLeaseStart().trim().isEmpty()) {
            try {
                checkInDate = LocalDate.parse(tenant.getLeaseStart().trim().substring(0, 10));
            } catch (Exception ignored) {}
        }
        if (checkInDate == null && tenant.getCreatedAt() != null) {
            checkInDate = tenant.getCreatedAt().toLocalDate();
        }
        if (checkInDate == null) {
            checkInDate = today;
        }

        List<Invoice> existingInvoices = invoiceRepository.findByTenant(tenant);
        List<Invoice> existingRentInvoices = existingInvoices.stream()
                .filter(i -> i.getInvoiceNumber() == null || (!i.getInvoiceNumber().startsWith("UTIL") && !i.getInvoiceNumber().startsWith("DEP")))
                .filter(i -> i.getItems() == null || i.getItems().stream().noneMatch(it -> it.getDescription() != null && it.getDescription().toLowerCase().contains("deposit")))
                .sorted((a, b) -> {
                    LocalDate da = a.getIssueDate() != null ? a.getIssueDate() : a.getDueDate();
                    LocalDate db = b.getIssueDate() != null ? b.getIssueDate() : b.getDueDate();
                    return db.compareTo(da);
                })
                .toList();

        LocalDate cycleStart;
        LocalDate cycleEnd;

        if (existingRentInvoices.isEmpty()) {
            LocalDate start = checkInDate;
            while (start.plusMonths(1).isBefore(today)) {
                start = start.plusMonths(1);
            }
            cycleStart = start;
            cycleEnd = start.plusMonths(1);
        } else {
            Invoice latest = existingRentInvoices.get(0);
            LocalDate latestBase = latest.getIssueDate() != null ? latest.getIssueDate() : latest.getDueDate().minusDays(7);
            cycleStart = latestBase;
            cycleEnd = latestBase.plusMonths(1);

            while (cycleEnd.isBefore(today)) {
                cycleStart = cycleEnd;
                cycleEnd = cycleStart.plusMonths(1);
            }
        }

        Organization org = tenant.getOrganization();
        OrganizationBillingProfile profile = getBillingProfile(org);
        String invoiceNum = nextInvoiceNumber(tenant);

        int dueDays = (profile != null && profile.getPaymentDueDays() != null) ? profile.getPaymentDueDays() : 7;
        LocalDate issueDate = today; // Generation / Issue Date is TODAY
        LocalDate dueDate = issueDate.plusDays(dueDays); // Due Date based on Organization paymentDueDays setting

        BigDecimal rentAmount = tenant.getRent();
        if (rentAmount == null || rentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            rentAmount = new BigDecimal("8000.00");
        }

        BigDecimal advance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
        BigDecimal paidFromAdvance = BigDecimal.ZERO;
        String invStatus = "UNPAID";

        if (advance.compareTo(BigDecimal.ZERO) > 0) {
            if (advance.compareTo(rentAmount) >= 0) {
                paidFromAdvance = rentAmount;
                tenant.setAdvanceBalance(advance.subtract(rentAmount));
                invStatus = "PAID";
            } else {
                paidFromAdvance = advance;
                tenant.setAdvanceBalance(BigDecimal.ZERO);
                invStatus = "PARTIALLY_PAID";
            }
            try { tenantRepository.save(tenant); } catch (Exception ignored) {}
        }

        Invoice newInvoice = new Invoice(tenant, invoiceNum, dueDate, issueDate, rentAmount);
        newInvoice.setAmountPaid(paidFromAdvance);
        newInvoice.setStatus(invStatus);
        if (profile != null) {
            newInvoice.setIssuerSnapshot(new InvoiceIssuerSnapshot(profile));
        }

        List<InvoiceItem> items = new ArrayList<>();
        items.add(new InvoiceItem(newInvoice, "Monthly Rent (" + cycleStart + " to " + cycleEnd + ")", rentAmount));
        newInvoice.setItems(items);

        return invoiceRepository.save(newInvoice);
    }

    /**
     * P2.1: Dry-run preview of the monthly rent batch.
     * Mirrors the BulkRentRunController logic 100% but performs ZERO DB writes.
     * Returns a per-tenant preview list so the owner can review before committing.
     */
    public List<Map<String, Object>> previewRentRun(
            Organization org,
            int billingMonth,
            int billingYear,
            int dueDateDays,
            java.util.UUID targetPropertyId,
            List<java.util.UUID> excludeTenantIds) {

        java.time.Month month = java.time.Month.of(billingMonth);
        String monthName = month.getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);
        LocalDate issueDate = LocalDate.of(billingYear, billingMonth, 1);
        int maxDaysInMonth = issueDate.lengthOfMonth();

        List<Tenant> rawTenants = tenantRepository.findByOrganization(org);
        List<Tenant> activeTenants = rawTenants.stream()
                .filter(t -> "ACTIVE".equalsIgnoreCase(t.getStatus()))
                .filter(t -> !"CORPORATE_SPONSORED".equalsIgnoreCase(t.getBillingResponsibility()))
                .filter(t -> t.getRent() != null && t.getRent().compareTo(BigDecimal.ZERO) > 0)
                .collect(java.util.stream.Collectors.toList());

        if (targetPropertyId != null) {
            final java.util.UUID pId = targetPropertyId;
            activeTenants = activeTenants.stream()
                    .filter(t -> pId.equals(t.getPropertyId()))
                    .collect(java.util.stream.Collectors.toList());
        }

        if (excludeTenantIds != null && !excludeTenantIds.isEmpty()) {
            activeTenants = activeTenants.stream()
                    .filter(t -> !excludeTenantIds.contains(t.getId()))
                    .collect(java.util.stream.Collectors.toList());
        }

        List<Map<String, Object>> preview = new ArrayList<>();

        for (Tenant tenant : activeTenants) {
            // Skip future/expired leases (same guards as the real run)
            if (tenant.getLeaseStart() != null && !tenant.getLeaseStart().isBlank()) {
                try {
                    LocalDate leaseStart = LocalDate.parse(tenant.getLeaseStart());
                    if (leaseStart.isAfter(LocalDate.of(billingYear, billingMonth, maxDaysInMonth))) continue;
                } catch (Exception ignored) {}
            }
            if (tenant.getLeaseEnd() != null && !tenant.getLeaseEnd().isBlank()) {
                try {
                    LocalDate leaseEnd = LocalDate.parse(tenant.getLeaseEnd());
                    if (leaseEnd.isBefore(LocalDate.of(billingYear, billingMonth, 1))) continue;
                } catch (Exception ignored) {}
            }

            // Skip if already invoiced for this cycle
            String invNumber = String.format("INV-%d%02d-%s", billingYear, billingMonth,
                    tenant.getId().toString().substring(0, 8).toUpperCase());
            boolean alreadyExists = invoiceRepository.findByTenant(tenant).stream()
                    .anyMatch(i -> {
                        if (invNumber.equalsIgnoreCase(i.getInvoiceNumber())) return true;
                        LocalDate iDate = i.getIssueDate() != null ? i.getIssueDate() : i.getDueDate();
                        boolean isRent = i.getInvoiceNumber() == null || !i.getInvoiceNumber().startsWith("UTIL");
                        return isRent && iDate != null && iDate.getYear() == billingYear && iDate.getMonthValue() == billingMonth;
                    });
            if (alreadyExists) continue;

            BigDecimal rentAmount = tenant.getRent();
            boolean isProRata = false;
            int proRataDays = maxDaysInMonth;
            String cycleLabel = monthName + " " + billingYear;

            // Pro-rata calculation (same logic as real run)
            if (tenant.getLeaseStart() != null && !tenant.getLeaseStart().isBlank()) {
                try {
                    LocalDate leaseStart = LocalDate.parse(tenant.getLeaseStart());
                    if (leaseStart.getYear() == billingYear && leaseStart.getMonthValue() == billingMonth && leaseStart.getDayOfMonth() > 1) {
                        int startDay = leaseStart.getDayOfMonth();
                        proRataDays = maxDaysInMonth - startDay + 1;
                        rentAmount = tenant.getRent()
                                .multiply(BigDecimal.valueOf(proRataDays))
                                .divide(BigDecimal.valueOf(maxDaysInMonth), 0, java.math.RoundingMode.HALF_UP);
                        isProRata = true;
                        cycleLabel = String.format("Pro-Rata %d/%d — %d days", billingMonth, billingYear, proRataDays);
                    }
                } catch (Exception ignored) {}
            }

            BigDecimal advance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
            BigDecimal paidFromAdvance = advance.min(rentAmount);
            BigDecimal netDue = rentAmount.subtract(paidFromAdvance);
            String projectedStatus = paidFromAdvance.compareTo(rentAmount) >= 0 ? "PAID" :
                    paidFromAdvance.compareTo(BigDecimal.ZERO) > 0 ? "PARTIALLY_PAID" : "UNPAID";

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("tenantId", tenant.getId());
            row.put("tenantName", (tenant.getFirstName() != null ? tenant.getFirstName() : "") + " " + (tenant.getLastName() != null ? tenant.getLastName() : "").trim());
            row.put("roomNumber", tenant.getRoomNumber());
            row.put("bedNumber", tenant.getBedNumber());
            row.put("propertyId", tenant.getPropertyId());
            row.put("fullRent", tenant.getRent());
            row.put("calculatedRent", rentAmount);
            row.put("isProRata", isProRata);
            row.put("proRataDays", proRataDays);
            row.put("daysInMonth", maxDaysInMonth);
            row.put("advanceBalance", advance);
            row.put("advanceOffset", paidFromAdvance);
            row.put("netDue", netDue);
            row.put("projectedStatus", projectedStatus);
            row.put("cycleLabel", cycleLabel);
            row.put("alreadyInvoiced", false);
            preview.add(row);
        }

        return preview;
    }

    @Transactional
    public Invoice generateInvoiceForTenantNow(Tenant tenant) {
        if (tenant == null) {
            throw new IllegalArgumentException("Tenant is required");
        }
        Organization org = tenant.getOrganization();
        OrganizationBillingProfile profile = getBillingProfile(org);
        String invoiceNum = nextInvoiceNumber(tenant);

        int dueDays = (profile != null && profile.getPaymentDueDays() != null) ? profile.getPaymentDueDays() : 7;
        LocalDate issueDate = LocalDate.now();
        LocalDate dueDate = issueDate.plusDays(dueDays);

        BigDecimal rentAmount = tenant.getRent();
        if (rentAmount == null || rentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            rentAmount = new BigDecimal("8000.00");
        }

        BigDecimal advance = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
        BigDecimal paidFromAdvance = BigDecimal.ZERO;
        String invStatus = "UNPAID";

        if (advance.compareTo(BigDecimal.ZERO) > 0) {
            if (advance.compareTo(rentAmount) >= 0) {
                paidFromAdvance = rentAmount;
                tenant.setAdvanceBalance(advance.subtract(rentAmount));
                invStatus = "PAID";
            } else {
                paidFromAdvance = advance;
                tenant.setAdvanceBalance(BigDecimal.ZERO);
                invStatus = "PARTIALLY_PAID";
            }
            tenantRepository.save(tenant);
        }

        Invoice invoice = new Invoice();
        invoice.setTenant(tenant);
        invoice.setInvoiceNumber(invoiceNum);
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate);
        invoice.setAmountDue(rentAmount);
        invoice.setAmountPaid(paidFromAdvance);
        invoice.setStatus(invStatus);

        InvoiceItem item = new InvoiceItem(invoice, "Monthly Rent (" + issueDate.getMonth().name() + " " + issueDate.getYear() + ")", rentAmount);
        invoice.getItems().add(item);

        return invoiceRepository.save(invoice);
    }
}
