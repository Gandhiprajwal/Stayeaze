package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

import org.springframework.transaction.annotation.Transactional;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/backup")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminBackupController {

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private RoomRepository roomRepository;

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
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private com.stayeaze.backend.services.DatabaseResetService databaseResetService;

    @GetMapping("/export-org/{orgId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> exportOrganizationData(@PathVariable UUID orgId) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Organization not found"));
        }

        Map<String, Object> backupData = new HashMap<>();
        backupData.put("version", "1.0");
        backupData.put("timestamp", System.currentTimeMillis());
        
        Map<String, Object> orgMap = new HashMap<>();
        orgMap.put("id", org.getId());
        orgMap.put("name", org.getName());
        orgMap.put("subdomain", org.getSubdomain());
        orgMap.put("status", org.getStatus());
        orgMap.put("createdAt", org.getCreatedAt());
        orgMap.put("updatedAt", org.getUpdatedAt());
        backupData.put("organization", orgMap);

        // 1. Billing & Subscription Profile
        try {
            OrganizationBillingProfile bp = billingProfileRepository.findByOrganization(org).orElse(null);
            if (bp != null) {
                Map<String, Object> bpMap = new HashMap<>();
                bpMap.put("id", bp.getId());
                bpMap.put("legalName", bp.getLegalName());
                bpMap.put("gstin", bp.getGstin());
                bpMap.put("pan", bp.getPan());
                bpMap.put("subscriptionPlanName", bp.getSubscriptionPlanName());
                bpMap.put("subscriptionPlanPrice", bp.getSubscriptionPlanPrice());
                bpMap.put("subscriptionBillingCycle", bp.getSubscriptionBillingCycle());
                bpMap.put("subscriptionStatus", bp.getSubscriptionStatus());
                bpMap.put("subscriptionStartDate", bp.getSubscriptionStartDate());
                bpMap.put("subscriptionEndDate", bp.getSubscriptionEndDate());
                backupData.put("billingProfile", bpMap);
            } else {
                backupData.put("billingProfile", null);
            }
        } catch (Exception ignored) {
            backupData.put("billingProfile", null);
        }

        // 2. Users (Staff & Admins)
        try {
            List<User> users = userRepository.findByOrganizationId(orgId);
            List<Map<String, Object>> uList = new ArrayList<>();
            if (users != null) {
                for (User u : users) {
                    if (u == null) continue;
                    Map<String, Object> uMap = new HashMap<>();
                    uMap.put("id", u.getId());
                    uMap.put("email", u.getEmail());
                    uMap.put("firstName", u.getFirstName());
                    uMap.put("mobile", u.getMobile());
                    uMap.put("status", u.getStatus());
                    uMap.put("createdAt", u.getCreatedAt());
                    List<String> roles = u.getRoles() != null ? u.getRoles().stream().map(Role::getName).collect(Collectors.toList()) : Collections.emptyList();
                    uMap.put("roles", roles);
                    uList.add(uMap);
                }
            }
            backupData.put("users", uList);
        } catch (Exception ignored) {
            backupData.put("users", Collections.emptyList());
        }

        // 3. Properties (Native query bypasses multi-tenant session filter)
        List<Property> properties = Collections.emptyList();
        List<Map<String, Object>> propList = new ArrayList<>();
        try {
            properties = propertyRepository.findByOrganizationIdNative(orgId);
            if (properties == null || properties.isEmpty()) {
                properties = propertyRepository.findByOrganizationId(orgId);
            }
            if (properties != null) {
                for (Property p : properties) {
                    if (p == null) continue;
                    Map<String, Object> pMap = new HashMap<>();
                    pMap.put("id", p.getId());
                    pMap.put("name", p.getName());
                    pMap.put("code", p.getCode());
                    pMap.put("type", p.getType());
                    pMap.put("address", p.getAddress());
                    pMap.put("city", p.getCity());
                    pMap.put("state", p.getState());
                    pMap.put("pincode", p.getPincode());
                    pMap.put("manager", p.getManager());
                    pMap.put("phone", p.getPhone());
                    pMap.put("email", p.getEmail());
                    pMap.put("totalBeds", p.getTotalBeds());
                    pMap.put("occupiedBeds", p.getOccupiedBeds());
                    pMap.put("status", p.getStatus());
                    pMap.put("createdAt", p.getCreatedAt());
                    propList.add(pMap);
                }
            }
            backupData.put("properties", propList);
        } catch (Exception ignored) {
            backupData.put("properties", Collections.emptyList());
        }

        // 4. Buildings (Native join with properties)
        try {
            List<Building> buildings = buildingRepository.findByOrganizationIdNative(orgId);
            List<Map<String, Object>> bList = new ArrayList<>();
            if (buildings != null) {
                for (Building b : buildings) {
                    if (b == null) continue;
                    Map<String, Object> bMap = new HashMap<>();
                    bMap.put("id", b.getId());
                    bMap.put("name", b.getName());
                    bMap.put("code", b.getCode());
                    bMap.put("status", b.getStatus());
                    bList.add(bMap);
                }
            }
            backupData.put("buildings", bList);
        } catch (Exception ignored) {
            backupData.put("buildings", Collections.emptyList());
        }

        // 5. Rooms
        try {
            List<Map<String, Object>> roomList = new ArrayList<>();
            if (properties != null) {
                for (Property p : properties) {
                    if (p != null && p.getId() != null) {
                        List<Room> pRooms = roomRepository.findByPropertyIdNative(p.getId());
                        if (pRooms != null) {
                            for (Room r : pRooms) {
                                if (r == null) continue;
                                Map<String, Object> rMap = new HashMap<>();
                                rMap.put("id", r.getId());
                                rMap.put("roomNumber", r.getRoomNumber());
                                rMap.put("sharingType", r.getSharingType());
                                rMap.put("baseRent", r.getBaseRent());
                                rMap.put("status", r.getStatus());
                                rMap.put("propertyId", p.getId());
                                roomList.add(rMap);
                            }
                        }
                    }
                }
            }
            backupData.put("rooms", roomList);
        } catch (Exception ignored) {
            backupData.put("rooms", Collections.emptyList());
        }

        // 6. Beds (Native query)
        try {
            List<Bed> beds = bedRepository.findByOrganizationIdNative(orgId);
            List<Map<String, Object>> bedList = new ArrayList<>();
            if (beds != null) {
                for (Bed b : beds) {
                    if (b == null) continue;
                    Map<String, Object> bMap = new HashMap<>();
                    bMap.put("id", b.getId());
                    bMap.put("bedNumber", b.getBedNumber());
                    bMap.put("status", b.getStatus());
                    bMap.put("qrCode", b.getQrCode());
                    bedList.add(bMap);
                }
            }
            backupData.put("beds", bedList);
        } catch (Exception ignored) {
            backupData.put("beds", Collections.emptyList());
        }

        // 7. Tenants (Native query bypasses multi-tenant session filter)
        try {
            List<Tenant> tenants = tenantRepository.findByOrganizationIdNative(orgId);
            List<Map<String, Object>> tList = new ArrayList<>();
            if (tenants != null) {
                for (Tenant t : tenants) {
                    if (t == null) continue;
                    Map<String, Object> tMap = new HashMap<>();
                    tMap.put("id", t.getId());
                    String fullName = (t.getFirstName() != null ? t.getFirstName() : "") + 
                            (t.getLastName() != null && !t.getLastName().isBlank() ? " " + t.getLastName() : "");
                    tMap.put("fullName", fullName.trim());
                    tMap.put("email", t.getEmail());
                    tMap.put("mobile", t.getMobile());
                    tMap.put("status", t.getStatus());
                    tMap.put("kycStatus", t.getKycStatus());
                    tMap.put("createdAt", t.getCreatedAt());
                    tList.add(tMap);
                }
            }
            backupData.put("tenants", tList);
        } catch (Exception ignored) {
            backupData.put("tenants", Collections.emptyList());
        }

        // 8. Invoices (Native query)
        try {
            List<Invoice> invoices = invoiceRepository.findByOrganizationIdNative(orgId);
            List<Map<String, Object>> invList = new ArrayList<>();
            if (invoices != null) {
                for (Invoice inv : invoices) {
                    if (inv == null) continue;
                    Map<String, Object> iMap = new HashMap<>();
                    iMap.put("id", inv.getId());
                    iMap.put("invoiceNumber", inv.getInvoiceNumber());
                    iMap.put("dueDate", inv.getDueDate());
                    iMap.put("issueDate", inv.getIssueDate());
                    iMap.put("amountDue", inv.getAmountDue());
                    iMap.put("amountPaid", inv.getAmountPaid());
                    iMap.put("status", inv.getStatus());
                    iMap.put("paymentMethod", inv.getPaymentMethod());
                    invList.add(iMap);
                }
            }
            backupData.put("invoices", invList);
        } catch (Exception ignored) {
            backupData.put("invoices", Collections.emptyList());
        }

        // 9. Payments (Native query)
        try {
            List<Payment> payments = paymentRepository.findByOrganizationIdNative(orgId);
            List<Map<String, Object>> pList = new ArrayList<>();
            if (payments != null) {
                for (Payment p : payments) {
                    if (p == null) continue;
                    Map<String, Object> pMap = new HashMap<>();
                    pMap.put("id", p.getId());
                    pMap.put("amount", p.getAmount());
                    pMap.put("paymentDate", p.getPaymentDate());
                    pMap.put("paymentMethod", p.getPaymentMethod());
                    pMap.put("transactionReference", p.getTransactionReference());
                    pMap.put("status", p.getStatus());
                    pList.add(pMap);
                }
            }
            backupData.put("payments", pList);
        } catch (Exception ignored) {
            backupData.put("payments", Collections.emptyList());
        }

        // 10. Complaints (Native query)
        try {
            List<Complaint> complaints = complaintRepository.findByOrganizationIdNative(orgId);
            List<Map<String, Object>> cList = new ArrayList<>();
            if (complaints != null) {
                for (Complaint c : complaints) {
                    if (c == null) continue;
                    Map<String, Object> cMap = new HashMap<>();
                    cMap.put("id", c.getId());
                    cMap.put("description", c.getDescription());
                    cMap.put("category", c.getCategory());
                    cMap.put("status", c.getStatus());
                    cMap.put("priority", c.getPriority());
                    cMap.put("createdAt", c.getCreatedAt());
                    cList.add(cMap);
                }
            }
            backupData.put("complaints", cList);
        } catch (Exception ignored) {
            backupData.put("complaints", Collections.emptyList());
        }

        String safeOrgName = org.getName() != null ? org.getName().replaceAll("[^a-zA-Z0-9_-]", "_") : "organization";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"stayeaze_backup_" + safeOrgName + "_" + System.currentTimeMillis() + ".json\"");

        return new ResponseEntity<>(backupData, headers, HttpStatus.OK);
    }

    @GetMapping("/export-system")
    @Transactional(readOnly = true)
    public ResponseEntity<?> exportSystemData() {
        Map<String, Object> systemSnapshot = new HashMap<>();
        systemSnapshot.put("version", "1.0");
        systemSnapshot.put("timestamp", System.currentTimeMillis());

        List<Organization> orgs = organizationRepository.findAll();
        systemSnapshot.put("totalOrganizations", orgs.size());
        systemSnapshot.put("organizations", orgs);

        List<SaaSPlan> plans = saasPlanRepository.findAll();
        systemSnapshot.put("saasPlans", plans);

        List<User> allUsers = userRepository.findAll();
        systemSnapshot.put("totalUsers", allUsers.size());

        List<Property> allProperties = propertyRepository.findAllSuperAdmin();
        systemSnapshot.put("totalProperties", allProperties.size());
        systemSnapshot.put("properties", allProperties);

        List<Tenant> allTenants = tenantRepository.findAllSuperAdmin();
        systemSnapshot.put("totalTenants", allTenants.size());
        systemSnapshot.put("tenants", allTenants);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"stayeaze_system_snapshot_" + System.currentTimeMillis() + ".json\"");

        return new ResponseEntity<>(systemSnapshot, headers, HttpStatus.OK);
    }

    @PostMapping("/purge-all-data")
    public ResponseEntity<?> purgeAllData() {
        databaseResetService.resetAllTables();
        return ResponseEntity.ok(new MessageResponse("Database purged successfully. All tenant subscribers, properties, and users have been cleared. Super Admin credentials preserved."));
    }
}
