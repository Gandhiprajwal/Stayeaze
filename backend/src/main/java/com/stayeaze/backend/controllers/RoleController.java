package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    private static final ObjectMapper mapper = new ObjectMapper();

    private static final Set<String> SYSTEM_ROLES = new HashSet<>(Arrays.asList(
        "SUPER_ADMIN", "OWNER", "PROPERTY_OWNER", "ADMIN",
        "ROLE_SUPER_ADMIN", "ROLE_OWNER", "ROLE_ADMIN",
        "PROPERTY_MANAGER", "ROLE_PROPERTY_MANAGER",
        "RECEPTIONIST", "ROLE_RECEPTIONIST",
        "ACCOUNTANT", "ROLE_ACCOUNTANT",
        "SECURITY_GUARD", "ROLE_SECURITY_GUARD",
        "STAFF", "ROLE_STAFF",
        "TENANT", "ROLE_TENANT"
    ));

    @GetMapping
    public ResponseEntity<?> getAllRoles() {

        List<Role> roles = roleRepository.findAll();

        Map<UUID, Long> roleUserCountMap = new HashMap<>();
        try {
            List<Object[]> counts = userRepository.countUsersPerRole();
            if (counts != null) {
                for (Object[] row : counts) {
                    if (row != null && row.length >= 2 && row[0] instanceof UUID rId && row[1] instanceof Number cnt) {
                        roleUserCountMap.put(rId, cnt.longValue());
                    }
                }
            }
        } catch (Exception ignored) {}

        Map<String, Map<String, Object>> uniqueRolesMap = new LinkedHashMap<>();

        for (Role role : roles) {
            if (role == null || role.getName() == null) continue;
            String rawName = role.getName();
            String displayName = rawName.startsWith("ROLE_") ? rawName.substring(5) : rawName;
            if ("OWNER".equalsIgnoreCase(displayName) || "PROPERTY_OWNER".equalsIgnoreCase(displayName) || "ADMIN".equalsIgnoreCase(displayName)) {
                displayName = "OWNER / ADMIN";
            }

            String key = displayName.toUpperCase();
            long uCount = roleUserCountMap.getOrDefault(role.getId(), 0L);

            if (uniqueRolesMap.containsKey(key)) {
                Map<String, Object> existing = uniqueRolesMap.get(key);
                existing.put("userCount", ((Number) existing.get("userCount")).longValue() + uCount);
            } else {
                Map<String, Object> map = new HashMap<>();
                map.put("id", role.getId());
                map.put("name", displayName);
                map.put("description", "System defined role for " + displayName + " operations.");
                map.put("isSystem", SYSTEM_ROLES.contains(rawName) || SYSTEM_ROLES.contains(displayName) || SYSTEM_ROLES.contains("ROLE_" + displayName));
                map.put("userCount", uCount);

                List<String> permList = new ArrayList<>();
                try {
                    if (role.getPermissions() != null) {
                        if (role.getPermissions().contains("ALL")) {
                            permList.add("*");
                        } else {
                            String[] perms = mapper.readValue(role.getPermissions(), String[].class);
                            permList.addAll(Arrays.asList(perms));
                        }
                    }
                } catch (Exception e) {
                    permList.add("*");
                }
                map.put("permissions", permList);

                uniqueRolesMap.put(key, map);
            }
        }

        List<Map<String, Object>> response = new ArrayList<>(uniqueRolesMap.values());
        return ResponseEntity.ok(response);
    }


    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createRole(@RequestBody Map<String, Object> request) {

        String name = (String) request.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new com.stayeaze.backend.payload.response.MessageResponse("Error: Role name is required!"));
        }

        String dbName = name.trim().toUpperCase();
        if ("ADMIN".equalsIgnoreCase(dbName)) {
            dbName = "ROLE_OWNER";
        } else if (!dbName.startsWith("ROLE_")) {
            dbName = "ROLE_" + dbName.replace(" ", "_");
        }

        final String finalDbName = dbName;
        if (roleRepository.existsByNameIgnoreCase(finalDbName)) {
            return ResponseEntity.badRequest().body(new com.stayeaze.backend.payload.response.MessageResponse("Error: Role already exists!"));
        }

        @SuppressWarnings("unchecked")
        List<String> perms = (List<String>) request.get("permissions");
        String dbPermissionsValue = "[]";
        if (perms != null) {
            if (perms.contains("*")) {
                dbPermissionsValue = "[\"ALL\"]";
            } else {
                try {
                    dbPermissionsValue = mapper.writeValueAsString(perms);
                } catch (Exception e) {
                    dbPermissionsValue = "[]";
                }
            }
        }

        Role role = new Role(dbName, dbPermissionsValue);
        Role saved = roleRepository.save(role);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> updateRole(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        Role role = roleRepository.findById(id).orElse(null);
        if (role == null) {
            return ResponseEntity.notFound().build();
        }

        List<String> perms = (List<String>) request.get("permissions");
        if (perms != null) {
            String dbPermissionsValue;
            if (perms.contains("*")) {
                dbPermissionsValue = "[\"ALL\"]";
            } else {
                try {
                    dbPermissionsValue = mapper.writeValueAsString(perms);
                } catch (Exception e) {
                    dbPermissionsValue = "[]";
                }
            }
            role.setPermissions(dbPermissionsValue);
        }

        Role saved = roleRepository.save(role);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteRole(@PathVariable UUID id) {
        Role role = roleRepository.findById(id).orElse(null);
        if (role == null) {
            return ResponseEntity.notFound().build();
        }

        if (SYSTEM_ROLES.contains(role.getName())) {
            return ResponseEntity.badRequest().body(new com.stayeaze.backend.payload.response.MessageResponse("Error: System roles cannot be deleted!"));
        }

        roleRepository.delete(role);
        return ResponseEntity.ok(new com.stayeaze.backend.payload.response.MessageResponse("Role deleted successfully."));
    }

    @GetMapping("/permissions")
    public ResponseEntity<?> getAvailablePermissions() {
        List<Map<String, Object>> catalog = List.of(
            Map.of(
                "category", "Space & Visual Inventory",
                "icon", "Building2",
                "permissions", List.of(
                    Map.of("key", "space.matrix.view", "label", "Visual Floor & Bed Matrix", "description", "Inspect live graphical floor layouts, occupied beds, and vacant slots"),
                    Map.of("key", "space.matrix.manage", "label", "Configure Rooms & Beds", "description", "Configure sharing types (Single/Double/Triple), bed numbers, and base rents"),
                    Map.of("key", "space.batch.generate", "label", "Batch Space Generator", "description", "Bulk generate multi-floor rooms and beds across wings"),
                    Map.of("key", "building.manage", "label", "Buildings & Wings", "description", "Add, edit, or archive buildings and floor wings")
                )
            ),
            Map.of(
                "category", "Resident Lifecycle & Digital KYC",
                "icon", "Users",
                "permissions", List.of(
                    Map.of("key", "tenant.read", "label", "View Resident Profiles", "description", "View tenant directory, room allocations, emergency contacts, and active status"),
                    Map.of("key", "tenant.write", "label", "Onboard & Edit Residents", "description", "Onboard new residents, edit profiles, and record initial rent/deposit"),
                    Map.of("key", "tenant.kyc.verify", "label", "Verify Digital KYC", "description", "Approve or reject Aadhaar, PAN, and student/employee ID documents"),
                    Map.of("key", "tenant.transfer.execute", "label", "Room Transfer Wizard", "description", "Execute room/bed transfers with automatic pro-rata rent & deposit recalculation"),
                    Map.of("key", "booking.manage", "label", "Bookings & Token Advances", "description", "Process prospective bookings, token deposits, and space hold requests")
                )
            ),
            Map.of(
                "category", "Rental Agreements & Legal Lock-in",
                "icon", "FileSignature",
                "permissions", List.of(
                    Map.of("key", "agreement.read", "label", "View Digital Agreements", "description", "View tenant e-sign contracts, lock-in clauses, and notice periods"),
                    Map.of("key", "agreement.generate", "label", "Generate & E-Sign Agreements", "description", "Create digital rental agreements with custom rules & download PDF contracts"),
                    Map.of("key", "agreement.terminate", "label", "Agreement Termination & Move-Out", "description", "Execute move-outs, early lock-in penalties, and settlement approvals")
                )
            ),
            Map.of(
                "category", "Billing, Utility Meters & Finance",
                "icon", "CreditCard",
                "permissions", List.of(
                    Map.of("key", "billing.read", "label", "View Invoices & Tariffs", "description", "Access monthly rent invoices, utility bills, and payment records"),
                    Map.of("key", "billing.write", "label", "Create Invoices & Adjustments", "description", "Create custom bills, apply discounts, exit cleaning fees, and penalties"),
                    Map.of("key", "billing.bulk.run", "label", "Bulk Monthly Rent Run", "description", "Execute 1-click automated monthly rent generation for all occupied rooms"),
                    Map.of("key", "utility.meter.record", "label", "Sub-Meter Electricity Split", "description", "Record sub-meter electricity readings and auto-split units across roommates"),
                    Map.of("key", "payment.record", "label", "Log Payments & Bank Accounts", "description", "Record cash/UPI payments, reconcile transactions, and verify refund accounts"),
                    Map.of("key", "deposit.manage", "label", "Security Deposit Settlements", "description", "Process deposit deductions, damage penalties, and net refund payouts")
                )
            ),
            Map.of(
                "category", "Gate Pass, Visitors & Security",
                "icon", "ShieldCheck",
                "permissions", List.of(
                    Map.of("key", "gate.visitor.read", "label", "View Visitor Gate Logs", "description", "Inspect guest entry/exit times, vehicle numbers, and host tenants"),
                    Map.of("key", "gate.visitor.log", "label", "Issue Visitor Gate Pass", "description", "Register guests, issue gate entry passes, and trigger tenant approval"),
                    Map.of("key", "gate.parcel.manage", "label", "Parcel & Courier Desk", "description", "Log arriving courier deliveries, send OTP pickup notifications to residents"),
                    Map.of("key", "security.incident.log", "label", "Safety Incident Escalation", "description", "Record security incidents, curfew violations, and warden escalations")
                )
            ),
            Map.of(
                "category", "Facilities & Complaints SLA",
                "icon", "Wrench",
                "permissions", List.of(
                    Map.of("key", "complaint.read", "label", "View Complaints & Photos", "description", "View resident grievances, issue photos, and live chat updates"),
                    Map.of("key", "complaint.resolve", "label", "Assign & Close Complaints", "description", "Assign maintenance staff, track SLA timelines, and resolve issues"),
                    Map.of("key", "maintenance.manage", "label", "Asset Maintenance & Repairs", "description", "Log recurring maintenance jobs, contractor costs, and equipment assets")
                )
            ),
            Map.of(
                "category", "WhatsApp & Omnichannel Automations",
                "icon", "MessageSquare",
                "permissions", List.of(
                    Map.of("key", "messaging.whatsapp.send", "label", "1-Click WhatsApp Reminders", "description", "Dispatch instant WhatsApp rent due notices, welcome links, and receipts"),
                    Map.of("key", "messaging.logs.view", "label", "Notification Delivery Logs", "description", "Audit WhatsApp/SMS message delivery statuses and failure reasons")
                )
            ),
            Map.of(
                "category", "Compliance, Tax & Governance",
                "icon", "FileText",
                "permissions", List.of(
                    Map.of("key", "reports.gst.export", "label", "GSTR-1 Tax Reports", "description", "Export monthly GST B2B/B2C summaries and tax ledgers"),
                    Map.of("key", "reports.hra.generate", "label", "HRA Section 10(13A) Receipts", "description", "Generate official tax rent receipts with landlord PAN verification QR"),
                    Map.of("key", "audit.logs.view", "label", "Audit Logs & Security Sessions", "description", "View multi-branch user audit trails, IP logs, and active login sessions"),
                    Map.of("key", "settings.manage", "label", "System & Gateway Settings", "description", "Configure Razorpay credentials, bank details, invoice prefixes, and branding")
                )
            )
        );
        return ResponseEntity.ok(catalog);
    }
}
