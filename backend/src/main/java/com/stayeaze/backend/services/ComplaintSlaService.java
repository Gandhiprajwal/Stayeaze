package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Complaint;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.repository.ComplaintRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ComplaintSlaService {

    private static final Logger logger = LoggerFactory.getLogger(ComplaintSlaService.class);

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private RedisCacheService redisCacheService;

    /**
     * Compute target SLA deadline based on Complaint category & priority.
     */
    public OffsetDateTime calculateSlaDeadline(String category, String priority, OffsetDateTime baseTime) {
        if (baseTime == null) baseTime = OffsetDateTime.now();
        String prio = priority != null ? priority.toUpperCase() : "MEDIUM";
        String cat = category != null ? category.toUpperCase() : "OTHER";

        int targetHours = 24; // default medium

        if ("CRITICAL".equals(prio)) {
            targetHours = 4;
        } else if ("HIGH".equals(prio) || "ELECTRICAL".equals(cat) || "PLUMBING".equals(cat)) {
            targetHours = 12;
        } else if ("LOW".equals(prio) || "HOUSEKEEPING".equals(cat) || "OTHER".equals(cat)) {
            targetHours = 48;
        } else {
            // MEDIUM WIFI / APPLIANCE / GENERAL
            targetHours = 24;
        }

        return baseTime.plusHours(targetHours);
    }

    /**
     * Manually or automatically escalate a complaint to Owner & Property Manager level.
     */
    @Transactional
    public Complaint escalateComplaint(UUID complaintId, String reason, String actorName) {
        Complaint complaint = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new IllegalArgumentException("Complaint not found with ID: " + complaintId));

        if ("RESOLVED".equalsIgnoreCase(complaint.getStatus())) {
            throw new IllegalStateException("Cannot escalate an already resolved ticket.");
        }

        complaint.setIsEscalated(true);
        complaint.setEscalatedAt(OffsetDateTime.now());
        complaint.setEscalationReason(reason != null && !reason.isBlank() ? reason : "Escalated by " + (actorName != null ? actorName : "Resident/Staff"));
        if (!"CRITICAL".equalsIgnoreCase(complaint.getPriority())) {
            complaint.setPriority("HIGH");
        }

        Complaint saved = complaintRepository.save(complaint);
        redisCacheService.evictComplaintMaintenanceCaches();

        // Broadcast STOMP escalation notification
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("ticketNumber", saved.getTicketNumber());
            payload.put("complaintId", saved.getId());
            payload.put("type", "COMPLAINT_ESCALATED");
            payload.put("title", "🚨 Complaint Escalated: " + saved.getTicketNumber());
            payload.put("message", "Ticket escalated! Reason: " + saved.getEscalationReason());
            payload.put("priority", saved.getPriority());
            payload.put("category", saved.getCategory());
            payload.put("status", saved.getStatus());
            webSocketNotificationService.broadcastTopic("/topic/complaints", payload);
            webSocketNotificationService.broadcastTopic("/topic/complaints/" + saved.getId(), payload);
        } catch (Exception e) {
            logger.warn("Could not broadcast complaint escalation STOMP message: {}", e.getMessage());
        }

        return saved;
    }

    /**
     * Routine check to flag breached complaints and broadcast SLA warning alerts.
     */
    @Scheduled(cron = "0 */15 * * * *") // Runs every 15 minutes
    @Transactional
    public int checkAndEscalateBreachedComplaints() {
        OffsetDateTime now = OffsetDateTime.now();
        List<Complaint> openComplaints = complaintRepository.findAll().stream()
                .filter(c -> !"RESOLVED".equalsIgnoreCase(c.getStatus()) && c.getResolvedAt() == null)
                .collect(Collectors.toList());

        List<Complaint> changedComplaints = new java.util.ArrayList<>();
        int breachedCount = 0;
        for (Complaint c : openComplaints) {
            boolean modified = false;
            OffsetDateTime slaDue = c.getSlaDueAt();
            if (slaDue == null && c.getCreatedAt() != null) {
                slaDue = calculateSlaDeadline(c.getCategory(), c.getPriority(), c.getCreatedAt());
                c.setSlaDueAt(slaDue);
                modified = true;
            }

            if (slaDue != null && now.isAfter(slaDue)) {
                if (!Boolean.TRUE.equals(c.getSlaBreached())) {
                    c.setSlaBreached(true);
                    breachedCount++;
                    modified = true;
                    logger.warn("SLA BREACH DETECTED for Ticket {}: Due at {}, Now is {}", c.getTicketNumber(), slaDue, now);
                }
            }

            if (modified) {
                changedComplaints.add(c);
            }
        }

        if (!changedComplaints.isEmpty()) {
            try {
                complaintRepository.saveAll(changedComplaints);
                redisCacheService.evictComplaintMaintenanceCaches();
            } catch (Exception e) {
                logger.error("Failed to persist breached complaints during SLA check: {}", e.getMessage());
            }
        }

        return breachedCount;
    }

    /**
     * Compute comprehensive SLA performance metrics for an organization.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getSlaMetrics(Organization org) {
        List<Complaint> complaints = complaintRepository.findAll();
        if (org != null) {
            complaints = complaints.stream()
                    .filter(c -> c.getTenant() != null && c.getTenant().getOrganization() != null &&
                            c.getTenant().getOrganization().getId().equals(org.getId()))
                    .collect(Collectors.toList());
        }

        OffsetDateTime now = OffsetDateTime.now();
        long totalComplaints = complaints.size();
        long openTickets = complaints.stream().filter(c -> !"RESOLVED".equalsIgnoreCase(c.getStatus()) && c.getResolvedAt() == null).count();
        long resolvedTickets = complaints.stream().filter(c -> "RESOLVED".equalsIgnoreCase(c.getStatus()) || c.getResolvedAt() != null).count();
        long escalatedTickets = complaints.stream().filter(c -> Boolean.TRUE.equals(c.getIsEscalated())).count();

        long breachedTickets = complaints.stream().filter(c -> {
            if (Boolean.TRUE.equals(c.getSlaBreached())) return true;
            OffsetDateTime slaDue = c.getSlaDueAt();
            if (slaDue == null && c.getCreatedAt() != null) {
                slaDue = calculateSlaDeadline(c.getCategory(), c.getPriority(), c.getCreatedAt());
            }
            if ("RESOLVED".equalsIgnoreCase(c.getStatus()) || c.getResolvedAt() != null) {
                OffsetDateTime resAt = c.getResolvedAt() != null ? c.getResolvedAt() : now;
                return slaDue != null && resAt.isAfter(slaDue);
            } else {
                return slaDue != null && now.isAfter(slaDue);
            }
        }).count();

        long dueSoonTickets = complaints.stream().filter(c -> {
            if ("RESOLVED".equalsIgnoreCase(c.getStatus()) || c.getResolvedAt() != null) return false;
            OffsetDateTime slaDue = c.getSlaDueAt();
            if (slaDue == null && c.getCreatedAt() != null) {
                slaDue = calculateSlaDeadline(c.getCategory(), c.getPriority(), c.getCreatedAt());
            }
            if (slaDue == null) return false;
            long mins = Duration.between(now, slaDue).toMinutes();
            return mins >= 0 && mins <= 360; // within next 6 hours
        }).count();

        double slaCompliance = 100.0;
        if (totalComplaints > 0) {
            slaCompliance = Math.max(0.0, Math.round(((double) (totalComplaints - breachedTickets) / totalComplaints) * 1000.0) / 10.0);
        }

        // Calculate average resolution time in hours
        List<Double> resolutionHours = complaints.stream()
                .filter(c -> c.getResolvedAt() != null && c.getCreatedAt() != null)
                .map(c -> (double) Duration.between(c.getCreatedAt(), c.getResolvedAt()).toMinutes() / 60.0)
                .collect(Collectors.toList());

        double avgResolutionHours = resolutionHours.isEmpty() ? 0.0 :
                Math.round(resolutionHours.stream().mapToDouble(Double::doubleValue).average().orElse(0.0) * 10.0) / 10.0;

        // Breakdown by category
        Map<String, Map<String, Object>> categoryStats = new LinkedHashMap<>();
        for (String cat : List.of("PLUMBING", "ELECTRICAL", "WIFI", "HOUSEKEEPING", "OTHER")) {
            List<Complaint> catComplaints = complaints.stream()
                    .filter(c -> cat.equalsIgnoreCase(c.getCategory()))
                    .collect(Collectors.toList());
            long count = catComplaints.size();
            long catBreached = catComplaints.stream().filter(c -> Boolean.TRUE.equals(c.getSlaBreached())).count();
            Map<String, Object> stat = new HashMap<>();
            stat.put("total", count);
            stat.put("breached", catBreached);
            stat.put("complianceRate", count > 0 ? Math.round(((double) (count - catBreached) / count) * 1000.0) / 10.0 : 100.0);
            categoryStats.put(cat, stat);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalTickets", totalComplaints);
        result.put("openTickets", openTickets);
        result.put("resolvedTickets", resolvedTickets);
        result.put("escalatedTickets", escalatedTickets);
        result.put("breachedTickets", breachedTickets);
        result.put("dueSoonTickets", dueSoonTickets);
        result.put("slaCompliancePercentage", slaCompliance);
        result.put("avgResolutionHours", avgResolutionHours);
        result.put("categoryBreakdown", categoryStats);

        return result;
    }
}
