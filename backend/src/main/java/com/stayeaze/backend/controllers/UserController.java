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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

    @Autowired
    private com.stayeaze.backend.services.AuditLogService auditLogService;

    @Autowired
    private com.stayeaze.backend.services.CredentialService credentialService;

    private Organization getLoggedUserOrg() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof UserDetailsImpl)) {
            throw new RuntimeException("User is not authenticated");
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        if (userDetails.getOrgId() == null) {
            return organizationRepository.findBySubdomain("system").orElse(null);
        }
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseGet(() -> organizationRepository.findBySubdomain("system").orElse(null));
    }

    @GetMapping
    public ResponseEntity<?> getAllUsers(@RequestParam Map<String, String> params) {
        int page = 1;
        int pageSize = 10;
        try { if (params.containsKey("page")) page = Math.max(1, Integer.parseInt(params.get("page"))); } catch (Exception ignored) {}
        try { if (params.containsKey("pageSize")) pageSize = Math.min(500, Math.max(1, Integer.parseInt(params.get("pageSize")))); } catch (Exception ignored) {}

        String sortBy = params.getOrDefault("sortBy", "createdAt");
        String sortOrder = params.getOrDefault("sortOrder", "desc");
        String sortField = "createdAt";
        if ("name".equalsIgnoreCase(sortBy) || "firstName".equalsIgnoreCase(sortBy)) {
            sortField = "firstName";
        } else if ("email".equalsIgnoreCase(sortBy)) {
            sortField = "email";
        } else if ("status".equalsIgnoreCase(sortBy)) {
            sortField = "status";
        } else if ("lastActive".equalsIgnoreCase(sortBy) || "lastLogin".equalsIgnoreCase(sortBy)) {
            sortField = "lastLogin";
        }

        org.springframework.data.domain.Sort sort = "asc".equalsIgnoreCase(sortOrder)
                ? org.springframework.data.domain.Sort.by(sortField).ascending()
                : org.springframework.data.domain.Sort.by(sortField).descending();

        org.springframework.data.domain.Pageable pageRequest = org.springframework.data.domain.PageRequest.of(page - 1, pageSize, sort);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSuperAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN") || a.getAuthority().equals("ROLE_SUPPORT"));

        UUID effectiveOrgId = null;
        if (!isSuperAdmin) {
            if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl) {
                effectiveOrgId = ((UserDetailsImpl) auth.getPrincipal()).getOrgId();
            } else {
                Organization organization = getLoggedUserOrg();
                effectiveOrgId = organization != null ? organization.getId() : null;
            }
        } else if (params.containsKey("orgId") && params.get("orgId") != null && !params.get("orgId").isBlank() && !"all".equalsIgnoreCase(params.get("orgId"))) {
            try {
                effectiveOrgId = UUID.fromString(params.get("orgId").trim());
            } catch (Exception ignored) {}
        }

        final UUID targetOrgId = effectiveOrgId;
        final String search = params.get("search");
        final String roleFilter = params.get("role");

        org.springframework.data.jpa.domain.Specification<User> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (targetOrgId != null) {
                predicates.add(cb.equal(root.get("organization").get("id"), targetOrgId));
            }
            if (search != null && !search.isBlank()) {
                String q = "%" + search.toLowerCase().trim() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("email")), q),
                    cb.like(cb.lower(root.get("firstName")), q),
                    cb.like(root.get("mobile"), q)
                ));
            }
            if (roleFilter != null && !roleFilter.isBlank() && !"all".equalsIgnoreCase(roleFilter)) {
                String rTarget = roleFilter.toUpperCase().trim().replace("ROLE_", "");
                jakarta.persistence.criteria.Join<User, Role> roleJoin = root.join("roles");
                predicates.add(cb.or(
                    cb.equal(cb.upper(roleJoin.get("name")), rTarget),
                    cb.equal(cb.upper(roleJoin.get("name")), "ROLE_" + rTarget)
                ));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        Page<User> usersPage = userRepository.findAll(spec, pageRequest);
        List<User> userList = usersPage.getContent();
        long total = usersPage.getTotalElements();
        int totalPages = usersPage.getTotalPages();

        List<Map<String, Object>> response = userList.stream().map(user -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", user.getId());

            String name = user.getFirstName();
            if (name == null || name.isBlank()) {
                if (user.getOrganization() != null && user.getOrganization().getName() != null && !user.getOrganization().getName().isBlank()) {
                    name = user.getOrganization().getName();
                }
            }
            if (name == null || name.isBlank()) {
                String prefix = user.getEmail() != null && user.getEmail().contains("@") ? user.getEmail().split("@")[0] : "User";
                name = Character.toUpperCase(prefix.charAt(0)) + prefix.substring(1);
            }
            map.put("name", name);

            map.put("email", user.getEmail());
            map.put("phone", user.getMobile());
            map.put("status", user.getStatus() != null ? user.getStatus().toLowerCase() : "active");
            map.put("createdAt", user.getCreatedAt());
            map.put("lastActive", user.getLastLogin() != null ? user.getLastLogin() : user.getCreatedAt());

            List<UUID> pIds = user.getPropertyIds() != null ? user.getPropertyIds() : Collections.emptyList();
            map.put("propertyIds", pIds.stream().map(UUID::toString).collect(Collectors.toList()));

            // Map the role back to frontend keys
            String roleName = "PROPERTY_MANAGER";
            if (user.getRoles() != null && !user.getRoles().isEmpty()) {
                boolean isSuper = user.getRoles().stream().anyMatch(r -> r != null && r.getName() != null &&
                        ("ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));
                boolean isOwner = user.getRoles().stream().anyMatch(r -> r != null && r.getName() != null &&
                        ("ROLE_OWNER".equalsIgnoreCase(r.getName()) || "OWNER".equalsIgnoreCase(r.getName()) || "ADMIN".equalsIgnoreCase(r.getName())));

                if (isSuper) {
                    roleName = "SUPER_ADMIN";
                } else if (isOwner) {
                    roleName = "OWNER";
                } else {
                    Role firstRole = user.getRoles().iterator().next();
                    String nameStr = firstRole != null && firstRole.getName() != null ? firstRole.getName() : "PROPERTY_MANAGER";
                    roleName = nameStr.startsWith("ROLE_") ? nameStr.substring(5) : nameStr;
                }
            }
            map.put("role", roleName);
            map.put("orgId", user.getOrganization() != null ? user.getOrganization().getId() : null);
            map.put("orgName", user.getOrganization() != null ? user.getOrganization().getName() : "StayEaze Platform");
            map.put("orgSubdomain", user.getOrganization() != null ? user.getOrganization().getSubdomain() : "system");

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(new com.stayeaze.backend.payload.response.PageResponse<>(
                response,
                total,
                page,
                pageSize,
                totalPages
        ));
    }

    @Autowired
    private com.stayeaze.backend.services.SubscriptionEnforcementService enforcementService;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.services.AccountUniquenessService accountUniquenessService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSuperAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Organization organization = null;
        if (!isSuperAdmin) {
            organization = getLoggedUserOrg();
            try {
                enforcementService.validateStaffUserCreation(organization);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
            }
        } else {
            if (request.containsKey("orgId") && request.get("orgId") != null) {
                try {
                    UUID specifiedOrgId = UUID.fromString(request.get("orgId").toString());
                    organization = organizationRepository.findById(specifiedOrgId).orElse(null);
                } catch (Exception ignored) {}
            }
            if (organization == null) {
                organization = organizationRepository.findBySubdomain("system").orElse(null);
            }
        }

        String email = (String) request.get("email");
        String name = (String) request.get("name");
        String phone = (String) request.get("phone");
        String roleStr = (String) request.get("role");
        String status = (String) request.get("status");

        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is required!"));
        }

        String cleanEmail = accountUniquenessService.normalizeEmail(email);
        String cleanPhone = accountUniquenessService.normalizeMobile(phone);

        // Universal Uniqueness Validation across Users and Active Residents
        try {
            accountUniquenessService.validateStaffEmailAndMobile(organization, cleanEmail, cleanPhone, null);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
        
        // Generate cryptographically secure 12-character random temporary password
        String tempPassword = credentialService.generateSecurePassword();

        User user = new User(organization, cleanEmail, encoder.encode(tempPassword), cleanPhone);
        user.setOrganization(organization);
        user.setPassword(encoder.encode(tempPassword));
        user.setMustChangePassword(true);
        user.setLockedUntil(null);
        user.setFailedAttempts(0);

        if (name != null && !name.trim().isEmpty()) {
            user.setFirstName(name.trim());
        }
        if (status != null) {
            user.setStatus(status.toUpperCase());
        } else {
            user.setStatus("ACTIVE");
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
        if (roleStr != null && !roleStr.isBlank()) {
            String upperRole = roleStr.toUpperCase().trim();
            if ("SUPER_ADMIN".equals(upperRole) || "ROLE_SUPER_ADMIN".equals(upperRole)) {
                if (!isSuperAdmin) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new MessageResponse("Error: Only Super Admins can assign the SUPER_ADMIN role!"));
                }
                roleEnum = ERole.SUPER_ADMIN;
            } else if ("SUPPORT".equals(upperRole) || "ROLE_SUPPORT".equals(upperRole)) {
                if (!isSuperAdmin) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new MessageResponse("Error: Only Super Admins can assign the SUPPORT role!"));
                }
                roleEnum = ERole.SUPPORT;
            } else if (upperRole.contains("OWNER") || upperRole.contains("ADMIN")) {
                roleEnum = ERole.OWNER;
            } else {
                try {
                    roleEnum = ERole.valueOf(upperRole.replace("ROLE_", ""));
                } catch (IllegalArgumentException e) {
                    roleEnum = ERole.PROPERTY_MANAGER;
                }
            }
        }
        
        final ERole finalRole = roleEnum;
        Role userRole = roleRepository.findByName(finalRole)
                .orElseGet(() -> {
                    Role role = new Role(finalRole, "[\"ALL\"]");
                    return roleRepository.save(role);
                });
        if (user.getRoles() == null) {
            user.setRoles(new HashSet<>());
        } else {
            user.getRoles().clear();
        }
        user.getRoles().add(userRole);

        User saved = userRepository.save(user);

        // Dispatch credentials via email
        try {
            emailService.sendNewUserCredentials(saved.getEmail(), tempPassword, saved.getFirstName());
        } catch (Exception ignored) {}

        Map<String, Object> map = new HashMap<>();
        map.put("id", saved.getId());
        map.put("name", name != null ? name : email.split("@")[0]);
        map.put("email", saved.getEmail());
        map.put("phone", saved.getMobile());
        map.put("status", saved.getStatus().toLowerCase());
        map.put("createdAt", saved.getCreatedAt());
        map.put("lastActive", saved.getCreatedAt());
        map.put("role", roleStr != null ? roleStr : "PROPERTY_MANAGER");
        map.put("mustChangePassword", true);
        map.put("tempPassword", tempPassword);
        map.put("propertyIds", saved.getPropertyIds().stream().map(UUID::toString).collect(Collectors.toList()));

        return new ResponseEntity<>(map, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateUser(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: User not found."));
        }

        if (!isSuperAdmin) {
            Organization organization = getLoggedUserOrg();
            if (user.getOrganization() == null || !user.getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: User not found."));
            }
        }

        String email = (String) request.get("email");
        String name = (String) request.get("name");
        String phone = (String) request.get("phone");
        String roleStr = (String) request.get("role");
        String status = (String) request.get("status");

        if (name != null && !name.trim().isEmpty()) {
            user.setFirstName(name.trim());
        }

        String newEmail = email != null && !email.trim().isEmpty() ? email.trim() : user.getEmail();
        String newPhone = phone != null && !phone.trim().isEmpty() ? phone.trim() : user.getMobile();

        try {
            accountUniquenessService.validateStaffEmailAndMobile(user.getOrganization(), newEmail, newPhone, id);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }

        if (email != null && !email.trim().isEmpty()) {
            user.setEmail(accountUniquenessService.normalizeEmail(email));
        }

        if (phone != null && !phone.trim().isEmpty()) {
            user.setMobile(accountUniquenessService.normalizeMobile(phone));
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

        if (roleStr != null && !roleStr.isBlank()) {
            Set<Role> roles = new HashSet<>();
            ERole roleEnum = ERole.PROPERTY_MANAGER;
            String upper = roleStr.toUpperCase().trim();
            if ("SUPER_ADMIN".equals(upper) || "ROLE_SUPER_ADMIN".equals(upper)) {
                if (!isSuperAdmin) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new MessageResponse("Error: Only Super Admins can assign the SUPER_ADMIN role!"));
                }
                roleEnum = ERole.SUPER_ADMIN;
            } else if ("SUPPORT".equals(upper) || "ROLE_SUPPORT".equals(upper)) {
                if (!isSuperAdmin) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new MessageResponse("Error: Only Super Admins can assign the SUPPORT role!"));
                }
                roleEnum = ERole.SUPPORT;
            } else if (upper.contains("OWNER") || upper.contains("ADMIN")) {
                roleEnum = ERole.OWNER;
            } else {
                try {
                    roleEnum = ERole.valueOf(upper.replace("ROLE_", ""));
                } catch (IllegalArgumentException e) {
                    roleEnum = ERole.PROPERTY_MANAGER;
                }
            }

            final ERole finalRole = roleEnum;
            Role userRole = roleRepository.findByName(finalRole)
                    .orElseGet(() -> {
                        Role role = new Role(finalRole, "[\"ALL\"]");
                        return roleRepository.save(role);
                    });
            if (user.getRoles() == null) {
                user.setRoles(new HashSet<>());
            } else {
                user.getRoles().clear();
            }
            user.getRoles().add(userRole);
        }

        User updated = userRepository.save(user);

        String updatedRoleStr = "PROPERTY_MANAGER";
        if (updated.getRoles() != null && !updated.getRoles().isEmpty()) {
            boolean isSuper = updated.getRoles().stream().anyMatch(r -> r != null && r.getName() != null && 
                ("ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));
            boolean isOwner = updated.getRoles().stream().anyMatch(r -> r != null && r.getName() != null && 
                ("ROLE_OWNER".equalsIgnoreCase(r.getName()) || "OWNER".equalsIgnoreCase(r.getName()) || "ADMIN".equalsIgnoreCase(r.getName())));
            
            if (isSuper) {
                updatedRoleStr = "SUPER_ADMIN";
            } else if (isOwner) {
                updatedRoleStr = "OWNER";
            } else {
                Role firstRole = updated.getRoles().iterator().next();
                String nameStr = firstRole.getName();
                updatedRoleStr = nameStr.startsWith("ROLE_") ? nameStr.substring(5) : nameStr;
            }
        }

        Map<String, Object> map = new HashMap<>();
        map.put("id", updated.getId());
        map.put("name", updated.getFirstName() != null ? updated.getFirstName() : updated.getEmail().split("@")[0]);
        map.put("email", updated.getEmail());
        map.put("phone", updated.getMobile());
        map.put("status", updated.getStatus().toLowerCase());
        map.put("createdAt", updated.getCreatedAt());
        map.put("lastActive", updated.getLastLogin() != null ? updated.getLastLogin() : updated.getCreatedAt());
        map.put("role", updatedRoleStr);
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

    @PutMapping("/me")
    public ResponseEntity<?> updateCurrentProfile(@RequestBody Map<String, Object> request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("User profile not found."));
        }

        String email = (String) request.get("email");
        String name = (String) request.get("name");
        String phone = (String) request.get("phone");
        String avatarUrl = (String) request.get("avatarUrl");

        if (name != null && !name.trim().isEmpty()) {
            user.setFirstName(name.trim());
        }

        if (avatarUrl != null) {
            user.setAvatarUrl(avatarUrl);
        }

        if (email != null && !email.trim().isEmpty() && !email.equalsIgnoreCase(user.getEmail())) {
            if (userRepository.existsByEmail(email)) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is already registered!"));
            }
            user.setEmail(email.trim().toLowerCase());
        }

        if (phone != null && !phone.trim().isEmpty() && !phone.equalsIgnoreCase(user.getMobile())) {
            user.setMobile(phone.trim());
        }

        if (request.containsKey("notificationPreferences")) {
            try {
                Object notifObj = request.get("notificationPreferences");
                String jsonStr = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(notifObj);
                user.setNotificationPreferences(jsonStr);
            } catch (Exception ignored) {}
        }

        User saved = userRepository.save(user);
        auditLogService.logCurrent("Updated user profile details and settings.", null);
        Map<String, Object> res = new HashMap<>();
        res.put("id", saved.getId());
        res.put("email", saved.getEmail());
        res.put("phone", saved.getMobile());
        res.put("name", saved.getFirstName() != null ? saved.getFirstName() : saved.getEmail());
        res.put("avatarUrl", saved.getAvatarUrl());
        res.put("twoFactorEnabled", Boolean.TRUE.equals(saved.getIsTwoFactorEnabled()));

        Map<String, Object> notifPrefs = new HashMap<>();
        if (saved.getNotificationPreferences() != null && !saved.getNotificationPreferences().isBlank()) {
            try {
                notifPrefs = new com.fasterxml.jackson.databind.ObjectMapper().readValue(saved.getNotificationPreferences(), Map.class);
            } catch (Exception ignored) {}
        }
        res.put("notificationPreferences", notifPrefs);
        res.put("message", "Profile details updated successfully.");
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUserProfile() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                : null;

        if (!(principal instanceof UserDetailsImpl userDetails)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("User is not authenticated."));
        }

        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("User profile not found."));
        }

        Map<String, Object> res = new HashMap<>();
        res.put("id", user.getId());
        res.put("email", user.getEmail());
        res.put("phone", user.getMobile());
        res.put("name", user.getFirstName() != null ? user.getFirstName() : user.getEmail());
        res.put("avatarUrl", user.getAvatarUrl());
        res.put("twoFactorEnabled", Boolean.TRUE.equals(user.getIsTwoFactorEnabled()));

        // Role & Property Mapping
        String roleName = "PROPERTY_MANAGER";
        List<String> roleList = new ArrayList<>();
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            roleList = user.getRoles().stream().map(Role::getName).collect(Collectors.toList());
            boolean isSuper = user.getRoles().stream().anyMatch(r -> r != null && r.getName() != null && 
                ("ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));
            boolean isOwner = user.getRoles().stream().anyMatch(r -> r != null && r.getName() != null && 
                ("ROLE_OWNER".equalsIgnoreCase(r.getName()) || "OWNER".equalsIgnoreCase(r.getName()) || "ADMIN".equalsIgnoreCase(r.getName())));
            
            if (isSuper) {
                roleName = "SUPER_ADMIN";
            } else if (isOwner) {
                roleName = "OWNER";
            } else {
                Role firstRole = user.getRoles().iterator().next();
                String nameStr = firstRole.getName();
                roleName = nameStr.startsWith("ROLE_") ? nameStr.substring(5) : nameStr;
            }
        }
        res.put("role", roleName);
        res.put("roles", roleList);

        List<UUID> pIds = new ArrayList<>(user.getPropertyIds() != null ? user.getPropertyIds() : Collections.emptyList());
        if (pIds.isEmpty() && user.getOrganization() != null) {
            List<Property> orgProps = propertyRepository.findByOrganizationId(user.getOrganization().getId());
            for (Property p : orgProps) {
                pIds.add(p.getId());
            }
        }
        res.put("propertyIds", pIds.stream().map(UUID::toString).collect(Collectors.toList()));

        Map<String, Object> notifPrefs = new HashMap<>();
        if (user.getNotificationPreferences() != null && !user.getNotificationPreferences().isBlank()) {
            try {
                notifPrefs = new com.fasterxml.jackson.databind.ObjectMapper().readValue(user.getNotificationPreferences(), Map.class);
            } catch (Exception ignored) {}
        }
        res.put("notificationPreferences", notifPrefs);
        return ResponseEntity.ok(res);
    }

    @PutMapping("/notifications")
    public ResponseEntity<?> updateNotificationPreferences(@RequestBody Map<String, Object> request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("User profile not found."));
        }

        try {
            String jsonStr = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(request);
            user.setNotificationPreferences(jsonStr);
            userRepository.save(user);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Failed to update notification preferences."));
        }

        Map<String, Object> res = new HashMap<>();
        res.put("notificationPreferences", request);
        res.put("message", "Notification preferences saved successfully!");
        return ResponseEntity.ok(res);
    }

    @PutMapping("/2fa")
    public ResponseEntity<?> toggleTwoFactor(@RequestBody Map<String, Boolean> request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("User profile not found."));
        }

        Boolean enabled = request.get("enabled");
        if (enabled == null) {
            enabled = !user.getIsTwoFactorEnabled();
        }

        user.setIsTwoFactorEnabled(enabled);
        if (!enabled) {
            user.setTwoFactorOtp(null);
            user.setTwoFactorOtpExpiry(null);
        }
        userRepository.save(user);

        Map<String, Object> res = new HashMap<>();
        res.put("twoFactorEnabled", enabled);
        res.put("message", enabled ? "Two-Factor Authentication enabled!" : "Two-Factor Authentication disabled.");
        return ResponseEntity.ok(res);
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("User not found."));
        }

        String currentPassword = request.get("currentPassword");
        String newPassword = request.get("newPassword");

        if (currentPassword == null || newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Current password and new password are required."));
        }

        if (!encoder.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Current password does not match."));
        }

        user.setPassword(encoder.encode(newPassword));
        userRepository.save(user);
        return ResponseEntity.ok(new MessageResponse("Password updated successfully!"));
    }
}

