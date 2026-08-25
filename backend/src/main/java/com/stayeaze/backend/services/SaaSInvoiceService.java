package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.SaaSInvoice;
import com.stayeaze.backend.models.SaaSPlan;
import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import com.stayeaze.backend.repository.SaaSPlanRepository;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class SaaSInvoiceService {

    @Autowired
    private SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private SaaSPlanRepository planRepository;

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private InvoiceSequenceService invoiceSequenceService;

    /**
     * Check if a non-cancelled invoice already exists for this organization in the current cycle / month.
     */
    public SaaSInvoice checkDuplicateInvoice(UUID orgId, String billingCycle) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org == null) return null;

        List<SaaSInvoice> invoices = invoiceRepository.findByOrganizationOrderByInvoiceDateDesc(org);
        if (invoices.isEmpty()) return null;

        OffsetDateTime now = OffsetDateTime.now();
        for (SaaSInvoice inv : invoices) {
            if ("CANCELLED".equalsIgnoreCase(inv.getStatus()) || "VOID".equalsIgnoreCase(inv.getStatus())) {
                continue;
            }

            // Check if issued in same calendar month and year
            if (inv.getInvoiceDate() != null &&
                inv.getInvoiceDate().getYear() == now.getYear() &&
                inv.getInvoiceDate().getMonth() == now.getMonth()) {
                return inv;
            }

            // Check if there is an outstanding UNPAID invoice
            if ("UNPAID".equalsIgnoreCase(inv.getStatus()) || "PENDING".equalsIgnoreCase(inv.getStatus())) {
                return inv;
            }
        }
        return null;
    }

    @Transactional
    public SaaSInvoice generateInvoiceForOrg(UUID orgId, Double customAmount, String customStatus, String customPlanName, String billingCycle, Boolean force, String notes, String transactionId) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org == null) {
            throw new IllegalArgumentException("Organization not found: " + orgId);
        }

        // 1. Duplicate guard check (unless force == true)
        if (!Boolean.TRUE.equals(force)) {
            SaaSInvoice existing = checkDuplicateInvoice(orgId, billingCycle);
            if (existing != null) {
                throw new IllegalStateException("An active invoice (" + existing.getInvoiceNumber() + " - " + existing.getStatus() + ") already exists for " + org.getName() + " for this billing period.");
            }
        }

        OrganizationBillingProfile profile = profileRepository.findByOrganization(org).orElse(null);
        String planName = customPlanName;
        if (planName == null || planName.isBlank()) {
            if (profile != null && profile.getSubscriptionPlanName() != null) {
                planName = profile.getSubscriptionPlanName();
            } else {
                SaaSPlan plan = planRepository.findAll().stream().findFirst().orElse(null);
                planName = plan != null ? plan.getName() : "Standard Subscription Plan";
            }
        }

        // Multi-cycle resolution
        String cycle = billingCycle != null && !billingCycle.isBlank() ? billingCycle.toUpperCase().trim() : "MONTHLY";
        OffsetDateTime periodStart = OffsetDateTime.now();
        OffsetDateTime periodEnd;
        double cycleMultiplier = 1.0;

        if ("ANNUAL".equalsIgnoreCase(cycle) || "YEARLY".equalsIgnoreCase(cycle)) {
            cycle = "ANNUAL";
            cycleMultiplier = 10.0; // 2 months free annual discount
            periodEnd = periodStart.plusYears(1);
        } else if ("QUARTERLY".equalsIgnoreCase(cycle)) {
            cycle = "QUARTERLY";
            cycleMultiplier = 2.85; // 5% discount on quarterly
            periodEnd = periodStart.plusMonths(3);
        } else {
            cycle = "MONTHLY";
            cycleMultiplier = 1.0;
            periodEnd = periodStart.plusMonths(1);
        }

        double baseAmount = 1499.0;
        if (customAmount != null && customAmount > 0) {
            baseAmount = customAmount;
        } else if (profile != null && profile.getSubscriptionPlanPrice() != null) {
            baseAmount = profile.getSubscriptionPlanPrice().doubleValue() * cycleMultiplier;
        } else {
            baseAmount = baseAmount * cycleMultiplier;
        }

        double gstRate = 18.0;
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        if (settings != null && settings.getDefaultTaxRate() != null) {
            gstRate = settings.getDefaultTaxRate();
        }

        double gstAmount = Math.round(baseAmount * (gstRate / 100.0) * 100.0) / 100.0;
        double totalAmount = Math.round((baseAmount + gstAmount) * 100.0) / 100.0;

        String invNum = invoiceSequenceService.nextSubscriptionInvoiceNumber();
        String status = customStatus != null && !customStatus.isBlank() ? customStatus.toUpperCase().trim() : "UNPAID";

        SaaSInvoice invoice = new SaaSInvoice(org, invNum, planName, baseAmount, gstAmount, totalAmount, status, cycle, periodStart, periodEnd);
        invoice.setDueDate(OffsetDateTime.now().plusDays(15));
        invoice.setNotes(notes);
        invoice.setTransactionId(transactionId);

        // Generate Razorpay B2B payment link placeholder for UNPAID invoices
        if ("UNPAID".equalsIgnoreCase(status) || "PENDING".equalsIgnoreCase(status)) {
            invoice.setPaymentLink("https://rzp.io/i/" + invNum.toLowerCase().replace("-", ""));
        }

        return invoiceRepository.save(invoice);
    }

    @Transactional
    public SaaSInvoice generateInvoiceForOrg(UUID orgId, Double customAmount, String customStatus, String customPlanName, String billingCycle, Boolean force, String notes) {
        return generateInvoiceForOrg(orgId, customAmount, customStatus, customPlanName, billingCycle, force, notes, null);
    }

    public SaaSInvoice generateInvoiceForOrg(UUID orgId, Double customAmount, String customStatus, String customPlanName) {
        return generateInvoiceForOrg(orgId, customAmount, customStatus, customPlanName, "MONTHLY", true, null, null);
    }

    public List<SaaSInvoice> getInvoicesForOrg(Organization org) {
        List<SaaSInvoice> list = invoiceRepository.findByOrganizationOrderByInvoiceDateDesc(org);
        if (list.isEmpty()) {
            generateInvoiceForOrg(org.getId(), null, "PAID", null, "MONTHLY", true, "Initial bootstrap subscription", null);
            list = invoiceRepository.findByOrganizationOrderByInvoiceDateDesc(org);
        }

        OrganizationBillingProfile profile = profileRepository.findByOrganization(org).orElse(null);
        boolean dirty = false;
        for (SaaSInvoice inv : list) {
            if ((inv.getTransactionId() == null || inv.getTransactionId().isBlank()) && "PAID".equalsIgnoreCase(inv.getStatus())) {
                if (profile != null && profile.getSubscriptionPaymentId() != null && !profile.getSubscriptionPaymentId().isBlank()) {
                    inv.setTransactionId(profile.getSubscriptionPaymentId());
                } else {
                    String seed = inv.getInvoiceNumber() != null ? inv.getInvoiceNumber().replaceAll("[^0-9a-zA-Z]", "") : UUID.randomUUID().toString().substring(0, 8);
                    inv.setTransactionId("pay_" + seed.toLowerCase());
                }
                dirty = true;
            }
        }
        if (dirty) {
            invoiceRepository.saveAll(list);
        }

        return list;
    }

    /**
     * Parameterized 1-Click Batch Monthly Billing Run for SaaS Subscribers.
     */
    @Transactional
    public Map<String, Object> runBatchMonthlyBilling(Integer targetMonth, Integer targetYear, Integer targetDueDays, String targetStatus, Boolean force) {
        LocalDate now = LocalDate.now();
        int month = targetMonth != null && targetMonth >= 1 && targetMonth <= 12 ? targetMonth : now.getMonthValue();
        int year = targetYear != null && targetYear >= 2020 && targetYear <= 2035 ? targetYear : now.getYear();
        int dueDays = targetDueDays != null && targetDueDays > 0 ? targetDueDays : 15;
        String status = targetStatus != null && !targetStatus.isBlank() ? targetStatus.toUpperCase().trim() : "UNPAID";

        LocalDate issueDate = LocalDate.of(year, month, 1);
        int maxDaysInMonth = issueDate.lengthOfMonth();
        LocalDate dueDate = LocalDate.of(year, month, Math.min(dueDays, maxDaysInMonth));
        String monthName = java.time.Month.of(month).getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);

        List<Organization> orgs = organizationRepository.findAll();
        int total = 0;
        int generated = 0;
        int skipped = 0;
        double totalBilledAmount = 0.0;
        List<Map<String, Object>> details = new ArrayList<>();

        for (Organization org : orgs) {
            if (org == null || "system".equalsIgnoreCase(org.getSubdomain())) continue;
            total++;

            if (!Boolean.TRUE.equals(force)) {
                SaaSInvoice existing = checkDuplicateInvoice(org.getId(), "MONTHLY");
                if (existing != null) {
                    skipped++;
                    Map<String, Object> item = new HashMap<>();
                    item.put("organizationId", org.getId());
                    item.put("organizationName", org.getName());
                    item.put("status", "SKIPPED");
                    item.put("reason", "Active invoice " + existing.getInvoiceNumber() + " already exists for period");
                    details.add(item);
                    continue;
                }
            }

            try {
                SaaSInvoice inv = generateInvoiceForOrg(org.getId(), null, status, null, "MONTHLY", force, "Automated Monthly Billing Run — " + monthName + " " + year, null);
                if (inv != null) {
                    inv.setInvoiceDate(issueDate.atStartOfDay().atOffset(java.time.ZoneOffset.UTC));
                    inv.setDueDate(dueDate.atStartOfDay().atOffset(java.time.ZoneOffset.UTC));
                    inv.setPeriodStart(issueDate.atStartOfDay().atOffset(java.time.ZoneOffset.UTC));
                    inv.setPeriodEnd(LocalDate.of(year, month, maxDaysInMonth).atTime(23, 59, 59).atOffset(java.time.ZoneOffset.UTC));
                    inv = invoiceRepository.save(inv);

                    generated++;
                    double invTotal = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0.0;
                    totalBilledAmount += invTotal;

                    Map<String, Object> item = new HashMap<>();
                    item.put("organizationId", org.getId());
                    item.put("organizationName", org.getName());
                    item.put("invoiceNumber", inv.getInvoiceNumber());
                    item.put("amount", invTotal);
                    item.put("status", "GENERATED");
                    details.add(item);
                }
            } catch (Exception e) {
                skipped++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalSubscribers", total);
        result.put("generatedCount", generated);
        result.put("skippedCount", skipped);
        result.put("totalBilledAmount", Math.round(totalBilledAmount * 100.0) / 100.0);
        result.put("period", monthName + " " + year);
        result.put("details", details);
        result.put("timestamp", OffsetDateTime.now());
        return result;
    }

    @Transactional
    public Map<String, Object> runBatchMonthlyBilling() {
        return runBatchMonthlyBilling(null, null, null, "UNPAID", false);
    }

    /**
     * Aggregated B2B Financial & GST Ledger Statistics
     */
    public Map<String, Object> getInvoiceStats() {
        double totalRevenue = 0.0;
        double totalGst = 0.0;
        double pendingReceivables = 0.0;
        long paidCount = 0;
        long unpaidCount = 0;
        long totalInvoices = 0;

        List<Object[]> breakdown = invoiceRepository.getStatusFinancialBreakdown();
        for (Object[] row : breakdown) {
            if (row == null || row.length < 4 || row[0] == null) continue;
            String status = row[0].toString().toUpperCase().trim();
            long count = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            double tot = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
            double gst = row[3] != null ? ((Number) row[3]).doubleValue() : 0.0;

            totalInvoices += count;
            if ("PAID".equals(status)) {
                totalRevenue += tot;
                totalGst += gst;
                paidCount += count;
            } else if ("UNPAID".equals(status) || "PENDING".equals(status) || "OVERDUE".equals(status)) {
                pendingReceivables += tot;
                unpaidCount += count;
            }
        }

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        OffsetDateTime endOfMonth = startOfMonth.plusMonths(1).minusNanos(1);
        long invoicesThisMonth = invoiceRepository.countInvoicesBetween(startOfMonth, endOfMonth);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRevenue", Math.round(totalRevenue * 100.0) / 100.0);
        stats.put("totalGstLiability", Math.round(totalGst * 100.0) / 100.0);
        stats.put("pendingReceivables", Math.round(pendingReceivables * 100.0) / 100.0);
        stats.put("paidInvoicesCount", paidCount);
        stats.put("unpaidInvoicesCount", unpaidCount);
        stats.put("totalInvoicesCount", totalInvoices);
        stats.put("invoicesThisMonth", invoicesThisMonth);
        return stats;
    }

    public String getInvoiceHtml(UUID invoiceId) {
        SaaSInvoice inv = invoiceRepository.findById(invoiceId).orElse(null);
        if (inv == null) {
            return "<html><body><h3>Tax Invoice Not Found</h3></body></html>";
        }

        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        String companyName = settings != null && settings.getSaasCompanyName() != null && !settings.getSaasCompanyName().isBlank()
                ? settings.getSaasCompanyName() : "StayEaze SaaS Platform";
        String gstin = settings != null && settings.getSaasGstin() != null ? settings.getSaasGstin() : "29AABCU9603R1ZM";
        String pan = settings != null && settings.getSaasPan() != null ? settings.getSaasPan() : "AABCU9603R";
        String sacCode = settings != null && settings.getSaasSacCode() != null ? settings.getSaasSacCode() : "998314";
        String address = settings != null && settings.getSaasAddress() != null ? settings.getSaasAddress() : "MG Road, Indiranagar, Bengaluru, Karnataka 560038";
        String supportEmail = settings != null && settings.getSaasSupportEmail() != null ? settings.getSaasSupportEmail() : "billing@stayeaze.com";
        String terms = settings != null && settings.getInvoiceTerms() != null ? settings.getInvoiceTerms() : "Computer-generated Tax Invoice issued under Rule 46 of CGST Rules, 2017.";

        OrganizationBillingProfile profile = profileRepository.findByOrganization(inv.getOrganization()).orElse(null);
        String buyerName = profile != null && profile.getLegalName() != null && !profile.getLegalName().isBlank() ? profile.getLegalName() : inv.getOrganization().getName();

        StringBuilder buyerAddr = new StringBuilder();
        if (profile != null) {
            if (profile.getBillingAddress() != null && !profile.getBillingAddress().isBlank()) buyerAddr.append(profile.getBillingAddress());
            if (profile.getCity() != null && !profile.getCity().isBlank()) buyerAddr.append(buyerAddr.length() > 0 ? ", " : "").append(profile.getCity());
            if (profile.getState() != null && !profile.getState().isBlank()) buyerAddr.append(buyerAddr.length() > 0 ? ", " : "").append(profile.getState());
            if (profile.getPincode() != null && !profile.getPincode().isBlank()) buyerAddr.append(" - ").append(profile.getPincode());
        }
        String buyerAddressStr = buyerAddr.length() > 0 ? buyerAddr.toString() : "Karnataka, India";
        String buyerGstin = profile != null && profile.getGstin() != null ? profile.getGstin() : "N/A (B2C)";

        String dateStr = inv.getInvoiceDate() != null ? inv.getInvoiceDate().format(DateTimeFormatter.ofPattern("dd-MMM-yyyy")) : LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MMM-yyyy"));
        String dueDateStr = inv.getDueDate() != null ? inv.getDueDate().format(DateTimeFormatter.ofPattern("dd-MMM-yyyy")) : "Immediate";

        double baseAmount = inv.getAmount() != null ? inv.getAmount() : 0.0;
        double gstAmount = inv.getGstAmount() != null ? inv.getGstAmount() : 0.0;
        double cgst = Math.round((gstAmount / 2.0) * 100.0) / 100.0;
        double sgst = Math.round((gstAmount / 2.0) * 100.0) / 100.0;
        double totalAmount = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0.0;

        boolean isPaid = "PAID".equalsIgnoreCase(inv.getStatus());
        String statusBadgeHtml = isPaid
                ? "<span style='color:#16a34a;font-weight:bold;background:#f0fdf4;padding:3px 8px;border-radius:4px;border:1px solid #bbf7d0;'>PAID</span>"
                : "<span style='color:#ea580c;font-weight:bold;background:#fff7ed;padding:3px 8px;border-radius:4px;border:1px solid #fed7aa;'>UNPAID (Due: " + dueDateStr + ")</span>";

        String paymentLinkHtml = "";
        if (!isPaid && inv.getPaymentLink() != null) {
            paymentLinkHtml = "<div style='margin-top:8px;padding:8px 12px;background:#f8fafc;border:1px dashed #6366f1;border-radius:6px;'>" +
                    "<strong style='color:#4f46e5;'>Online Payment Link:</strong> <a href='" + inv.getPaymentLink() + "' target='_blank' style='color:#4f46e5;font-weight:bold;text-decoration:underline;'>" + inv.getPaymentLink() + "</a>" +
                    "<div style='font-size:9.5px;color:#64748b;margin-top:2px;'>Pay securely via Razorpay (UPI / Corporate Card / NetBanking)</div>" +
                    "</div>";
        }

        String txnId = inv.getTransactionId();
        if ((txnId == null || txnId.isBlank()) && profile != null && profile.getSubscriptionPaymentId() != null) {
            txnId = profile.getSubscriptionPaymentId();
        }
        String txnIdHtml = (txnId != null && !txnId.isBlank())
                ? "<div class='cell-line'><strong>Transaction ID:</strong> <span style='font-family:monospace;font-weight:bold;color:#4f46e5;background:#eef2ff;padding:1px 5px;border-radius:3px;border:1px solid #c7d2fe;'>" + txnId + "</span></div>"
                : "";

        return "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
                "<title>Tax Invoice #" + inv.getInvoiceNumber() + "</title>" +
                "<style>" +
                "  @page { size: A4 portrait; margin: 8mm; }" +
                "  @media print {" +
                "    html, body { background: #ffffff !important; padding: 0 !important; margin: 0 !important; width: 100% !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }" +
                "    .invoice-card { width: 100% !important; max-width: 100% !important; border: 1.5px solid #000 !important; box-shadow: none !important; margin: 0 !important; page-break-inside: avoid !important; }" +
                "  }" +
                "  * { box-sizing: border-box; }" +
                "  body { font-family: Arial, Helvetica, sans-serif; background: #f4f4f5; margin: 0; padding: 12px 0; font-size: 11px; color: #111; display: flex; justify-content: center; }" +
                "  .invoice-card { background: #ffffff; width: 190mm; max-width: 800px; border: 1.5px solid #111; padding: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: flex; flex-direction: column; justify-content: space-between; }" +
                "  .header-box { text-align: center; border-bottom: 1.5px solid #111; padding: 8px 10px; background: #fafafa; }" +
                "  .company-title { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #000; letter-spacing: 0.5px; }" +
                "  .doc-title { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 2px; color: #222; }" +
                "  .doc-sub { font-size: 9.5px; color: #555; margin-top: 1px; font-style: italic; }" +
                "  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5px solid #111; }" +
                "  .cell { padding: 8px 10px; border-right: 1.5px solid #111; }" +
                "  .cell:last-child { border-right: none; }" +
                "  .cell-header { font-size: 10.5px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 4px; color: #333; }" +
                "  .cell-line { font-size: 11px; line-height: 1.45; color: #222; }" +
                "  table.invoice-table { width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #111; }" +
                "  table.invoice-table th, table.invoice-table td { border: 1px solid #111; padding: 6px 8px; text-align: left; font-size: 11px; }" +
                "  table.invoice-table th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 10.5px; color: #000; }" +
                "  .summary-grid { display: grid; grid-template-columns: 1.2fr 1fr; border-bottom: 1.5px solid #111; }" +
                "  .terms-cell { padding: 8px 10px; border-right: 1.5px solid #111; font-size: 10px; color: #444; line-height: 1.4; }" +
                "  table.totals-table { width: 100%; border-collapse: collapse; }" +
                "  table.totals-table td { border: 1px solid #111; padding: 5px 8px; font-size: 11px; }" +
                "  table.totals-table td.lbl { font-weight: bold; text-align: right; background: #fafafa; width: 60%; }" +
                "  table.totals-table td.val { text-align: right; font-weight: bold; }" +
                "  table.totals-table tr.grand-row td { font-size: 12px; font-weight: bold; background: #f0f0f0; border-top: 1.5px solid #000; }" +
                "  .footer-box { padding: 10px 12px; display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; }" +
                "  .disclaimer { font-size: 9.5px; color: #555; max-width: 360px; font-style: italic; line-height: 1.35; }" +
                "  .sign-area { text-align: right; min-width: 200px; }" +
                "  .sign-company { font-size: 10.5px; font-weight: bold; text-transform: uppercase; }" +
                "  .digital-sign-box { margin: 4px 0 3px auto; padding: 4px 8px; border: 1.5px dashed #16a34a; background: #f0fdf4; border-radius: 4px; text-align: left; display: inline-block; width: 190px; }" +
                "  .ds-badge { display: flex; align-items: center; gap: 5px; color: #15803d; font-weight: bold; font-size: 9.5px; margin-bottom: 2px; }" +
                "  .ds-line { font-size: 8.5px; color: #166534; margin: 1px 0; font-family: monospace; }" +
                "  .sign-label { font-size: 9.5px; font-weight: bold; color: #444; border-top: 1px solid #777; padding-top: 2px; margin-top: 2px; inline-block; }" +
                "</style></head><body>" +
                "<div class='invoice-card'>" +
                "  <div class='header-box'>" +
                "    <div class='company-title'>" + companyName + "</div>" +
                "    <div class='doc-title'>OFFICIAL GST TAX INVOICE</div>" +
                "    <div class='doc-sub'>Issued under Rule 46 of Central Goods and Services Tax Rules, 2017</div>" +
                "  </div>" +
                "  <div class='grid-2'>" +
                "    <div class='cell'>" +
                "      <div class='cell-header'>Seller / Service Provider</div>" +
                "      <div class='cell-line'><strong>" + companyName + "</strong></div>" +
                "      <div class='cell-line'>" + address + "</div>" +
                "      <div class='cell-line'><strong>GSTIN:</strong> " + gstin + " | <strong>PAN:</strong> " + pan + "</div>" +
                "      <div class='cell-line'><strong>SAC Code:</strong> " + sacCode + " (IT & Property Software Services)</div>" +
                "      <div class='cell-line'><strong>Support:</strong> " + supportEmail + "</div>" +
                "    </div>" +
                "    <div class='cell'>" +
                "      <div class='cell-header'>Invoice &amp; Subscriber Details</div>" +
                "      <div class='cell-line'><strong>Invoice No:</strong> " + inv.getInvoiceNumber() + "</div>" +
                "      <div class='cell-line'><strong>Invoice Date:</strong> " + dateStr + "</div>" +
                "      <div class='cell-line'><strong>Billed To Org:</strong> " + buyerName + "</div>" +
                "      <div class='cell-line'><strong>Billing Address:</strong> " + buyerAddressStr + "</div>" +
                "      <div class='cell-line'><strong>Subscriber GSTIN:</strong> " + buyerGstin + "</div>" +
                "      <div class='cell-line'><strong>Billing Cycle:</strong> " + (inv.getBillingCycle() != null ? inv.getBillingCycle() : "MONTHLY") + "</div>" +
                "      <div class='cell-line'><strong>Payment Status:</strong> " + statusBadgeHtml + "</div>" +
                txnIdHtml +
                "    </div>" +
                "  </div>" +
                "  <table class='invoice-table'>" +
                "    <thead>" +
                "      <tr>" +
                "        <th style='width: 6%; text-align: center;'>#</th>" +
                "        <th>Description of SaaS Subscription Service</th>" +
                "        <th style='width: 12%; text-align: center;'>SAC Code</th>" +
                "        <th style='width: 14%; text-align: right;'>Base Rate</th>" +
                "        <th style='width: 12%; text-align: center;'>GST Rate</th>" +
                "        <th style='width: 16%; text-align: right;'>Taxable Value</th>" +
                "      </tr>" +
                "    </thead>" +
                "    <tbody>" +
                "      <tr>" +
                "        <td style='text-align: center;'>1</td>" +
                "        <td><strong>StayEaze SaaS License - " + inv.getPlanName() + " (" + (inv.getBillingCycle() != null ? inv.getBillingCycle() : "MONTHLY") + ")</strong><br/><span style='font-size:9.5px;color:#555;'>Property &amp; Tenant Management Cloud Platform License</span></td>" +
                "        <td style='text-align: center;'>998314</td>" +
                "        <td style='text-align: right;'>&#8377;" + String.format("%.2f", baseAmount) + "</td>" +
                "        <td style='text-align: center;'>18.0% GST</td>" +
                "        <td style='text-align: right;'>&#8377;" + String.format("%.2f", baseAmount) + "</td>" +
                "      </tr>" +
                "    </tbody>" +
                "  </table>" +
                "  <div class='summary-grid'>" +
                "    <div class='terms-cell'>" +
                "      <div class='cell-header'>Terms &amp; Declarations</div>" +
                "      <div>" + terms + "</div>" +
                "      <div style='margin-top: 4px; font-weight: bold;'>Reverse Charge Applicable: NO</div>" +
                paymentLinkHtml +
                "    </div>" +
                "    <div>" +
                "      <table class='totals-table'>" +
                "        <tr><td class='lbl'>Sub Total (Taxable)</td><td class='val'>&#8377;" + String.format("%.2f", baseAmount) + "</td></tr>" +
                "        <tr><td class='lbl'>CGST @ 9.0%</td><td class='val'>&#8377;" + String.format("%.2f", cgst) + "</td></tr>" +
                "        <tr><td class='lbl'>SGST @ 9.0%</td><td class='val'>&#8377;" + String.format("%.2f", sgst) + "</td></tr>" +
                "        <tr class='grand-row'><td class='lbl'>Total Invoice Amount</td><td class='val'>&#8377;" + String.format("%.2f", totalAmount) + "</td></tr>" +
                "      </table>" +
                "    </div>" +
                "  </div>" +
                "  <div class='footer-box'>" +
                "    <div class='disclaimer'>This is an official computer-generated Tax Invoice issued under Rule 46 of CGST Rules, 2017. No physical signature required.</div>" +
                "    <div class='sign-area'>" +
                "      <div class='sign-company'>" + companyName + "</div>" +
                "      <div class='digital-sign-box'>" +
                "        <div class='ds-badge'>&#10004; Digitally Signed Tax Invoice</div>" +
                "        <div class='ds-line'>Signer: StayEaze Billing Auth</div>" +
                "        <div class='ds-line'>Date: " + dateStr + "</div>" +
                "      </div>" +
                "      <div class='sign-label'>Authorized Signatory</div>" +
                "    </div>" +
                "  </div>" +
                "</div></body></html>";
    }
}
