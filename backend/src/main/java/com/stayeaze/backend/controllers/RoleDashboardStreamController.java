package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.services.PropertyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/dashboard")
public class RoleDashboardStreamController {

    private static final Logger logger = LoggerFactory.getLogger(RoleDashboardStreamController.class);

    private static class ClientStreamSession {
        final SseEmitter emitter;
        final String userEmail;
        final String role;
        final UUID userId;
        final Organization organization;

        ClientStreamSession(SseEmitter emitter, String userEmail, String role, UUID userId, Organization organization) {
            this.emitter = emitter;
            this.userEmail = userEmail;
            this.role = role;
            this.userId = userId;
            this.organization = organization;
        }
    }

    private final List<ClientStreamSession> sessions = new CopyOnWriteArrayList<>();
    private ScheduledExecutorService executor;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private SystemMetricsController metricsController;

    @Autowired
    private PropertyService propertyService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired(required = false)
    private OnboardingLeadRepository leadRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    @PostConstruct
    public void init() {
        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sse-role-dashboard-streamer");
            t.setDaemon(true);
            return t;
        });
        executor.scheduleAtFixedRate(this::broadcastRoleDashboardMetrics, 3, 3, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void destroy() {
        if (executor != null) {
            executor.shutdown();
        }
    }

    @GetMapping("/metrics")
    public ResponseEntity<?> getDashboardMetrics() {
        String email = null;
        String role = "TENANT";
        UUID userId = null;
        Organization organization = null;

        try {
            User user = securityUtils.getCurrentUser();
            if (user != null) {
                userId = user.getId();
                email = user.getEmail();
                organization = user.getOrganization();
                if (user.getRoles() != null && !user.getRoles().isEmpty()) {
                    role = user.getRoles().iterator().next().getName().replace("ROLE_", "").toUpperCase();
                }
            }
            if (organization == null) {
                organization = securityUtils.getCurrentOrganization();
            }
        } catch (Exception ignored) {}

        ClientStreamSession dummySession = new ClientStreamSession(null, email, role, userId, organization);
        Map<String, Object> payload = buildPayloadForRole(dummySession);
        return ResponseEntity.ok(payload);
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamDashboardMetrics() {
        String email = null;
        String role = "TENANT";
        UUID userId = null;
        Organization organization = null;

        try {
            User user = securityUtils.getCurrentUser();
            if (user != null) {
                userId = user.getId();
                email = user.getEmail();
                organization = user.getOrganization();
                if (user.getRoles() != null && !user.getRoles().isEmpty()) {
                    role = user.getRoles().iterator().next().getName().replace("ROLE_", "").toUpperCase();
                }
            }
            if (organization == null) {
                organization = securityUtils.getCurrentOrganization();
            }
        } catch (Exception ignored) {}

        SseEmitter emitter = new SseEmitter(1800000L); // 30 minutes timeout
        ClientStreamSession session = new ClientStreamSession(emitter, email, role, userId, organization);
        sessions.add(session);

        emitter.onCompletion(() -> sessions.remove(session));
        emitter.onTimeout(() -> sessions.remove(session));
        emitter.onError((e) -> sessions.remove(session));

        // Push immediate initial snapshot
        sendSessionMetrics(session);

        return emitter;
    }

    private void broadcastRoleDashboardMetrics() {
        if (sessions.isEmpty()) return;

        for (ClientStreamSession session : sessions) {
            sendSessionMetrics(session);
        }
    }

    private void sendSessionMetrics(ClientStreamSession session) {
        try {
            Map<String, Object> payload = buildPayloadForRole(session);
            session.emitter.send(SseEmitter.event().name("dashboard-metrics").data(payload));
        } catch (Exception e) {
            sessions.remove(session);
            try {
                session.emitter.complete();
            } catch (Exception ignored) {}
        }
    }

    private Map<String, Object> buildPayloadForRole(ClientStreamSession session) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("role", session.role);
        payload.put("timestamp", System.currentTimeMillis());

        String role = session.role != null ? session.role : "TENANT";
        UUID orgId = session.organization != null ? session.organization.getId() : null;

        try {
            switch (role) {
                case "SUPER_ADMIN":
                    payload.put("systemMetrics", metricsController.getMetrics().getBody());
                    payload.put("totalProperties", propertyRepository.countSuperAdmin());
                    payload.put("totalOrganizations", organizationRepository.count());
                    break;

                case "SUPPORT":
                    payload.put("systemMetrics", metricsController.getMetrics().getBody());
                    payload.put("subscribersCount", organizationRepository.count());
                    payload.put("leadsCount", leadRepository != null ? leadRepository.count() : 0);
                    payload.put("openComplaintsCount", complaintRepository.countOpenComplaintsNative(null));
                    break;

                case "ADMIN":
                case "OWNER":
                case "PROPERTY_MANAGER":
                    User streamUser = session.userId != null ? userRepository.findById(session.userId).orElse(null) : null;
                    List<UUID> assignedProps = streamUser != null ? streamUser.getPropertyIds() : null;

                    Map<String, Object> overallStats = propertyService.getPropertyOverallStats(null, orgId);
                    if (assignedProps != null && !assignedProps.isEmpty() && !"OWNER".equalsIgnoreCase(role) && !"ADMIN".equalsIgnoreCase(role)) {
                        // Recalculate stats for scoped properties (managers/staff only)
                        List<Property> assignedPropList = propertyRepository.findByIdIn(assignedProps);
                        int propCount = assignedPropList.size();
                        int totalBeds = 0;
                        int occBeds = 0;
                        for (Property p : assignedPropList) {
                            if (p.getTotalBeds() != null) totalBeds += p.getTotalBeds();
                            if (p.getOccupiedBeds() != null) occBeds += p.getOccupiedBeds();
                        }
                        overallStats.put("totalProperties", propCount);
                        overallStats.put("totalBeds", totalBeds);
                        overallStats.put("occupiedBeds", occBeds);
                        overallStats.put("availableBeds", Math.max(0, totalBeds - occBeds));
                        double occRate = totalBeds > 0 ? Math.round(((double) occBeds / totalBeds) * 1000.0) / 10.0 : 0.0;
                        overallStats.put("occupancyRate", occRate);
                    }
                    payload.putAll(overallStats);

                    // Occupancy breakdown (% occupied, % available, % maintenance)
                    int totalB = payload.get("totalBeds") != null ? ((Number) payload.get("totalBeds")).intValue() : 0;

                    long maintBedsCount = 0;
                    if (orgId != null) {
                        maintBedsCount = bedRepository.findByOrganizationId(orgId).stream()
                                .filter(b -> {
                                    if (assignedProps != null && !assignedProps.isEmpty()) {
                                        try {
                                            UUID pId = (b.getRoom() != null && b.getRoom().getFloor() != null && b.getRoom().getFloor().getBuilding() != null && b.getRoom().getFloor().getBuilding().getProperty() != null)
                                                    ? b.getRoom().getFloor().getBuilding().getProperty().getId() : null;
                                            return pId != null && assignedProps.contains(pId);
                                        } catch (Exception ignored) {
                                            return false;
                                        }
                                    }
                                    return true;
                                })
                                .filter(b -> b.getStatus() != null && ("MAINTENANCE".equalsIgnoreCase(b.getStatus()) || "UNDER_MAINTENANCE".equalsIgnoreCase(b.getStatus())))
                                .count();
                    }
                    payload.put("maintenanceBeds", maintBedsCount);
                    double maintRate = totalB > 0 ? Math.round(((double) maintBedsCount / totalB) * 1000.0) / 10.0 : 0.0;
                    payload.put("maintenanceRate", maintRate);

                    // Financial stats: Real-time Monthly Revenue Collected vs Pending Dues
                    List<Invoice> orgInvoices = orgId != null
                            ? invoiceRepository.findByOrganizationId(orgId)
                            : invoiceRepository.findAllWithTenant();

                    if (assignedProps != null && !assignedProps.isEmpty()) {
                        orgInvoices = orgInvoices.stream()
                                .filter(i -> {
                                    try {
                                        return i.getTenant() != null && i.getTenant().getPropertyId() != null && assignedProps.contains(i.getTenant().getPropertyId());
                                    } catch (Exception ignored) {
                                        return false;
                                    }
                                })
                                .collect(java.util.stream.Collectors.toList());
                    }

                    BigDecimal revenueCollected = orgInvoices.stream()
                            .filter(i -> "PAID".equalsIgnoreCase(i.getStatus()))
                            .map(i -> i.getAmountPaid() != null ? i.getAmountPaid() : (i.getAmountDue() != null ? i.getAmountDue() : BigDecimal.ZERO))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal pendingDues = orgInvoices.stream()
                            .filter(i -> "PENDING".equalsIgnoreCase(i.getStatus()) || "UNPAID".equalsIgnoreCase(i.getStatus()) || "OVERDUE".equalsIgnoreCase(i.getStatus()))
                            .map(i -> {
                                BigDecimal due = i.getAmountDue() != null ? i.getAmountDue() : BigDecimal.ZERO;
                                BigDecimal paid = i.getAmountPaid() != null ? i.getAmountPaid() : BigDecimal.ZERO;
                                return due.subtract(paid).max(BigDecimal.ZERO);
                            })
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    payload.put("revenueCollected", revenueCollected);
                    payload.put("monthlyRevenue", revenueCollected);
                    payload.put("pendingDues", pendingDues);

                    // Tenant status breakdown (Active, Pending Check-ins, Pending Check-outs)
                    List<Tenant> orgTenants = orgId != null
                            ? tenantRepository.findByOrganizationIdNative(orgId)
                            : tenantRepository.findAllSuperAdmin();

                    if (assignedProps != null && !assignedProps.isEmpty()) {
                        orgTenants = orgTenants.stream()
                                .filter(t -> t.getPropertyId() != null && assignedProps.contains(t.getPropertyId()))
                                .collect(java.util.stream.Collectors.toList());
                    }

                    long activeTenantsCount = orgTenants.stream()
                            .filter(t -> t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()) || "CHECKED_IN".equalsIgnoreCase(t.getStatus()))
                            .count();
                    long pendingCheckInsCount = orgTenants.stream()
                            .filter(t -> t.getStatus() != null && ("PENDING".equalsIgnoreCase(t.getStatus()) || "ONBOARDING".equalsIgnoreCase(t.getStatus()) || "PENDING_CHECKIN".equalsIgnoreCase(t.getStatus())))
                            .count();
                    long pendingCheckOutsCount = orgTenants.stream()
                            .filter(t -> t.getStatus() != null && ("NOTICE_PERIOD".equalsIgnoreCase(t.getStatus()) || "PENDING_CHECKOUT".equalsIgnoreCase(t.getStatus())))
                            .count();

                    payload.put("activeTenantsCount", activeTenantsCount);
                    payload.put("pendingCheckInsCount", pendingCheckInsCount);
                    payload.put("pendingCheckOutsCount", pendingCheckOutsCount);

                    long openComplaintsCount = complaintRepository.countOpenComplaintsNative(orgId);
                    payload.put("openComplaintsCount", openComplaintsCount);
                    break;

                case "ACCOUNTANT":
                    List<Invoice> invoices = orgId != null
                            ? invoiceRepository.findByOrganizationId(orgId)
                            : invoiceRepository.findAllWithTenant();
                    BigDecimal paidTotal = invoices.stream()
                            .filter(i -> "PAID".equalsIgnoreCase(i.getStatus()))
                            .map(i -> i.getAmountPaid() != null ? i.getAmountPaid() : (i.getAmountDue() != null ? i.getAmountDue() : BigDecimal.ZERO))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal pendingTotal = invoices.stream()
                            .filter(i -> "PENDING".equalsIgnoreCase(i.getStatus()) || "UNPAID".equalsIgnoreCase(i.getStatus()) || "OVERDUE".equalsIgnoreCase(i.getStatus()))
                            .map(i -> i.getAmountDue() != null ? i.getAmountDue() : BigDecimal.ZERO)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    payload.put("totalCollected", paidTotal);
                    payload.put("totalPending", pendingTotal);
                    payload.put("totalInvoices", invoices.size());
                    break;

                case "STAFF":
                    List<Tenant> activeTenants = tenantRepository.findAll().stream()
                            .filter(t -> t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()))
                            .toList();
                    payload.put("activeTenantsCount", activeTenants.size());
                    break;

                case "TENANT":
                default:
                    if (session.userEmail != null) {
                        tenantRepository.findFirstByEmail(session.userEmail).ifPresent(t -> {
                            payload.put("tenantId", t.getId());
                            payload.put("bedNumber", t.getBedNumber());
                            payload.put("roomNumber", t.getRoomNumber());
                            payload.put("rentAmount", t.getRent());
                        });
                    }
                    break;
            }
        } catch (Exception e) {
            logger.warn("Error assembling SSE payload for role {}: {}", role, e.getMessage());
        }

        return payload;
    }
}
