package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.security.services.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private TenantRepository tenantRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @GetMapping
    public ResponseEntity<?> getAllUsers(@RequestParam Map<String, String> params) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        List<User> users;
        if (isSuperAdmin) {
            users = userRepository.findAll();
        } else {
            Organization organization = getLoggedUserOrg();
            users = userRepository.findByOrganizationId(organization.getId());
        }

        String propertyIdStr = null;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getKey().contains("propertyId")) {
                propertyIdStr = entry.getValue();
                break;
            }
        }

        if (propertyIdStr != null && !propertyIdStr.trim().isEmpty()) {
            try {
                final UUID finalPropId = UUID.fromString(propertyIdStr);
                users = users.stream()
                        .filter(u -> u.getPropertyIds().contains(finalPropId))
                        .collect(Collectors.toList());
            } catch (Exception e) {
                // ignore
            }
        }
        
        List<Map<String, Object>> response = users.stream().map(user -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", user.getId());
            
            // Derive a name since name field is not in User
            String name = user.getEmail().split("@")[0];
            name = Character.toUpperCase(name.charAt(0)) + name.substring(1);
            map.put("name", name);
            
            map.put("email", user.getEmail());
            map.put("phone", user.getMobile());
            map.put("status", user.getStatus() != null ? user.getStatus().toLowerCase() : "active");
            map.put("createdAt", user.getCreatedAt());
            map.put("lastActive", user.getLastLogin() != null ? user.getLastLogin() : user.getCreatedAt());
            map.put("propertyIds", user.getPropertyIds().stream().map(UUID::toString).collect(Collectors.toList()));
            
            // Map the role back to frontend keys
            String roleName = "PROPERTY_MANAGER";
            if (!user.getRoles().isEmpty()) {
                Role firstRole = user.getRoles().iterator().next();
                String nameStr = firstRole.getName();
                if ("ROLE_SUPER_ADMIN".equalsIgnoreCase(nameStr) || "SUPER_ADMIN".equalsIgnoreCase(nameStr)) {
                    roleName = "SUPER_ADMIN";
                } else if ("ROLE_OWNER".equalsIgnoreCase(nameStr) || "OWNER".equalsIgnoreCase(nameStr)) {
                    roleName = "ADMIN";
                } else {
                    roleName = nameStr.startsWith("ROLE_") ? nameStr.substring(5) : nameStr;
                }
            }
            map.put("role", roleName);
            
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        String name = (String) request.get("name");
        String phone = (String) request.get("phone");
        String roleStr = (String) request.get("role");
        String status = (String) request.get("status");

        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is required!"));
        }

        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is already registered!"));
        }

        if (phone != null && !phone.trim().isEmpty() && userRepository.existsByMobile(phone)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Phone number is already registered!"));
        }

        Organization organization = getLoggedUserOrg();
        
        // Create user with default password
        User user = new User(organization, email, encoder.encode("Password123"), phone != null ? phone : "");
        if (status != null) {
            user.setStatus(status.toUpperCase());
        }

        List<?> propIdsRaw = (List<?>) request.get("propertyIds");
        List<UUID> propertyIds = new ArrayList<>();
        if (propIdsRaw != null) {
            for (Object idObj : propIdsRaw) {
                try {
                    propertyIds.add(UUID.fromString(idObj.toString()));
                } catch (Exception e) {
                    // skip
                }
            }
        }
        user.setPropertyIds(propertyIds);

        // Map role
        Set<Role> roles = new HashSet<>();
        ERole roleEnum = ERole.PROPERTY_MANAGER;
        if ("SUPER_ADMIN".equalsIgnoreCase(roleStr)) {
            boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                    .getAuthorities().stream()
                    .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));
            if (!isSuperAdmin) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new MessageResponse("Error: Only Super Admins can assign the SUPER_ADMIN role!"));
            }
            roleEnum = ERole.SUPER_ADMIN;
        } else if ("ADMIN".equalsIgnoreCase(roleStr) || "OWNER".equalsIgnoreCase(roleStr)) {
            roleEnum = ERole.OWNER;
        } else if (roleStr != null) {
            try {
                roleEnum = ERole.valueOf(roleStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                // fall back to default
            }
        }
        
        final ERole finalRole = roleEnum;
        Role userRole = roleRepository.findByName(finalRole)
                .orElseGet(() -> {
                    Role role = new Role(finalRole, "[\"ALL\"]");
                    return roleRepository.save(role);
                });
        roles.add(userRole);
        user.setRoles(roles);

        User saved = userRepository.save(user);

        Map<String, Object> map = new HashMap<>();
        map.put("id", saved.getId());
        map.put("name", name != null ? name : email.split("@")[0]);
        map.put("email", saved.getEmail());
        map.put("phone", saved.getMobile());
        map.put("status", saved.getStatus().toLowerCase());
        map.put("createdAt", saved.getCreatedAt());
        map.put("lastActive", saved.getCreatedAt());
        map.put("role", roleStr != null ? roleStr : "PROPERTY_MANAGER");
        map.put("propertyIds", saved.getPropertyIds().stream().map(UUID::toString).collect(Collectors.toList()));

        return new ResponseEntity<>(map, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateUser(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        Organization organization = getLoggedUserOrg();
        User user = userRepository.findById(id).orElse(null);
        if (user == null || !user.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: User not found."));
        }

        String email = (String) request.get("email");
        String name = (String) request.get("name");
        String phone = (String) request.get("phone");
        String roleStr = (String) request.get("role");
        String status = (String) request.get("status");

        if (email != null && !email.trim().isEmpty()) {
            if (!user.getEmail().equalsIgnoreCase(email) && userRepository.existsByEmail(email)) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is already registered!"));
            }
            user.setEmail(email);
        }

        if (phone != null && !phone.trim().isEmpty()) {
            if (!user.getMobile().equals(phone) && userRepository.existsByMobile(phone)) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Phone number is already registered!"));
            }
            user.setMobile(phone);
        }

        if (status != null) {
            user.setStatus(status.toUpperCase());
        }

        List<?> propIdsRaw = (List<?>) request.get("propertyIds");
        if (propIdsRaw != null) {
            List<UUID> propertyIds = new ArrayList<>();
            for (Object idObj : propIdsRaw) {
                try {
                    propertyIds.add(UUID.fromString(idObj.toString()));
                } catch (Exception e) {
                    // skip
                }
            }
            user.setPropertyIds(propertyIds);
        }

        if (roleStr != null) {
            Set<Role> roles = new HashSet<>();
            ERole roleEnum = ERole.PROPERTY_MANAGER;
            if ("SUPER_ADMIN".equalsIgnoreCase(roleStr)) {
                boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                        .getAuthorities().stream()
                        .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));
                if (!isSuperAdmin) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new MessageResponse("Error: Only Super Admins can assign the SUPER_ADMIN role!"));
                }
                roleEnum = ERole.SUPER_ADMIN;
            } else if ("ADMIN".equalsIgnoreCase(roleStr) || "OWNER".equalsIgnoreCase(roleStr)) {
                roleEnum = ERole.OWNER;
            } else {
                try {
                    roleEnum = ERole.valueOf(roleStr.toUpperCase());
                } catch (IllegalArgumentException e) {
                    // fall back
                }
            }

            final ERole finalRole = roleEnum;
            Role userRole = roleRepository.findByName(finalRole)
                    .orElseGet(() -> {
                        Role role = new Role(finalRole, "[\"ALL\"]");
                        return roleRepository.save(role);
                    });
            roles.add(userRole);
            user.setRoles(roles);
        }

        User updated = userRepository.save(user);

        Map<String, Object> map = new HashMap<>();
        map.put("id", updated.getId());
        map.put("name", name != null ? name : updated.getEmail().split("@")[0]);
        map.put("email", updated.getEmail());
        map.put("phone", updated.getMobile());
        map.put("status", updated.getStatus().toLowerCase());
        map.put("createdAt", updated.getCreatedAt());
        map.put("lastActive", updated.getLastLogin() != null ? updated.getLastLogin() : updated.getCreatedAt());
        map.put("role", roleStr != null ? roleStr : "PROPERTY_MANAGER");
        map.put("propertyIds", updated.getPropertyIds().stream().map(UUID::toString).collect(Collectors.toList()));

        return ResponseEntity.ok(map);
    }

    @Transactional
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteUser(@PathVariable UUID id) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: User not found."));
        }

        if (!isSuperAdmin) {
            Organization organization = getLoggedUserOrg();
            if (!user.getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: User not found."));
            }
        }

        // Don't allow deleting yourself
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        if (userDetails.getId().equals(user.getId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: You cannot delete your own account!"));
        }

        boolean isOwner = user.getRoles().stream().anyMatch(role -> "OWNER".equalsIgnoreCase(role.getName()) || "ADMIN".equalsIgnoreCase(role.getName()));

        if (isOwner) {
            // Archive all users of the organization
            List<User> orgUsers = userRepository.findByOrganizationId(user.getOrganization().getId());
            for (User u : orgUsers) {
                u.setStatus("ARCHIVED");
                userRepository.save(u);
                refreshTokenService.deleteByUserId(u.getId());
            }

            // Archive all properties of the organization
            List<Property> properties = propertyRepository.findByOrganization(user.getOrganization());
            for (Property p : properties) {
                p.setStatus("ARCHIVED");
                propertyRepository.save(p);
            }

            // Archive all tenants of the organization
            List<Tenant> tenants = tenantRepository.findByOrganization(user.getOrganization());
            for (Tenant t : tenants) {
                t.setStatus("ARCHIVED");
                tenantRepository.save(t);
            }
        } else {
            // Archive single user
            user.setStatus("ARCHIVED");
            userRepository.save(user);
            refreshTokenService.deleteByUserId(user.getId());
        }

        return ResponseEntity.ok(new MessageResponse("User successfully archived."));
    }
}
