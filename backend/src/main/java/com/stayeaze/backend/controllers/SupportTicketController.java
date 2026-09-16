package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SupportTicket;
import com.stayeaze.backend.models.SupportTicketMessage;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.PageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.SupportTicketMessageRepository;
import com.stayeaze.backend.repository.SupportTicketRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/support/tickets")
public class SupportTicketController {

    private static final Set<String> ALLOWED_CATEGORIES = Set.of(
            "TECHNICAL_BUG", "PAYMENT_GATEWAY", "BILLING_ISSUE", "PROPERTY_STRUCTURE",
            "TENANT_ONBOARDING", "FINANCE_TAX_INVOICING", "NOTIFICATIONS_MESSAGING",
            "ACCOUNT_SECURITY", "DATA_MIGRATION", "FEATURE_REQUEST", "OTHER"
    );

    private static final Set<String> ALLOWED_PRIORITIES = Set.of(
            "LOW", "MEDIUM", "HIGH", "URGENT"
    );

    private static final Set<String> ALLOWED_STATUSES = Set.of(
            "OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"
    );

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private SupportTicketMessageRepository supportTicketMessageRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.stayeaze.backend.repository.OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private com.stayeaze.backend.repository.PropertyRepository propertyRepository;

    @Autowired
    private com.stayeaze.backend.repository.UserJourneyAuditRepository userJourneyAuditRepository;

    @Autowired(required = false)
    private com.stayeaze.backend.services.WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    private UserDetailsImpl getCurrentUserDetails() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            return null;
        }
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetailsImpl) {
            return (UserDetailsImpl) principal;
        }
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            return null;
        }
        User user = userRepository.findByEmail(username).orElseGet(() ->
                userRepository.findByMobile(username).orElse(null));
        if (user != null) {
            return UserDetailsImpl.build(user);
        }
        return null;
    }

    private String getUserDisplayName(User u) {
        if (u == null) return "User";
        if (u.getFirstName() != null && !u.getFirstName().isBlank()) {
            return u.getFirstName();
        }
        return u.getEmail() != null ? u.getEmail() : "User";
    }

    private boolean isPlatformStaff() {
        if (SecurityContextHolder.getContext().getAuthentication() == null ||
            SecurityContextHolder.getContext().getAuthentication().getAuthorities() == null) {
            return false;
        }
        return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPPORT".equals(a.getAuthority()) || "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
    }

    /**
     * Any authenticated user (Tenant, Staff, Owner, Admin, PM, etc.) can raise Application Support Tickets.
     */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @org.springframework.cache.annotation.CacheEvict(value = "support_ticket_stats", allEntries = true)
    public ResponseEntity<?> createSupportTicket(@RequestBody Map<String, Object> body) {
        UserDetailsImpl userDetails = getCurrentUserDetails();
        Organization org = null;
        User user = null;

        if (userDetails != null) {
            user = userRepository.findById(userDetails.getId()).orElse(null);
            if (userDetails.getOrgId() != null) {
                org = organizationRepository.findById(userDetails.getOrgId()).orElse(null);
            }
        }

        if (user == null) {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            user = userRepository.findByEmail(username).orElseGet(() ->
                    userRepository.findByMobile(username).orElse(null));
        }

        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Error: User session invalid."));
        }

        if (org == null && user.getOrganization() != null) {
            org = user.getOrganization();
        }

        String title = body.get("title") != null ? body.get("title").toString().trim() : "";
        String description = body.get("description") != null ? body.get("description").toString().trim() : "";
        String category = body.get("category") != null ? body.get("category").toString().trim().toUpperCase() : "TECHNICAL_BUG";
        String priority = body.get("priority") != null ? body.get("priority").toString().trim().toUpperCase() : "MEDIUM";
        String contactEmail = body.get("contactEmail") != null ? body.get("contactEmail").toString().trim() : user.getEmail();
        String contactPhone = body.get("contactPhone") != null ? body.get("contactPhone").toString().trim() : user.getMobile();

        if (title.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Ticket title is required."));
        }
        if (description.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Ticket description is required."));
        }
        if (!ALLOWED_CATEGORIES.contains(category)) {
            category = "TECHNICAL_BUG";
        }
        if (!ALLOWED_PRIORITIES.contains(priority)) {
            priority = "MEDIUM";
        }

        // Generate sequential ticket reference: SUP/FY/0001
        String ticketNumber = invoiceSequenceService.nextSupportTicketNumber();

        SupportTicket ticket = new SupportTicket(ticketNumber, org, user, title, description, category, priority);
        ticket.setContactEmail(contactEmail);
        ticket.setContactPhone(contactPhone);

        SupportTicket saved = supportTicketRepository.save(ticket);

        // Also add initial opening message to chat thread
        SupportTicketMessage initialMsg = new SupportTicketMessage(
                saved,
                user,
                "CUSTOMER",
                getUserDisplayName(user),
                description
        );
        supportTicketMessageRepository.save(initialMsg);

        if (webSocketNotificationService != null) {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "NEW_TICKET");
            event.put("ticketId", saved.getId().toString());
            event.put("ticketNumber", saved.getTicketNumber());
            event.put("subject", saved.getTitle());
            event.put("priority", saved.getPriority());
            event.put("category", saved.getCategory());
            event.put("senderName", getUserDisplayName(user));
            webSocketNotificationService.broadcastTopic("/topic/support-tickets", event);
        }

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    /**
     * Get paginated support tickets.
     * - Support/SuperAdmin: Sees all tickets across all organizations.
     * - Customer (Tenant, Staff, Owner, Admin, PM, etc.): Sees ONLY tickets created by their specific user account (createdBy.id).
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getTickets(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "false") boolean mineOnly,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {

        int validatedPage = Math.max(1, page);
        int validatedSize = Math.min(100, Math.max(1, pageSize));
        PageRequest pageRequest = PageRequest.of(validatedPage - 1, validatedSize, Sort.by("createdAt").descending());

        String filterStatus = ("ALL".equalsIgnoreCase(status) || status == null) ? "" : status.trim();
        String filterCategory = ("ALL".equalsIgnoreCase(category) || category == null) ? "" : category.trim();

        Page<SupportTicket> ticketPage;
        if (isPlatformStaff() && !mineOnly) {
            // Platform Staff sees global centralized queue when mineOnly is false
            ticketPage = supportTicketRepository.searchAllTickets(
                    search != null ? search.trim() : "",
                    filterStatus,
                    filterCategory,
                    pageRequest
            );
        } else {
            // When mineOnly is true (e.g. In "My Tickets" modal) or for standard users, fetch ONLY tickets created by their account
            UserDetailsImpl userDetails = getCurrentUserDetails();
            UUID userId = userDetails != null ? userDetails.getId() : UUID.randomUUID();
            ticketPage = supportTicketRepository.searchUserTickets(
                    userId,
                    search != null ? search.trim() : "",
                    filterStatus,
                    filterCategory,
                    pageRequest
            );
        }
        // Populate transient notification routing fields (who sent the last message)
        for (SupportTicket ticket : ticketPage.getContent()) {
            supportTicketMessageRepository.findTopByTicketOrderByCreatedAtDesc(ticket).ifPresent(lastMsg -> {
                ticket.setLastMessageSenderRole(lastMsg.getSenderRole());
                if (lastMsg.getSender() != null) {
                    ticket.setLastMessageSenderId(lastMsg.getSender().getId().toString());
                }
            });
        }

        return ResponseEntity.ok(PageResponse.ofPage(ticketPage.map(com.stayeaze.backend.payload.response.SupportTicketSummaryDTO::fromEntity)));
    }

    /**
     * Get ticket by ID.
     * Non-staff can view ticket if created by them or within their organization.
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getTicketById(@PathVariable UUID id) {
        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        if (!isPlatformStaff()) {
            UserDetailsImpl userDetails = getCurrentUserDetails();
            boolean isCreator = userDetails != null && ticket.getCreatedBy() != null && ticket.getCreatedBy().getId().equals(userDetails.getId());
            boolean isSameOrg = userDetails != null && userDetails.getOrgId() != null && ticket.getOrganization() != null && ticket.getOrganization().getId().equals(userDetails.getOrgId());

            if (!isCreator && !isSameOrg) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new MessageResponse("Access denied. You can only access support tickets created by your organization."));
            }
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.SupportTicketDetailDTO.fromEntity(ticket));
    }

    /**
     * Get two-way chat messages thread for a support ticket.
     */
    @GetMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getTicketMessages(@PathVariable UUID id) {
        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        if (!isPlatformStaff()) {
            UserDetailsImpl userDetails = getCurrentUserDetails();
            boolean isCreator = userDetails != null && ticket.getCreatedBy() != null && ticket.getCreatedBy().getId().equals(userDetails.getId());
            boolean isSameOrg = userDetails != null && userDetails.getOrgId() != null && ticket.getOrganization() != null && ticket.getOrganization().getId().equals(userDetails.getOrgId());

            if (!isCreator && !isSameOrg) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new MessageResponse("Access denied. You can only view chat messages for support tickets created by your organization."));
            }
        }

        List<SupportTicketMessage> messages = supportTicketMessageRepository.findByTicketOrderByCreatedAtAsc(ticket);
        return ResponseEntity.ok(messages);
    }

    /**
     * Send a chat message in the ticket thread.
     * Enforces 24-Hour Resolution Grace Period:
     * - If OPEN / IN_PROGRESS: messages can be sent freely.
     * - If RESOLVED / CLOSED:
     *     - within 24h of resolution: message is accepted, ticket is automatically reopened to IN_PROGRESS.
     *     - after 24h: ticket is permanently locked, returns 400 Bad Request.
     */
    @PostMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> sendTicketMessage(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        UserDetailsImpl userDetails = getCurrentUserDetails();
        User sender = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new RuntimeException("Sender user not found"));

        boolean staff = isPlatformStaff();

        if (!staff) {
            boolean isCreator = ticket.getCreatedBy() != null && ticket.getCreatedBy().getId().equals(sender.getId());
            boolean isSameOrg = sender.getOrganization() != null && ticket.getOrganization() != null && ticket.getOrganization().getId().equals(sender.getOrganization().getId());

            if (!isCreator && !isSameOrg) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new MessageResponse("Access denied. You can only send messages on support tickets created by your organization."));
            }
        }

        String messageText = body.get("message") != null ? body.get("message").toString().trim() : "";
        if (messageText.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Message text cannot be empty."));
        }

        // 24-HOUR RESOLUTION GRACE PERIOD ENFORCEMENT
        if (ticket.isPermanentlyLocked()) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                    "This support ticket was resolved more than 24 hours ago and is permanently closed. Please create a new ticket for further assistance."
            ));
        }

        String senderRole = staff ? "SUPPORT" : "CUSTOMER";
        String senderName = getUserDisplayName(sender);
        if (staff) {
            senderName = "Platform Support (" + senderName + ")";
        }

        SupportTicketMessage chatMessage = new SupportTicketMessage(ticket, sender, senderRole, senderName, messageText);
        SupportTicketMessage savedMessage = supportTicketMessageRepository.save(chatMessage);

        // If customer replies within 24h grace window on a resolved/closed ticket, automatically transition back to IN_PROGRESS!
        if (!staff && ticket.isResolvedOrClosed()) {
            ticket.setStatus("IN_PROGRESS");
        }
        ticket.setUpdatedAt(OffsetDateTime.now());
        supportTicketRepository.save(ticket);

        if (webSocketNotificationService != null) {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "NEW_MESSAGE");
            event.put("ticketId", ticket.getId().toString());
            event.put("ticketNumber", ticket.getTicketNumber());
            event.put("senderRole", senderRole);
            event.put("senderName", senderName);
            event.put("messageSnippet", messageText.length() > 60 ? messageText.substring(0, 57) + "..." : messageText);
            webSocketNotificationService.broadcastTopic("/topic/support-tickets", event);
            webSocketNotificationService.broadcastTopic("/topic/support-tickets/" + ticket.getId() + "/messages", savedMessage);
            if (staff && ticket.getCreatedBy() != null) {
                webSocketNotificationService.sendUserNotification(
                        ticket.getCreatedBy().getId(),
                        "Support Ticket Reply",
                        "Platform Support replied on " + ticket.getTicketNumber() + ": " + (messageText.length() > 60 ? messageText.substring(0, 57) + "..." : messageText),
                        "SUPPORT_REPLY"
                );
            }
        }

        return new ResponseEntity<>(savedMessage, HttpStatus.CREATED);
    }

    /**
     * Triage & Resolve Support Ticket (Strictly SUPPORT Role only).
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPPORT')")
    public ResponseEntity<?> updateTicketStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        if (body.containsKey("status") && body.get("status") != null) {
            String newStatus = body.get("status").toString().trim().toUpperCase();
            if (ALLOWED_STATUSES.contains(newStatus)) {
                ticket.setStatus(newStatus);
                if ("RESOLVED".equals(newStatus) || "CLOSED".equals(newStatus)) {
                    ticket.setResolvedAt(OffsetDateTime.now());
                }
            } else {
                return ResponseEntity.badRequest().body(new MessageResponse("Invalid ticket status: " + newStatus));
            }
        }

        if (body.containsKey("priority") && body.get("priority") != null) {
            String newPriority = body.get("priority").toString().trim().toUpperCase();
            if (ALLOWED_PRIORITIES.contains(newPriority)) {
                ticket.setPriority(newPriority);
            }
        }

        if (body.containsKey("resolutionNotes") && body.get("resolutionNotes") != null) {
            String resNotes = body.get("resolutionNotes").toString().trim();
            ticket.setResolutionNotes(resNotes);

            // Also append resolution guidance to the chat messages thread
            UserDetailsImpl userDetails = getCurrentUserDetails();
            User agentUser = userRepository.findById(userDetails.getId()).orElse(null);
            if (agentUser != null && !resNotes.isBlank()) {
                String agentName = getUserDisplayName(agentUser);
                SupportTicketMessage resolutionMsg = new SupportTicketMessage(
                        ticket,
                        agentUser,
                        "SUPPORT",
                        "Platform Support (" + agentName + ")",
                        "Resolution Provided: " + resNotes
                );
                supportTicketMessageRepository.save(resolutionMsg);
            }
        }

        if (body.containsKey("assignedAgent") && body.get("assignedAgent") != null) {
            ticket.setAssignedAgent(body.get("assignedAgent").toString());
        } else {
            UserDetailsImpl userDetails = getCurrentUserDetails();
            ticket.setAssignedAgent(userDetails.getUsername());
        }

        ticket.setUpdatedAt(OffsetDateTime.now());
        SupportTicket updated = supportTicketRepository.save(ticket);

        if (webSocketNotificationService != null) {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "TICKET_UPDATED");
            event.put("ticketId", ticket.getId().toString());
            event.put("ticketNumber", ticket.getTicketNumber());
            event.put("status", ticket.getStatus());
            webSocketNotificationService.broadcastTopic("/topic/support-tickets", event);
            if (ticket.getCreatedBy() != null) {
                webSocketNotificationService.sendUserNotification(
                        ticket.getCreatedBy().getId(),
                        "Support Ticket " + ticket.getStatus(),
                        "Your ticket " + ticket.getTicketNumber() + " has been marked as " + ticket.getStatus() + ".",
                        "TICKET_STATUS"
                );
            }
        }

        return ResponseEntity.ok(updated);
    }

    /**
     * Diagnostic Data for Support Agent: Subscriber Org Health, Quotas, and Real-Time Telemetry.
     */
    @GetMapping("/{id}/diagnostics")
    @PreAuthorize("hasRole('SUPPORT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getTicketDiagnostics(@PathVariable UUID id) {
        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        Organization org = ticket.getOrganization();
        Map<String, Object> response = new HashMap<>();

        // 1. Organization Vital Details
        Map<String, Object> orgData = new HashMap<>();
        if (org != null) {
            orgData.put("id", org.getId());
            orgData.put("name", org.getName());
            orgData.put("subdomain", org.getSubdomain());
            orgData.put("status", org.getStatus());
            orgData.put("ownerEmail", ticket.getCreatedBy() != null ? ticket.getCreatedBy().getEmail() : ticket.getContactEmail());
            orgData.put("contactPhone", ticket.getCreatedBy() != null ? ticket.getCreatedBy().getMobile() : ticket.getContactPhone());
            orgData.put("createdAt", org.getCreatedAt());
        }
        response.put("organization", orgData);

        // 2. Subscription & SaaS Plan Status
        Map<String, Object> subData = new HashMap<>();
        if (org != null && billingProfileRepository != null) {
            billingProfileRepository.findByOrganization(org).ifPresent(profile -> {
                subData.put("legalName", profile.getLegalName());
                subData.put("planName", profile.getSubscriptionPlanName());
                subData.put("planPrice", profile.getSubscriptionPlanPrice());
                subData.put("billingCycle", profile.getSubscriptionBillingCycle());
                subData.put("status", profile.getSubscriptionStatus());
                subData.put("startDate", profile.getSubscriptionStartDate());
                subData.put("endDate", profile.getSubscriptionEndDate());
                if (profile.getSubscriptionEndDate() != null) {
                    long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(OffsetDateTime.now(), profile.getSubscriptionEndDate());
                    subData.put("daysLeft", daysLeft);
                }
            });
        }
        response.put("subscription", subData);

        // 3. Resource Quotas & Utilization
        Map<String, Object> quotas = new HashMap<>();
        if (org != null && propertyRepository != null) {
            List<com.stayeaze.backend.models.Property> props = propertyRepository.findByOrganizationIdNative(org.getId());
            int totalProps = props.size();
            int totalBeds = 0;
            int occupiedBeds = 0;
            for (com.stayeaze.backend.models.Property p : props) {
                if (p.getTotalBeds() != null) totalBeds += p.getTotalBeds();
                if (p.getOccupiedBeds() != null) occupiedBeds += p.getOccupiedBeds();
            }
            double occupancy = totalBeds > 0 ? ((double) occupiedBeds / totalBeds) * 100.0 : 0.0;

            quotas.put("totalProperties", totalProps);
            quotas.put("totalBeds", totalBeds);
            quotas.put("occupiedBeds", occupiedBeds);
            quotas.put("occupancyRate", Math.round(occupancy * 10.0) / 10.0);
        }
        response.put("quotas", quotas);

        // 4. Live Telemetry & Log Trace (last 15 events for this organization)
        List<Map<String, Object>> telemetryLogs = new ArrayList<>();
        if (org != null && userJourneyAuditRepository != null) {
            Page<com.stayeaze.backend.models.UserJourneyAudit> auditPage = userJourneyAuditRepository.findByOrgIdOrderByCreatedAtDesc(
                    org.getId(), PageRequest.of(0, 15)
            );
            for (com.stayeaze.backend.models.UserJourneyAudit log : auditPage.getContent()) {
                Map<String, Object> logItem = new HashMap<>();
                logItem.put("id", log.getId());
                logItem.put("action", log.getAction());
                logItem.put("category", log.getCategory());
                logItem.put("status", log.getStatus());
                logItem.put("userEmail", log.getUserEmail());
                logItem.put("resourceId", log.getResourceId());
                logItem.put("clientIp", log.getClientIp());
                logItem.put("details", log.getDetails());
                logItem.put("createdAt", log.getCreatedAt());
                telemetryLogs.add(logItem);
            }
        }
        response.put("telemetryLogs", telemetryLogs);

        return ResponseEntity.ok(response);
    }

    /**
     * Escalate Support Ticket to Super Admin.
     * Platform Support agent attaches diagnostic findings and requested action.
     */
    @PostMapping("/{id}/escalate")
    @PreAuthorize("hasRole('SUPPORT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> escalateTicket(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> payload) {

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        String escalationCategory = (String) payload.getOrDefault("escalationCategory", "CRITICAL_SYSTEM_BUG");
        String escalationNotes = (String) payload.getOrDefault("escalationNotes", "");
        String requestedAction = (String) payload.getOrDefault("requestedAction", "");

        if (escalationNotes == null || escalationNotes.trim().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Escalation diagnostic summary/notes are required."));
        }

        UserDetailsImpl userDetails = getCurrentUserDetails();
        User currentUser = null;
        if (userDetails != null) {
            if (userDetails.getId() != null) {
                currentUser = userRepository.findById(userDetails.getId()).orElse(null);
            }
            if (currentUser == null && userDetails.getUsername() != null) {
                currentUser = userRepository.findByEmail(userDetails.getUsername()).orElse(null);
            }
        }
        if (currentUser == null) {
            currentUser = ticket.getCreatedBy();
        }

        ticket.setStatus("ESCALATED");
        ticket.setEscalated(true);
        ticket.setEscalatedAt(OffsetDateTime.now());
        ticket.setEscalatedBy(currentUser);
        ticket.setEscalationCategory(escalationCategory);
        ticket.setEscalationNotes(escalationNotes + (requestedAction.isBlank() ? "" : "\n\n[Requested Super Admin Action]: " + requestedAction));
        ticket.setUpdatedAt(OffsetDateTime.now());

        SupportTicket updated = supportTicketRepository.save(ticket);

        // Record Escalation Marker Message in Ticket Chat Thread
        String senderName = currentUser != null ? getUserDisplayName(currentUser) : "Platform Support";
        String msgContent = String.format("🚨 [ESCALATED TO SUPER ADMIN]\nCategory: %s\nFindings: %s%s",
                escalationCategory,
                escalationNotes,
                requestedAction.isBlank() ? "" : "\nRequested Action: " + requestedAction
        );
        SupportTicketMessage escalationMessage = new SupportTicketMessage(
                ticket,
                currentUser,
                "SUPPORT",
                "Platform Support (" + senderName + ")",
                msgContent
        );
        supportTicketMessageRepository.save(escalationMessage);

        // Real-time broadcast
        if (webSocketNotificationService != null) {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "TICKET_ESCALATED");
            event.put("ticketId", ticket.getId().toString());
            event.put("ticketNumber", ticket.getTicketNumber());
            event.put("organizationName", ticket.getOrganization() != null ? ticket.getOrganization().getName() : "SaaS Subscriber");
            event.put("escalationCategory", escalationCategory);
            event.put("status", "ESCALATED");
            webSocketNotificationService.broadcastTopic("/topic/support-tickets", event);
            webSocketNotificationService.broadcastTopic("/topic/support-tickets/" + ticket.getId() + "/messages", escalationMessage);
            webSocketNotificationService.broadcastTopic("/topic/super-admin/escalations", event);
        }

        return ResponseEntity.ok(updated);
    }

    /**
     * Super Admin Execution Action on Escalated Support Ticket.
     */
    @PutMapping("/{id}/super-admin-action")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> superAdminAction(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> payload) {

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        String nextStatus = payload.get("status") != null ? payload.get("status").toString().trim().toUpperCase() : "RESOLVED";
        if (nextStatus.isBlank()) {
            nextStatus = "RESOLVED";
        }
        String actionNotes = payload.get("actionNotes") != null ? payload.get("actionNotes").toString().trim() : "";
        String resolutionNotes = payload.get("resolutionNotes") != null ? payload.get("resolutionNotes").toString().trim() : "";

        if (!ALLOWED_STATUSES.contains(nextStatus)) {
            nextStatus = "RESOLVED";
        }

        UserDetailsImpl userDetails = getCurrentUserDetails();
        User adminUser = null;
        if (userDetails != null) {
            if (userDetails.getId() != null) {
                adminUser = userRepository.findById(userDetails.getId()).orElse(null);
            }
            if (adminUser == null && userDetails.getUsername() != null) {
                adminUser = userRepository.findByEmail(userDetails.getUsername()).orElse(null);
            }
        }
        if (adminUser == null) {
            adminUser = ticket.getCreatedBy();
        }

        ticket.setStatus(nextStatus.toUpperCase());
        if ("RESOLVED".equalsIgnoreCase(nextStatus) || "CLOSED".equalsIgnoreCase(nextStatus)) {
            ticket.setResolvedAt(OffsetDateTime.now());
        }
        if (!actionNotes.isBlank()) {
            ticket.setSuperAdminActionNotes(actionNotes);
        }
        if (!resolutionNotes.isBlank()) {
            ticket.setResolutionNotes(resolutionNotes);
        }
        ticket.setUpdatedAt(OffsetDateTime.now());

        SupportTicket updated = supportTicketRepository.save(ticket);

        // Record Super Admin Resolution Marker Message in Ticket Chat Thread
        String adminName = adminUser != null ? getUserDisplayName(adminUser) : "Admin";
        String actionMsgContent = String.format("👑 [SUPER ADMIN ACTION EXECUTED]\nStatus: %s\nAction: %s%s",
                nextStatus.toUpperCase(),
                actionNotes.isBlank() ? "Approved and applied." : actionNotes,
                resolutionNotes.isBlank() ? "" : "\nResolution: " + resolutionNotes
        );
        SupportTicketMessage adminMessage = new SupportTicketMessage(
                ticket,
                adminUser,
                "SUPER_ADMIN",
                "Super Administrator (" + adminName + ")",
                actionMsgContent
        );
        supportTicketMessageRepository.save(adminMessage);

        if (webSocketNotificationService != null) {
            Map<String, Object> event = new HashMap<>();
            event.put("type", "SUPER_ADMIN_ACTION");
            event.put("ticketId", ticket.getId().toString());
            event.put("ticketNumber", ticket.getTicketNumber());
            event.put("status", ticket.getStatus());
            webSocketNotificationService.broadcastTopic("/topic/support-tickets", event);
            webSocketNotificationService.broadcastTopic("/topic/support-tickets/" + ticket.getId() + "/messages", adminMessage);
        }

        return ResponseEntity.ok(updated);
    }

    /**
     * Aggregated Ticket Stats for Support Dashboard & Helpdesk Hub.
     */
    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.cache.annotation.Cacheable(value = "support_ticket_stats", key = "(T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication() != null ? T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName() : 'anon')")
    public ResponseEntity<?> getTicketStats() {
        Map<String, Object> stats = new HashMap<>();
        if (isPlatformStaff()) {
            long open = supportTicketRepository.countByStatus("OPEN");
            long inProgress = supportTicketRepository.countByStatus("IN_PROGRESS");
            long escalated = supportTicketRepository.countByStatus("ESCALATED");
            long resolved = supportTicketRepository.countByStatus("RESOLVED");
            long closed = supportTicketRepository.countByStatus("CLOSED");
            long urgent = supportTicketRepository.countByPriority("URGENT");
            long high = supportTicketRepository.countByPriority("HIGH");
            long total = supportTicketRepository.count();

            stats.put("openTickets", open);
            stats.put("inProgressTickets", inProgress);
            stats.put("escalatedTickets", escalated);
            stats.put("resolvedTickets", resolved);
            stats.put("closedTickets", closed);
            stats.put("urgentTickets", urgent);
            stats.put("highTickets", high);
            stats.put("totalTickets", total);
        } else {
            UserDetailsImpl userDetails = getCurrentUserDetails();
            UUID userId = userDetails != null ? userDetails.getId() : null;
            if (userId != null) {
                long open = supportTicketRepository.countByCreatedBy_IdAndStatus(userId, "OPEN");
                long inProgress = supportTicketRepository.countByCreatedBy_IdAndStatus(userId, "IN_PROGRESS");
                long resolved = supportTicketRepository.countByCreatedBy_IdAndStatus(userId, "RESOLVED");
                long closed = supportTicketRepository.countByCreatedBy_IdAndStatus(userId, "CLOSED");
                long total = supportTicketRepository.countByCreatedBy_Id(userId);

                stats.put("openTickets", open);
                stats.put("inProgressTickets", inProgress);
                stats.put("resolvedTickets", resolved);
                stats.put("closedTickets", closed);
                stats.put("totalTickets", total);
            } else {
                stats.put("openTickets", 0);
                stats.put("inProgressTickets", 0);
                stats.put("resolvedTickets", 0);
                stats.put("closedTickets", 0);
                stats.put("totalTickets", 0);
            }
        }
        return ResponseEntity.ok(stats);
    }
}
