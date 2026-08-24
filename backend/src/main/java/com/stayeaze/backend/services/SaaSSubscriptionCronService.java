package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.SaaSInvoice;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RefreshTokenRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class SaaSSubscriptionCronService {

    private static final Logger logger = LoggerFactory.getLogger(SaaSSubscriptionCronService.class);

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private SaaSInvoiceService saasInvoiceService;

    @Autowired
    private SaaSInvoiceRepository invoiceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private EmailService emailService;

    /**
     * Nightly Cron Job: Runs at 2:00 AM daily.
     * Evaluates T-5 renewal bill generation and grace-period lockdown enforcement.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public Map<String, Object> processDailySubscriptionLifecycle() {
        logger.info("Starting automated SaaS Subscription Lifecycle Cron (T-5 billing & lockdown evaluation)...");
        List<Organization> orgs = organizationRepository.findAll();
        LocalDate today = LocalDate.now();
        OffsetDateTime now = OffsetDateTime.now();

        int evaluatedCount = 0;
        int generatedCount = 0;
        int suspendedCount = 0;
        int skippedCount = 0;
        List<Map<String, Object>> actions = new ArrayList<>();

        for (Organization org : orgs) {
            if (org == null || "system".equalsIgnoreCase(org.getSubdomain())) {
                continue;
            }
            evaluatedCount++;

            OrganizationBillingProfile profile = profileRepository.findByOrganization(org)
                    .orElseGet(() -> profileRepository.save(new OrganizationBillingProfile(org)));

            OffsetDateTime endDate = profile.getSubscriptionEndDate();
            if (endDate == null) {
                // If not set, initialize to 30 days from now
                endDate = now.plusMonths(1);
                profile.setSubscriptionEndDate(endDate);
                profileRepository.save(profile);
            }

            LocalDate endLocalDate = endDate.toLocalDate();
            long daysUntilExpiry = java.time.temporal.ChronoUnit.DAYS.between(today, endLocalDate);

            // Phase 1: T-5 Days Auto-Billing Generation
            // If subscription expires in <= 5 days (or is already due) and no invoice issued yet for upcoming cycle
            if (daysUntilExpiry <= 5) {
                SaaSInvoice existing = saasInvoiceService.checkDuplicateInvoice(org.getId(), profile.getSubscriptionBillingCycle());
                if (existing == null) {
                    try {
                        String cycle = profile.getSubscriptionBillingCycle() != null ? profile.getSubscriptionBillingCycle() : "MONTHLY";
                        SaaSInvoice inv = saasInvoiceService.generateInvoiceForOrg(
                                org.getId(),
                                null,
                                "UNPAID",
                                profile.getSubscriptionPlanName(),
                                cycle,
                                false,
                                "Automated T-5 Subscription Renewal Invoice"
                        );
                        generatedCount++;

                        // Dispatch email alert to organization Owner
                        sendRenewalNotificationEmail(org, inv, daysUntilExpiry);

                        Map<String, Object> logItem = new HashMap<>();
                        logItem.put("orgId", org.getId());
                        logItem.put("orgName", org.getName());
                        logItem.put("action", "GENERATED_T5_INVOICE");
                        logItem.put("invoiceNumber", inv.getInvoiceNumber());
                        logItem.put("amount", inv.getTotalAmount());
                        logItem.put("daysUntilExpiry", daysUntilExpiry);
                        actions.add(logItem);
                    } catch (Exception e) {
                        logger.error("Failed to generate T-5 invoice for org {}: {}", org.getName(), e.getMessage());
                    }
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }

            // Phase 2: Grace Period Expiration & Workspace Suspension
            // If t > endDate + 3 Days Grace Period and status is still not marked EXPIRED/SUSPENDED
            OffsetDateTime gracePeriodEnd = endDate.plusDays(3);
            if (now.isAfter(gracePeriodEnd)) {
                // Check if the organization has an unpaid invoice past due
                boolean hasUnpaid = invoiceRepository.findByOrganization(org).stream()
                        .anyMatch(i -> "UNPAID".equalsIgnoreCase(i.getStatus()) || "OVERDUE".equalsIgnoreCase(i.getStatus()));

                if (hasUnpaid || "EXPIRED".equalsIgnoreCase(profile.getSubscriptionStatus())) {
                    if (!"SUSPENDED".equalsIgnoreCase(profile.getSubscriptionStatus())) {
                        profile.setSubscriptionStatus("SUSPENDED");
                        profile.setUpdatedAt(now);
                        profileRepository.save(profile);
                        suspendedCount++;

                        // Invalidate active session tokens to enforce session-level lockdown
                        invalidateOrgSessions(org);

                        Map<String, Object> logItem = new HashMap<>();
                        logItem.put("orgId", org.getId());
                        logItem.put("orgName", org.getName());
                        logItem.put("action", "WORKSPACE_SUSPENDED_LOCKDOWN");
                        logItem.put("reason", "3-day grace period exceeded after " + endLocalDate);
                        actions.add(logItem);
                    }
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("evaluatedSubscribers", evaluatedCount);
        result.put("generatedInvoices", generatedCount);
        result.put("suspendedWorkspaces", suspendedCount);
        result.put("skippedCount", skippedCount);
        result.put("actions", actions);
        result.put("timestamp", now);
        logger.info("SaaS Subscription Lifecycle Cron complete. Generated: {}, Suspended: {}, Skipped: {}",
                generatedCount, suspendedCount, skippedCount);
        return result;
    }

    /**
     * When an invoice is paid (manual mark paid, Razorpay auto-debit, webhook):
     * Extends subscription validity and restores ACTIVE workspace access.
     */
    @Transactional
    public void reconcilePaidSubscription(UUID invoiceId) {
        SaaSInvoice inv = invoiceRepository.findById(invoiceId).orElse(null);
        if (inv == null || inv.getOrganization() == null) return;

        Organization org = inv.getOrganization();
        OrganizationBillingProfile profile = profileRepository.findByOrganization(org)
                .orElseGet(() -> profileRepository.save(new OrganizationBillingProfile(org)));

        OffsetDateTime currentEnd = profile.getSubscriptionEndDate();
        OffsetDateTime baseTime = (currentEnd != null && currentEnd.isAfter(OffsetDateTime.now()))
                ? currentEnd
                : OffsetDateTime.now();

        String cycle = inv.getBillingCycle() != null ? inv.getBillingCycle().toUpperCase().trim() : "MONTHLY";
        OffsetDateTime newEnd;

        if ("ANNUAL".equalsIgnoreCase(cycle) || "YEARLY".equalsIgnoreCase(cycle)) {
            newEnd = baseTime.plusYears(1);
        } else if ("QUARTERLY".equalsIgnoreCase(cycle)) {
            newEnd = baseTime.plusMonths(3);
        } else {
            newEnd = baseTime.plusMonths(1);
        }

        profile.setSubscriptionEndDate(newEnd);
        profile.setSubscriptionStatus("ACTIVE");
        profile.setSubscriptionPlanName(inv.getPlanName());
        profile.setUpdatedAt(OffsetDateTime.now());
        profileRepository.save(profile);

        logger.info("Subscription reconciled for {}. Extended to: {} ({})", org.getName(), newEnd, cycle);
    }

    private void invalidateOrgSessions(Organization org) {
        try {
            List<User> users = userRepository.findByOrganizationId(org.getId());
            for (User u : users) {
                refreshTokenRepository.deleteByUser(u);
            }
        } catch (Exception e) {
            logger.warn("Could not invalidate sessions for org {}: {}", org.getName(), e.getMessage());
        }
    }

    private void sendRenewalNotificationEmail(Organization org, SaaSInvoice inv, long daysRemaining) {
        try {
            List<User> users = userRepository.findByOrganizationId(org.getId());
            User owner = users.stream()
                    .filter(u -> u.getRoles().stream().anyMatch(r -> r.getName().contains("OWNER")))
                    .findFirst()
                    .orElse(users.isEmpty() ? null : users.get(0));

            if (owner != null && owner.getEmail() != null) {
                String subject = "Upcoming Subscription Renewal Notice - " + org.getName() + " (Invoice #" + inv.getInvoiceNumber() + ")";
                String body = "<html><body>" +
                        "<h3>Dear " + (owner.getFirstName() != null ? owner.getFirstName() : "Owner") + ",</h3>" +
                        "<p>Your StayEaze SaaS Subscription for <strong>" + org.getName() + "</strong> expires in <strong>" + Math.max(0, daysRemaining) + " day(s)</strong>.</p>" +
                        "<div style='background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;'>" +
                        "<p><strong>Invoice Number:</strong> " + inv.getInvoiceNumber() + "</p>" +
                        "<p><strong>Plan:</strong> " + inv.getPlanName() + " (" + (inv.getBillingCycle() != null ? inv.getBillingCycle() : "MONTHLY") + ")</p>" +
                        "<p><strong>Total Amount Due:</strong> ₹" + String.format("%.2f", inv.getTotalAmount()) + " (incl. 18% GST)</p>" +
                        "<p><strong>Due Date:</strong> " + (inv.getDueDate() != null ? inv.getDueDate().toLocalDate() : "Immediate") + "</p>" +
                        "</div>" +
                        (inv.getPaymentLink() != null ? "<p><a href='" + inv.getPaymentLink() + "' style='background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;'>Pay Securely Online via Razorpay</a></p>" : "") +
                        "<p style='color:#64748b;font-size:12px;'>Please complete payment before the due date to ensure uninterrupted property management access.</p>" +
                        "<p>Best regards,<br/>StayEaze Billing &amp; SaaS Governance Team</p>" +
                        "</body></html>";

                emailService.dispatchEmail(owner.getEmail(), subject, body, true);
            }
        } catch (Exception e) {
            logger.warn("Could not send renewal notice email for org {}: {}", org.getName(), e.getMessage());
        }
    }
}
