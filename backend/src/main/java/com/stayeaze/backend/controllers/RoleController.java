package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.stream.Collectors;

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
        if (roleRepository.findAll().stream().anyMatch(r -> r.getName().equalsIgnoreCase(finalDbName))) {
            return ResponseEntity.badRequest().body(new com.stayeaze.backend.payload.response.MessageResponse("Error: Role already exists!"));
        }

        String description = (String) request.get("description");
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
                "category", "Property Management",
                "icon", "Building2",
                "permissions", List.of(
                    Map.of("key", "property.read", "label", "View Properties", "description", "View properties, campuses, and configurations"),
                    Map.of("key", "property.write", "label", "Manage Properties", "description", "Create, edit, or configure properties"),
                    Map.of("key", "building.manage", "label", "Buildings & Floors", "description", "Add, edit, or delete buildings and floor plans"),
                    Map.of("key", "room.manage", "label", "Rooms & Beds", "description", "Configure room sharing types, pricing, and beds")
                )
            ),
            Map.of(
                "category", "Tenancy & Bookings",
                "icon", "Users",
                "permissions", List.of(
                    Map.of("key", "tenant.read", "label", "View Residents", "description", "View tenant profiles, emergency contacts, and KYC"),
                    Map.of("key", "tenant.write", "label", "Manage Residents", "description", "Onboard new tenants, upload ID proofs, and edit profiles"),
                    Map.of("key", "booking.read", "label", "View Bookings", "description", "View room reservations, inquiries, and requests"),
                    Map.of("key", "booking.write", "label", "Create Bookings", "description", "Reserve beds, process token advances, and allocate rooms"),
                    Map.of("key", "checkin.manage", "label", "Check-in & Check-out", "description", "Process digital check-ins, move-outs, and room transfers")
                )
            ),
            Map.of(
                "category", "Finance & Invoicing",
                "icon", "CreditCard",
                "permissions", List.of(
                    Map.of("key", "billing.read", "label", "View Invoices", "description", "Access monthly rent invoices, utility bills, and tariffs"),
                    Map.of("key", "billing.write", "label", "Generate Invoices", "description", "Create custom bills, apply discounts, and edit line items"),
                    Map.of("key", "payment.read", "label", "View Payments", "description", "View receipts, settlement status, and payment histories"),
                    Map.of("key", "payment.write", "label", "Record Payments", "description", "Log offline payments, approve refunds, and reconcile"),
                    Map.of("key", "deposit.manage", "label", "Security Deposits", "description", "Process deposit deductions, settlements, and net refunds")
                )
            ),
            Map.of(
                "category", "Operations & Facilities",
                "icon", "Wrench",
                "permissions", List.of(
                    Map.of("key", "complaint.read", "label", "View Complaints", "description", "View resident grievances, tickets, and photos"),
                    Map.of("key", "complaint.write", "label", "Resolve Complaints", "description", "Assign tickets to staff, update status, and close complaints"),
                    Map.of("key", "maintenance.read", "label", "View Maintenance", "description", "View scheduled repairs and asset maintenance logs"),
                    Map.of("key", "maintenance.write", "label", "Manage Maintenance", "description", "Create maintenance tasks, log costs, and complete jobs"),
                    Map.of("key", "visitor.read", "label", "View Visitors", "description", "View visitor entry logs, vehicle numbers, and checkout times"),
                    Map.of("key", "visitor.write", "label", "Log Visitors", "description", "Register guests, issue digital visitor passes, and check out")
                )
            ),
            Map.of(
                "category", "Administration & Security",
                "icon", "ShieldCheck",
                "permissions", List.of(
                    Map.of("key", "user.read", "label", "View Staff & Users", "description", "View staff members, managers, and assigned properties"),
                    Map.of("key", "user.write", "label", "Manage Staff", "description", "Create staff logins, assign roles, and modify access"),
                    Map.of("key", "reporting.read", "label", "Analytics & Reports", "description", "View financial summaries, occupancy stats, and export CSVs"),
                    Map.of("key", "audit.read", "label", "Audit Logs", "description", "Inspect security logs, login timestamps, and system actions"),
                    Map.of("key", "settings.manage", "label", "System Settings", "description", "Configure payment gateways, templates, and notifications")
                )
            )
        );
        return ResponseEntity.ok(catalog);
    }
}
