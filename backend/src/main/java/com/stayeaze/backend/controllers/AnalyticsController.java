package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.SecurityUtils;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/analytics")
@PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ACCOUNTANT')")
public class AnalyticsController {

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl u) {
            var user = userRepository.findByEmail(u.getEmail() != null ? u.getEmail() : u.getUsername()).orElse(null);
            if (user != null && user.getOrganization() != null) {
                return user.getOrganization();
            }
        }
        if (securityUtils.isSuperAdmin()) {
            return organizationRepository.findAll().stream().findFirst().orElse(null);
        }
        return null;
    }

    /**
     * P2.5: High-level KPI summary for the Owner / Management.
     */
    @GetMapping("/overview")
    @Transactional(readOnly = true)
    @Cacheable(value = "analytics_overview", key = "(#propertyId != null ? #propertyId.toString() : 'all') + '_' + (T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication() != null ? T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName() : 'anon')")
    public ResponseEntity<?> getOverviewMetrics(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.ok(Collections.emptyMap());
        }

        if (propertyId != null) {
            securityUtils.validatePropertyAccess(propertyId);
        }

        List<Property> properties = propertyRepository.findByOrganization(org);
        if (propertyId != null) {
            properties = properties.stream().filter(p -> p.getId().equals(propertyId)).collect(Collectors.toList());
        }

        List<Bed> allBeds = bedRepository.findByOrganizationId(org.getId());
        if (propertyId != null) {
            allBeds = allBeds.stream()
                    .filter(b -> b.getRoom() != null && b.getRoom().getFloor() != null &&
                            b.getRoom().getFloor().getBuilding() != null &&
                            b.getRoom().getFloor().getBuilding().getProperty() != null &&
                            propertyId.equals(b.getRoom().getFloor().getBuilding().getProperty().getId()))
                    .collect(Collectors.toList());
        }

        long totalBeds = allBeds.stream().filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus())).count();
        long occupiedBeds = allBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
        long vacantBeds = Math.max(0, totalBeds - occupiedBeds);
        double occupancyRate = totalBeds > 0 ? Math.round(((double) occupiedBeds / totalBeds) * 1000.0) / 10.0 : 0.0;

        List<Tenant> activeTenants = tenantRepository.findByOrganization(org).stream()
                .filter(t -> "ACTIVE".equalsIgnoreCase(t.getStatus()))
                .filter(t -> propertyId == null || propertyId.equals(t.getPropertyId()))
                .collect(Collectors.toList());

        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndOptionalPropertyId(org.getId(), propertyId);

        LocalDate today = LocalDate.now();
        int curMonth = today.getMonthValue();
        int curYear = today.getYear();
        int prevMonth = curMonth == 1 ? 12 : curMonth - 1;
        int prevYear = curMonth == 1 ? curYear - 1 : curYear;

        BigDecimal curMonthBilled = BigDecimal.ZERO;
        BigDecimal curMonthCollected = BigDecimal.ZERO;
        BigDecimal prevMonthCollected = BigDecimal.ZERO;

        BigDecimal totalBilledYtd = BigDecimal.ZERO;
        BigDecimal totalCollectedYtd = BigDecimal.ZERO;
        BigDecimal totalOverdueAmount = BigDecimal.ZERO;
        BigDecimal totalWrittenOffYtd = BigDecimal.ZERO;
        long overdueInvoicesCount = 0;

        for (Invoice inv : invoices) {
            String status = inv.getStatus() != null ? inv.getStatus().toUpperCase() : "UNPAID";
            BigDecimal due = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
            BigDecimal paid = inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal remaining = due.subtract(paid).max(BigDecimal.ZERO);
            LocalDate issueDate = inv.getIssueDate() != null ? inv.getIssueDate() : inv.getDueDate();

            if ("CANCELLED".equals(status)) {
                continue;
            }

            if ("WRITTEN_OFF".equals(status)) {
                if (issueDate != null && issueDate.getYear() == curYear) {
                    totalWrittenOffYtd = totalWrittenOffYtd.add(due);
                }
                continue;
            }

            if (issueDate != null && issueDate.getYear() == curYear) {
                totalBilledYtd = totalBilledYtd.add(due);
                totalCollectedYtd = totalCollectedYtd.add(paid);

                if (issueDate.getMonthValue() == curMonth) {
                    curMonthBilled = curMonthBilled.add(due);
                    curMonthCollected = curMonthCollected.add(paid);
                }
            }

            if (issueDate != null && issueDate.getYear() == prevYear && issueDate.getMonthValue() == prevMonth) {
                prevMonthCollected = prevMonthCollected.add(paid);
            }

            if ("OVERDUE".equals(status) || (inv.getDueDate() != null && today.isAfter(inv.getDueDate()) && remaining.compareTo(BigDecimal.ZERO) > 0)) {
                overdueInvoicesCount++;
                totalOverdueAmount = totalOverdueAmount.add(remaining);
            }
        }

        double momRevenueGrowth = 0.0;
        if (prevMonthCollected.compareTo(BigDecimal.ZERO) > 0) {
            double diff = curMonthCollected.subtract(prevMonthCollected).doubleValue();
            momRevenueGrowth = Math.round((diff / prevMonthCollected.doubleValue()) * 1000.0) / 10.0;
        } else if (curMonthCollected.compareTo(BigDecimal.ZERO) > 0) {
            momRevenueGrowth = 100.0;
        }

        double collectionEfficiency = totalBilledYtd.compareTo(BigDecimal.ZERO) > 0
                ? Math.round((totalCollectedYtd.doubleValue() / totalBilledYtd.doubleValue()) * 1000.0) / 10.0
                : 0.0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalProperties", properties.size());
        result.put("totalBeds", totalBeds);
        result.put("occupiedBeds", occupiedBeds);
        result.put("vacantBeds", vacantBeds);
        result.put("occupancyRate", occupancyRate);
        result.put("activeTenantsCount", activeTenants.size());

        result.put("curMonthBilled", curMonthBilled);
        result.put("curMonthCollected", curMonthCollected);
        result.put("prevMonthCollected", prevMonthCollected);
        result.put("momRevenueGrowth", momRevenueGrowth);

        result.put("totalBilledYtd", totalBilledYtd);
        result.put("totalCollectedYtd", totalCollectedYtd);
        result.put("collectionEfficiency", collectionEfficiency);
        result.put("totalOverdueAmount", totalOverdueAmount);
        result.put("overdueInvoicesCount", overdueInvoicesCount);
        result.put("totalWrittenOffYtd", totalWrittenOffYtd);

        return ResponseEntity.ok(result);
    }

    /**
     * P2.5: 12-Month Historical Revenue, Billing & Collection Timeseries.
     */
    @GetMapping("/revenue-timeseries")
    @Transactional(readOnly = true)
    @Cacheable(value = "analytics_revenue", key = "(#propertyId != null ? #propertyId.toString() : 'all') + '_' + #months + '_' + (T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication() != null ? T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName() : 'anon')")
    public ResponseEntity<?> getRevenueTimeseries(
            @RequestParam(required = false) UUID propertyId,
            @RequestParam(defaultValue = "12") int months) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        if (propertyId != null) {
            securityUtils.validatePropertyAccess(propertyId);
        }

        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndOptionalPropertyId(org.getId(), propertyId);

        LocalDate today = LocalDate.now();
        List<Map<String, Object>> timeseries = new ArrayList<>();
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MMM yyyy");
        DateTimeFormatter shortFmt = DateTimeFormatter.ofPattern("MMM");

        for (int i = months - 1; i >= 0; i--) {
            LocalDate targetDate = today.minusMonths(i);
            int m = targetDate.getMonthValue();
            int y = targetDate.getYear();

            BigDecimal billed = BigDecimal.ZERO;
            BigDecimal collected = BigDecimal.ZERO;
            BigDecimal overdue = BigDecimal.ZERO;
            BigDecimal waived = BigDecimal.ZERO;

            for (Invoice inv : invoices) {
                if ("CANCELLED".equalsIgnoreCase(inv.getStatus())) continue;

                LocalDate d = inv.getIssueDate() != null ? inv.getIssueDate() : inv.getDueDate();
                if (d != null && d.getYear() == y && d.getMonthValue() == m) {
                    BigDecimal due = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
                    BigDecimal paid = inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO;

                    if ("WRITTEN_OFF".equalsIgnoreCase(inv.getStatus())) {
                        waived = waived.add(due);
                    } else {
                        billed = billed.add(due);
                        collected = collected.add(paid);
                        BigDecimal rem = due.subtract(paid).max(BigDecimal.ZERO);
                        if ("OVERDUE".equalsIgnoreCase(inv.getStatus()) || (inv.getDueDate() != null && today.isAfter(inv.getDueDate()) && rem.compareTo(BigDecimal.ZERO) > 0)) {
                            overdue = overdue.add(rem);
                        }
                    }
                }
            }

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("label", targetDate.format(monthFmt));
            point.put("monthShort", targetDate.format(shortFmt));
            point.put("year", y);
            point.put("monthNum", m);
            point.put("billed", billed);
            point.put("collected", collected);
            point.put("overdue", overdue);
            point.put("waived", waived);
            point.put("collectionRate", billed.compareTo(BigDecimal.ZERO) > 0
                    ? Math.round((collected.doubleValue() / billed.doubleValue()) * 1000.0) / 10.0
                    : 0.0);
            timeseries.add(point);
        }

        return ResponseEntity.ok(timeseries);
    }

    /**
     * P2.5: Per-Property Occupancy & Capacity Breakdown.
     */
    @GetMapping("/occupancy-breakdown")
    @Transactional(readOnly = true)
    @Cacheable(value = "analytics_occupancy", key = "(#propertyId != null ? #propertyId.toString() : 'all') + '_' + (T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication() != null ? T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName() : 'anon')")
    public ResponseEntity<?> getOccupancyBreakdown(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        if (propertyId != null) {
            securityUtils.validatePropertyAccess(propertyId);
        }

        List<Property> properties = propertyRepository.findByOrganization(org);
        if (propertyId != null) {
            properties = properties.stream().filter(p -> p.getId().equals(propertyId)).collect(Collectors.toList());
        }

        List<Bed> allBeds = bedRepository.findByOrganizationId(org.getId());
        List<Map<String, Object>> breakdown = new ArrayList<>();

        for (Property p : properties) {
            List<Bed> propBeds = allBeds.stream()
                    .filter(b -> b.getRoom() != null && b.getRoom().getFloor() != null &&
                            b.getRoom().getFloor().getBuilding() != null &&
                            b.getRoom().getFloor().getBuilding().getProperty() != null &&
                            p.getId().equals(b.getRoom().getFloor().getBuilding().getProperty().getId()))
                    .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                    .collect(Collectors.toList());

            long total = propBeds.size();
            long occupied = propBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
            long reserved = propBeds.stream().filter(b -> "RESERVED".equalsIgnoreCase(b.getStatus())).count();
            long maintenance = propBeds.stream().filter(b -> "MAINTENANCE".equalsIgnoreCase(b.getStatus()) || "BLOCKED".equalsIgnoreCase(b.getStatus())).count();
            long vacant = Math.max(0, total - occupied - reserved - maintenance);
            double rate = total > 0 ? Math.round(((double) occupied / total) * 1000.0) / 10.0 : 0.0;

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("propertyId", p.getId());
            map.put("propertyName", p.getName());
            map.put("address", p.getAddress());
            map.put("totalBeds", total);
            map.put("occupiedBeds", occupied);
            map.put("reservedBeds", reserved);
            map.put("maintenanceBeds", maintenance);
            map.put("vacantBeds", vacant);
            map.put("occupancyRate", rate);

            breakdown.add(map);
        }

        return ResponseEntity.ok(breakdown);
    }

    /**
     * P2.5: Arrears Aging Buckets & Top 10 Resident Debtors.
     */
    @GetMapping("/arrears-aging")
    @Transactional(readOnly = true)
    @Cacheable(value = "analytics_revenue", key = "'arrears_' + (#propertyId != null ? #propertyId.toString() : 'all') + '_' + (T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication() != null ? T(org.springframework.security.core.context.SecurityContextHolder).getContext().getAuthentication().getName() : 'anon')")
    public ResponseEntity<?> getArrearsAging(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.ok(Collections.emptyMap());
        }

        if (propertyId != null) {
            securityUtils.validatePropertyAccess(propertyId);
        }

        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndOptionalPropertyId(org.getId(), propertyId);
        LocalDate today = LocalDate.now();

        BigDecimal bucketCurrent = BigDecimal.ZERO;      // Not overdue yet / due within 7 days
        BigDecimal bucket1to30 = BigDecimal.ZERO;        // 1 to 30 days overdue
        BigDecimal bucket31to60 = BigDecimal.ZERO;       // 31 to 60 days overdue
        BigDecimal bucket61Plus = BigDecimal.ZERO;       // 61+ days overdue
        BigDecimal totalWrittenOff = BigDecimal.ZERO;

        Map<UUID, Map<String, Object>> debtorMap = new HashMap<>();

        for (Invoice inv : invoices) {
            if ("CANCELLED".equalsIgnoreCase(inv.getStatus())) continue;

            BigDecimal due = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
            BigDecimal paid = inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal remaining = due.subtract(paid).max(BigDecimal.ZERO);

            if ("WRITTEN_OFF".equalsIgnoreCase(inv.getStatus())) {
                totalWrittenOff = totalWrittenOff.add(due);
                continue;
            }

            if (remaining.compareTo(BigDecimal.ZERO) <= 0) continue;

            LocalDate dueDate = inv.getDueDate() != null ? inv.getDueDate() : inv.getIssueDate();
            long daysOverdue = 0;
            if (dueDate != null && today.isAfter(dueDate)) {
                daysOverdue = ChronoUnit.DAYS.between(dueDate, today);
            }

            if (daysOverdue == 0) {
                bucketCurrent = bucketCurrent.add(remaining);
            } else if (daysOverdue <= 30) {
                bucket1to30 = bucket1to30.add(remaining);
            } else if (daysOverdue <= 60) {
                bucket31to60 = bucket31to60.add(remaining);
            } else {
                bucket61Plus = bucket61Plus.add(remaining);
            }

            if (inv.getTenant() != null) {
                Tenant t = inv.getTenant();
                UUID tId = t.getId();
                Map<String, Object> debtor = debtorMap.computeIfAbsent(tId, k -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("tenantId", tId);
                    map.put("tenantName", (t.getFirstName() != null ? t.getFirstName() : "") + " " + (t.getLastName() != null ? t.getLastName() : "").trim());
                    map.put("phone", t.getPhone());
                    map.put("roomNumber", t.getRoomNumber());
                    map.put("bedNumber", t.getBedNumber());
                    map.put("propertyId", t.getPropertyId());
                    map.put("totalOutstanding", BigDecimal.ZERO);
                    map.put("maxDaysOverdue", 0L);
                    map.put("invoiceCount", 0);
                    return map;
                });

                BigDecimal curTotal = (BigDecimal) debtor.get("totalOutstanding");
                debtor.put("totalOutstanding", curTotal.add(remaining));
                debtor.put("invoiceCount", (Integer) debtor.get("invoiceCount") + 1);
                long currentMax = (Long) debtor.get("maxDaysOverdue");
                if (daysOverdue > currentMax) {
                    debtor.put("maxDaysOverdue", daysOverdue);
                }
            }
        }

        List<Map<String, Object>> topDebtors = debtorMap.values().stream()
                .sorted((a, b) -> ((BigDecimal) b.get("totalOutstanding")).compareTo((BigDecimal) a.get("totalOutstanding")))
                .limit(10)
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> buckets = new LinkedHashMap<>();
        buckets.put("current", bucketCurrent);
        buckets.put("days1to30", bucket1to30);
        buckets.put("days31to60", bucket31to60);
        buckets.put("days61Plus", bucket61Plus);
        buckets.put("totalWrittenOff", totalWrittenOff);
        buckets.put("totalOutstanding", bucketCurrent.add(bucket1to30).add(bucket31to60).add(bucket61Plus));

        result.put("agingBuckets", buckets);
        result.put("topDebtors", topDebtors);

        return ResponseEntity.ok(result);
    }
}
