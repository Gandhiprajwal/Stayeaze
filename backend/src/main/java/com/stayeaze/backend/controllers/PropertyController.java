package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.PropertyRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import com.stayeaze.backend.payload.response.MinimalPropertyDTO;
import com.stayeaze.backend.payload.response.PropertyDTO;
import com.stayeaze.backend.services.PropertyService;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/properties")
public class PropertyController {

    @Autowired
    private PropertyService propertyService;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder encoder;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createProperty(@RequestBody Map<String, Object> request) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Organization organization;
        String ownerEmail = null;
        String ownerPassword = "owner123";
        String orgName = null;

        String name = (String) request.get("name");
        String address = (String) request.get("address");
        String code = (String) request.get("code");
        String type = (String) request.get("type");
        String city = (String) request.get("city");
        String state = (String) request.get("state");
        String pincode = (String) request.get("pincode");
        String manager = (String) request.get("manager");
        String phone = (String) request.get("phone");
        String email = (String) request.get("email");
        String status = (String) request.get("status");
        String description = (String) request.get("description");
        List<String> amenities = (List<String>) request.get("amenities");
        String currency = (String) request.get("currency");
        String timezone = (String) request.get("timezone");

        if (name == null || name.trim().isEmpty() || address == null || address.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Property Name and Address are required!"));
        }

        if (isSuperAdmin) {
            orgName = (String) request.get("orgName");
            String orgSubdomain = (String) request.get("orgSubdomain");
            ownerEmail = (String) request.get("ownerEmail");
            String ownerPhone = (String) request.get("ownerPhone");
            String passInput = (String) request.get("ownerPassword");
            if (passInput != null && !passInput.trim().isEmpty()) {
                ownerPassword = passInput;
            }

            if (orgName == null || orgName.trim().isEmpty() || orgSubdomain == null || orgSubdomain.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                        new MessageResponse("Error: Organization Name and Subdomain are required for Super Admin!"));
            }
            if (ownerEmail == null || ownerEmail.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new MessageResponse("Error: Owner Email is required for Super Admin!"));
            }

            // 1. Find or Create Organization
            final String finalSub = orgSubdomain.trim().toLowerCase();
            final String finalOrgName = orgName.trim();
            organization = organizationRepository.findAll().stream()
                    .filter(org -> org.getSubdomain().equalsIgnoreCase(finalSub))
                    .findFirst()
                    .orElseGet(() -> {
                        Organization org = new Organization(finalOrgName, finalSub);
                        return organizationRepository.save(org);
                    });

            // 2. Find or Create Owner User
            final String finalEmail = ownerEmail.trim().toLowerCase();
            String phoneInput = ownerPhone != null ? ownerPhone.trim() : "";
            if (phoneInput.isEmpty()) {
                phoneInput = "M-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            }
            final String finalPhone = phoneInput;
            final String finalPass = ownerPassword;
            final Organization finalOrg = organization;

            Optional<User> existingUser = userRepository.findByEmail(finalEmail);
            User owner;
            if (existingUser.isPresent()) {
                owner = existingUser.get();
                owner.setOrganization(finalOrg);
                owner.setPassword(encoder.encode(finalPass));
                if (ownerPhone != null && !ownerPhone.trim().isEmpty()) {
                    String cleanPhone = ownerPhone.trim();
                    if (!cleanPhone.equals(owner.getMobile()) && userRepository.existsByMobile(cleanPhone)) {
                        return ResponseEntity.badRequest().body(
                                new MessageResponse("Error: Mobile number is already registered to another user!"));
                    }
                    owner.setMobile(cleanPhone);
                }
                Role ownerRole = roleRepository.findByName(ERole.OWNER)
                        .orElseGet(() -> {
                            Role r = new Role(ERole.OWNER, "[\"ALL\"]");
                            return roleRepository.save(r);
                        });
                if (owner.getRoles() == null) {
                    owner.setRoles(new HashSet<>());
                }
                owner.getRoles().add(ownerRole);
                userRepository.save(owner);
            } else {
                if (userRepository.existsByMobile(finalPhone)) {
                    return ResponseEntity.badRequest()
                            .body(new MessageResponse("Error: Mobile number is already registered to another user!"));
                }
                owner = new User(finalOrg, finalEmail, encoder.encode(finalPass), finalPhone);
                Role ownerRole = roleRepository.findByName(ERole.OWNER)
                        .orElseGet(() -> {
                            Role r = new Role(ERole.OWNER, "[\"ALL\"]");
                            return roleRepository.save(r);
                        });
                Set<Role> roles = new HashSet<>();
                roles.add(ownerRole);
                owner.setRoles(roles);
                userRepository.save(owner);
            }
        } else {
            organization = getLoggedUserOrg();
        }

        Property property = new Property(organization, name, address);
        property.setDescription(description);
        property.setCode(code);
        if (type != null) {
            property.setType(type);
        }
        property.setCity(city);
        property.setState(state);
        property.setPincode(pincode);
        property.setManager(manager);
        property.setPhone(phone);
        property.setEmail(email);
        if (status != null) {
            property.setStatus(status);
        }

        if (amenities != null) {
            property.setAmenities(amenities);
        }
        if (currency != null) {
            property.setCurrency(currency);
        } else {
            property.setCurrency("INR");
        }
        if (timezone != null) {
            property.setTimezone(timezone);
        } else {
            property.setTimezone("Asia/Kolkata");
        }

        if (request.get("landlordPan") != null)
            property.setLandlordPan((String) request.get("landlordPan"));
        if (request.get("pgLicenseNo") != null)
            property.setPgLicenseNo((String) request.get("pgLicenseNo"));
        if (request.get("bankAccountName") != null)
            property.setBankAccountName((String) request.get("bankAccountName"));
        if (request.get("bankName") != null)
            property.setBankName((String) request.get("bankName"));
        if (request.get("bankAccountNumber") != null)
            property.setBankAccountNumber((String) request.get("bankAccountNumber"));
        if (request.get("bankIfsc") != null)
            property.setBankIfsc((String) request.get("bankIfsc"));
        if (request.get("upiVpa") != null)
            property.setUpiVpa((String) request.get("upiVpa"));
        if (request.get("authorizedSignatory") != null)
            property.setAuthorizedSignatory((String) request.get("authorizedSignatory"));

        Property saved = propertyService.saveProperty(property);

        String targetUserEmail = ownerEmail != null ? ownerEmail.trim().toLowerCase() : null;
        if (targetUserEmail == null) {
            try {
                UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                targetUserEmail = userDetails.getUsername();
            } catch (Exception ignored) {}
        }
        if (targetUserEmail != null) {
            userRepository.findByEmail(targetUserEmail).ifPresent(u -> {
                if (u.getPropertyIds() == null) {
                    u.setPropertyIds(new ArrayList<>());
                }
                if (!u.getPropertyIds().contains(saved.getId())) {
                    u.getPropertyIds().add(saved.getId());
                    userRepository.save(u);
                }
            });
        }

        Map<String, Object> map = new HashMap<>();
        map.put("id", saved.getId());
        map.put("name", saved.getName());
        map.put("code", saved.getCode());
        map.put("type", saved.getType());
        map.put("address", saved.getAddress());
        map.put("city", saved.getCity());
        map.put("state", saved.getState());
        map.put("pincode", saved.getPincode());
        map.put("manager", saved.getManager());
        map.put("phone", saved.getPhone());
        map.put("email", saved.getEmail());
        map.put("description", saved.getDescription());
        map.put("amenities", saved.getAmenities());
        map.put("status", saved.getStatus());
        map.put("currency", saved.getCurrency());
        map.put("timezone", saved.getTimezone());
        map.put("createdAt", saved.getCreatedAt());

        map.put("totalBuildings", saved.getTotalBuildings());
        map.put("totalRooms", saved.getTotalRooms());
        map.put("totalBeds", saved.getTotalBeds());
        map.put("occupiedBeds", saved.getOccupiedBeds());

        if (isSuperAdmin) {
            map.put("ownerEmail", ownerEmail);
            map.put("ownerPassword", ownerPassword);
            map.put("orgName", orgName);

            if (ownerEmail != null) {
                final String finalEmail = ownerEmail.trim().toLowerCase();
                userRepository.findByEmail(finalEmail).ifPresent(o -> {
                    List<UUID> propIds = o.getPropertyIds();
                    if (propIds == null) {
                        propIds = new ArrayList<>();
                    }
                    if (!propIds.contains(saved.getId())) {
                        propIds.add(saved.getId());
                        o.setPropertyIds(propIds);
                        userRepository.save(o);
                    }
                });
            }
        }

        return new ResponseEntity<>(map, HttpStatus.CREATED);
    }

    private Map<String, Object> mapPropertyToDto(Property p) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", p.getId());
        dto.put("name", p.getName());
        dto.put("code", p.getCode());
        dto.put("type", p.getType());
        dto.put("description", p.getDescription());
        dto.put("address", p.getAddress());
        dto.put("city", p.getCity());
        dto.put("state", p.getState());
        dto.put("pincode", p.getPincode());
        dto.put("manager", p.getManager());
        dto.put("phone", p.getPhone());
        dto.put("email", p.getEmail());
        dto.put("landlordPan", p.getLandlordPan());
        dto.put("pgLicenseNo", p.getPgLicenseNo());
        dto.put("bankAccountName", p.getBankAccountName());
        dto.put("bankName", p.getBankName());
        dto.put("bankAccountNumber", p.getBankAccountNumber());
        dto.put("bankIfsc", p.getBankIfsc());
        dto.put("upiVpa", p.getUpiVpa());
        dto.put("authorizedSignatory", p.getAuthorizedSignatory());
        try {
            dto.put("amenities", p.getAmenities());
        } catch (Exception e) {
            dto.put("amenities", new ArrayList<>());
        }
        dto.put("status", p.getStatus());
        dto.put("currency", p.getCurrency());
        dto.put("timezone", p.getTimezone());
        dto.put("totalBuildings", p.getTotalBuildings());
        dto.put("totalRooms", p.getTotalRooms());
        dto.put("totalBeds", p.getTotalBeds());
        dto.put("occupiedBeds", p.getOccupiedBeds());
        dto.put("orgId", p.getOrganization() != null ? p.getOrganization().getId() : null);
        dto.put("createdAt", p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        return dto;
    }

    @GetMapping
    public ResponseEntity<?> getAllProperties(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));

        org.springframework.data.domain.Page<PropertyDTO> pageResult;
        if (isSuperAdmin) {
            pageResult = propertyService.getAllPropertiesForSuperAdminPaged(pageable);
        } else {
            UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                    .getAuthentication().getPrincipal();
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                pageResult = propertyService.getPropertiesByIdsPaged(user.getPropertyIds(), pageable);
            } else {
                pageResult = org.springframework.data.domain.Page.empty(pageable);
            }
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.ofPage(pageResult));
    }

    @GetMapping("/minimal")
    public ResponseEntity<?> getMinimalProperties() {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        List<MinimalPropertyDTO> properties;
        if (isSuperAdmin) {
            properties = propertyService.getMinimalPropertiesForSuperAdmin();
        } else {
            UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                    .getAuthentication().getPrincipal();
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                properties = propertyService.getMinimalPropertiesByIds(user.getPropertyIds());
            } else {
                properties = new ArrayList<>();
            }
        }

        return ResponseEntity.ok(properties != null ? properties : new ArrayList<>());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPropertyById(@PathVariable UUID id) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Property property;
        if (isSuperAdmin) {
            property = propertyRepository.findById(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            property = propertyRepository.findByIdAndOrganization(id, organization)
                    .orElse(null);
        }

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        return ResponseEntity.ok(PropertyDTO.fromEntity(property));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateProperty(@PathVariable UUID id, @Valid @RequestBody PropertyRequest request) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Property property;
        if (isSuperAdmin) {
            property = propertyRepository.findById(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            property = propertyRepository.findByIdAndOrganization(id, organization)
                    .orElse(null);
        }

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        property.setName(request.getName());
        property.setAddress(request.getAddress());
        property.setDescription(request.getDescription());
        property.setCode(request.getCode());
        if (request.getType() != null) {
            property.setType(request.getType());
        }
        property.setCity(request.getCity());
        property.setState(request.getState());
        property.setPincode(request.getPincode());
        property.setManager(request.getManager());
        property.setPhone(request.getPhone());
        property.setEmail(request.getEmail());
        if (request.getStatus() != null) {
            property.setStatus(request.getStatus());
        }
        if (request.getAmenities() != null) {
            property.setAmenities(request.getAmenities());
        }
        if (request.getCurrency() != null) {
            property.setCurrency(request.getCurrency());
        }
        if (request.getTimezone() != null) {
            property.setTimezone(request.getTimezone());
        }
        if (request.getLandlordPan() != null)
            property.setLandlordPan(request.getLandlordPan());
        if (request.getPgLicenseNo() != null)
            property.setPgLicenseNo(request.getPgLicenseNo());
        if (request.getBankAccountName() != null)
            property.setBankAccountName(request.getBankAccountName());
        if (request.getBankName() != null)
            property.setBankName(request.getBankName());
        if (request.getBankAccountNumber() != null)
            property.setBankAccountNumber(request.getBankAccountNumber());
        if (request.getBankIfsc() != null)
            property.setBankIfsc(request.getBankIfsc());
        if (request.getUpiVpa() != null)
            property.setUpiVpa(request.getUpiVpa());
        if (request.getAuthorizedSignatory() != null)
            property.setAuthorizedSignatory(request.getAuthorizedSignatory());

        Property updated = propertyService.saveProperty(property);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteProperty(@PathVariable UUID id) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Property property;
        if (isSuperAdmin) {
            property = propertyRepository.findById(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            property = propertyRepository.findByIdAndOrganization(id, organization)
                    .orElse(null);
        }

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        // Archive rather than hard-deleting
        property.setStatus("ARCHIVED");
        propertyService.saveProperty(property);

        return ResponseEntity.ok(new MessageResponse("Property successfully archived."));
    }
}
