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

        // Find existing invoices for this tenant
        List<Invoice> existingInvoices = invoiceRepository.findByTenant(tenant);
        existingInvoices.sort((a, b) -> b.getDueDate().compareTo(a.getDueDate()));

        LocalDate cycleStart;
        LocalDate cycleEnd;

        if (existingInvoices.isEmpty()) {
            cycleStart = checkInDate;
            cycleEnd = checkInDate.plusMonths(1);
        } else {
            Invoice latest = existingInvoices.get(0);
            cycleStart = latest.getDueDate();
            cycleEnd = latest.getDueDate().plusMonths(1);
        }

        // Trigger 1 Day Before Cycle End
        LocalDate triggerDate = cycleEnd.minusDays(1);

        if (today.isAfter(triggerDate) || today.isEqual(triggerDate)) {
            boolean alreadyExists = existingInvoices.stream()
                    .anyMatch(inv -> inv.getDueDate().equals(cycleEnd) || (inv.getIssueDate() != null && inv.getIssueDate().equals(today)));

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

                Invoice newInvoice = new Invoice(tenant, invoiceNum, dueDate, issueDate, rentAmount);
                if (profile != null) {
                    newInvoice.setIssuerSnapshot(new InvoiceIssuerSnapshot(profile));
                }

                List<InvoiceItem> items = new ArrayList<>();
                items.add(new InvoiceItem(newInvoice, "Monthly Rent (" + cycleStart + " to " + cycleEnd + ")", rentAmount));
                newInvoice.setItems(items);

                invoiceRepository.save(newInvoice);
                generatedCount.incrementAndGet();
                generatedDetails.add(tenant.getFirstName() + " " + tenant.getLastName() + " (" + invoiceNum + " - ₹" + rentAmount + ")");
                logger.info("Auto-generated invoice {} for tenant {} (Issued: {}, Due: {})", invoiceNum, tenant.getFirstName() + " " + tenant.getLastName(), issueDate, dueDate);
            }
        }
    }

    /**
     * Manual Override Generation: Allows an owner/manager to manually generate the next monthly invoice
     * for a specific tenant immediately, taking into account their organization's payment due days settings.
     */
    @Transactional
    public Invoice generateInvoiceForTenantNow(Tenant tenant) {
        if (tenant.getStatus() != null && 
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
        existingInvoices.sort((a, b) -> b.getDueDate().compareTo(a.getDueDate()));

        LocalDate cycleStart;
        LocalDate cycleEnd;

        if (existingInvoices.isEmpty()) {
            cycleStart = checkInDate;
            cycleEnd = checkInDate.plusMonths(1);
        } else {
            Invoice latest = existingInvoices.get(0);
            cycleStart = latest.getDueDate();
            cycleEnd = latest.getDueDate().plusMonths(1);
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

        Invoice newInvoice = new Invoice(tenant, invoiceNum, dueDate, issueDate, rentAmount);
        if (profile != null) {
            newInvoice.setIssuerSnapshot(new InvoiceIssuerSnapshot(profile));
        }

        List<InvoiceItem> items = new ArrayList<>();
        items.add(new InvoiceItem(newInvoice, "Monthly Rent (" + cycleStart + " to " + cycleEnd + ")", rentAmount));
        newInvoice.setItems(items);

        return invoiceRepository.save(newInvoice);
    }
}
