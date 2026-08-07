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
        "SUPER_ADMIN", "OWNER", "ROLE_SUPER_ADMIN", "ROLE_OWNER",
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
        List<User> allUsers = userRepository.findAll();

        List<Map<String, Object>> response = roles.stream().map(role -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", role.getId());
            
            // Map name back to frontend key (e.g. OWNER -> ADMIN)
            String roleName = role.getName();
            if (roleName.startsWith("ROLE_")) {
                roleName = roleName.substring(5);
            }
            if ("OWNER".equals(roleName)) {
                roleName = "ADMIN";
            }
            map.put("name", roleName);

            map.put("description", "System defined role for " + roleName + " operations.");
            map.put("isSystem", SYSTEM_ROLES.contains(role.getName()));

            // Compute userCount
            long userCount = allUsers.stream()
                    .filter(u -> u.getRoles().stream().anyMatch(r -> r.getId().equals(role.getId())))
                    .count();
            map.put("userCount", userCount);

            // Parse permissions list from JSON
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

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping
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
}
