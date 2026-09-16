package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.payload.response.MinimalTenantDTO;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class TenantNoticePeriodService {

    private static final Logger logger = LoggerFactory.getLogger(TenantNoticePeriodService.class);

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private RedisCacheService redisCacheService;

    /**
     * Daily scheduled sweep to detect leases in notice period and send timely renewal/move-out alerts.
     */
    @Scheduled(cron = "0 0 9 * * *") // Daily at 9:00 AM
    @Transactional
    public Map<String, Object> checkAndSendNoticePeriodReminders() {
        return checkAndSendNoticePeriodReminders(null);
    }

    @Transactional
    public Map<String, Object> checkAndSendNoticePeriodReminders(Organization org) {
        List<Tenant> activeTenants = org != null
                ? tenantRepository.findByOrganizationIdNative(org.getId())
                : tenantRepository.findAllSuperAdmin();

        LocalDate today = LocalDate.now();
        List<Tenant> notifiedTenants = new ArrayList<>();
        int remindersSent = 0;

        for (Tenant tenant : activeTenants) {
            if (!"ACTIVE".equalsIgnoreCase(tenant.getStatus())) {
                continue;
            }
            if (tenant.getLeaseEnd() == null || tenant.getLeaseEnd().isBlank()) {
                continue;
            }

            try {
                LocalDate leaseEndDate = LocalDate.parse(tenant.getLeaseEnd().trim());
                long daysRemaining = ChronoUnit.DAYS.between(today, leaseEndDate);
                int noticeDays = tenant.getNoticePeriodDays() != null && tenant.getNoticePeriodDays() > 0 ? tenant.getNoticePeriodDays() : 30;

                // If within the notice period window (e.g. 0 to 30 days)
                if (daysRemaining >= 0 && daysRemaining <= noticeDays) {
                    // Check if we should send a reminder (no reminder sent yet, or > 7 days since last reminder)
                    boolean shouldSend = false;
                    if (tenant.getLastNoticeReminderSentAt() == null) {
                        shouldSend = true;
                    } else {
                        long daysSinceLastReminder = ChronoUnit.DAYS.between(tenant.getLastNoticeReminderSentAt().toLocalDate(), today);
                        if (daysSinceLastReminder >= 7) {
                            shouldSend = true;
                        }
                    }

                    if (shouldSend) {
                        sendReminderEmailAndNotification(tenant, daysRemaining, leaseEndDate);
                        tenant.setLastNoticeReminderSentAt(OffsetDateTime.now());
                        tenant.setNoticeStatus("REMINDER_SENT");
                        notifiedTenants.add(tenant);
                        remindersSent++;
                    }
                }
            } catch (Exception e) {
                logger.warn("Error processing lease notice for tenant ID {}: {}", tenant.getId(), e.getMessage());
            }
        }

        if (!notifiedTenants.isEmpty()) {
            tenantRepository.saveAll(notifiedTenants);
            redisCacheService.evictTenantCaches();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalChecked", activeTenants.size());
        result.put("remindersSent", remindersSent);
        result.put("message", "Notice period reminder sweep completed successfully.");
        return result;
    }

    /**
     * Send manual notice reminder to a single resident.
     */
    @Transactional
    public Map<String, Object> sendSingleTenantNoticeReminder(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found with ID: " + tenantId));

        if (tenant.getLeaseEnd() == null || tenant.getLeaseEnd().isBlank()) {
            throw new IllegalStateException("Tenant does not have a configured lease end date.");
        }

        LocalDate leaseEndDate = LocalDate.parse(tenant.getLeaseEnd().trim());
        long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), leaseEndDate);

        sendReminderEmailAndNotification(tenant, daysRemaining, leaseEndDate);
        tenant.setLastNoticeReminderSentAt(OffsetDateTime.now());
        tenant.setNoticeStatus("REMINDER_SENT");
        tenantRepository.save(tenant);
        redisCacheService.evictTenantCaches();

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("tenantId", tenant.getId());
        result.put("tenantName", tenant.getName());
        result.put("daysRemaining", daysRemaining);
        result.put("message", "Notice period reminder dispatched successfully.");
        return result;
    }

    /**
     * Retrieve all active residents currently in their lease expiration notice window.
     */
    @Transactional(readOnly = true)
    public List<MinimalTenantDTO> getExpiringLeasesInNoticeWindow(Organization org) {
        List<Tenant> activeTenants = org != null
                ? tenantRepository.findByOrganizationIdNative(org.getId())
                : tenantRepository.findAllSuperAdmin();

        LocalDate today = LocalDate.now();
        List<MinimalTenantDTO> expiring = new ArrayList<>();

        for (Tenant t : activeTenants) {
            if (!"ACTIVE".equalsIgnoreCase(t.getStatus()) || t.getLeaseEnd() == null || t.getLeaseEnd().isBlank()) {
                continue;
            }
            try {
                LocalDate leaseEnd = LocalDate.parse(t.getLeaseEnd().trim());
                long daysRemaining = ChronoUnit.DAYS.between(today, leaseEnd);
                int noticeDays = t.getNoticePeriodDays() != null && t.getNoticePeriodDays() > 0 ? t.getNoticePeriodDays() : 30;

                if (daysRemaining >= 0 && daysRemaining <= noticeDays) {
                    expiring.add(MinimalTenantDTO.fromEntity(t));
                }
            } catch (Exception ignored) {}
        }

        return expiring;
    }

    private void sendReminderEmailAndNotification(Tenant tenant, long daysRemaining, LocalDate leaseEndDate) {
        String propName = "StayEaze Residency";
        if (tenant.getPropertyId() != null) {
            Property p = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
            if (p != null) propName = p.getName();
        }

        // 1. Email notification
        if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
            try {
                String subject = "🔔 Lease Notice Period Alert - " + daysRemaining + " Days Remaining | " + propName;
                String htmlBody = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>"
                        + "<h2 style='color: #4f46e5; margin-top: 0;'>Lease Notice Period Reminder</h2>"
                        + "<p>Dear <strong>" + tenant.getName() + "</strong>,</p>"
                        + "<p>This is a friendly reminder that your current residency lease at <strong>" + propName + "</strong> (Room " + (tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "N/A") + ") is scheduled to end on <strong>" + leaseEndDate.toString() + "</strong> (in <strong>" + daysRemaining + " days</strong>).</p>"
                        + "<p>Under your tenancy agreement, please take one of the following actions at your earliest convenience:</p>"
                        + "<div style='background-color: #f8fafc; padding: 15px; border-left: 4px solid #4f46e5; margin: 15px 0;'>"
                        + "<p style='margin: 0 0 10px 0;'><strong>Option 1: Request Lease Renewal / Extension</strong><br/>Contact property management or submit a renewal request via your StayEaze Resident Portal.</p>"
                        + "<p style='margin: 0;'><strong>Option 2: Submit Move-Out Notice</strong><br/>If you plan to vacate at lease end, please submit your formal 30-day move-out notice via the portal to initiate security deposit reconciliation.</p>"
                        + "</div>"
                        + "<p>Thank you for choosing " + propName + "!</p>"
                        + "<p style='color: #64748b; font-size: 12px; margin-top: 30px;'>StayEaze Automated Property Management Engine</p>"
                        + "</div>";

                emailService.dispatchEmail(tenant.getEmail(), subject, htmlBody, true);
            } catch (Exception e) {
                logger.warn("Could not dispatch notice period reminder email to {}: {}", tenant.getEmail(), e.getMessage());
            }
        }

        // 2. In-App STOMP broadcast / notification
        try {
            UUID targetUserId = tenant.getId();
            webSocketNotificationService.sendUserNotification(
                    targetUserId,
                    "🔔 Lease Notice Period Alert",
                    "Your lease expires in " + daysRemaining + " days (" + leaseEndDate + "). Please confirm renewal or move-out.",
                    "WARNING"
            );
        } catch (Exception ignored) {}
    }
}
