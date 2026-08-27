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
import java.util.stream.Collectors;

import com.stayeaze.backend.payload.response.MinimalPropertyDTO;
import com.stayeaze.backend.payload.response.PropertyDTO;
import com.stayeaze.backend.payload.response.PropertySummaryDTO;
import com.stayeaze.backend.services.PropertyService;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/properties")
public class PropertyController {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(PropertyController.class);

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

    @Autowired
    private com.stayeaze.backend.services.SubscriptionEnforcementService enforcementService;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.services.WebSocketNotificationService webSocketNotificationService;

    @Autowired
    private com.stayeaze.backend.repository.OnboardingLeadRepository onboardingLeadRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private boolean isSuperAdminUser() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return false;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities() != null) {
            boolean hasSuperAdminRole = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") || a.getAuthority().equalsIgnoreCase("SUPER_ADMIN"));
            if (hasSuperAdminRole) return true;
        }
        if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getRoles() != null) {
                return user.getRoles().stream().anyMatch(r -> r.getName() != null && (r.getName().equalsIgnoreCase("SUPER_ADMIN") || r.getName().equalsIgnoreCase("ROLE_SUPER_ADMIN")));
            }
        }
        return false;
    }

    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPropertyStats(@RequestParam(required = false) UUID propertyId) {
        boolean isSuperAdmin = isSuperAdminUser();
        UUID orgId = null;

        if (!isSuperAdmin && propertyId == null) {
            Organization org = getLoggedUserOrg();
            if (org != null) {
                orgId = org.getId();
            }
        }

        Map<String, Object> stats = propertyService.getPropertyOverallStats(propertyId, orgId);
        return ResponseEntity.ok(stats);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    @org.springframework.cache.annotation.CacheEvict(value = "properties-minimal", allEntries = true)
    public ResponseEntity<?> createProperty(@RequestBody Map<String, Object> request) {
        Organization organization = getLoggedUserOrg();
        if (organization == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: User does not belong to an active organization!"));
        }

        String name = (String) request.get("name");
        String code = (String) request.get("code");
        String type = (String) request.get("type");
        String address = (String) request.get("address");
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

        try {
            enforcementService.validatePropertyCreation(organization);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
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
        if (request.get("gstin") != null)
            property.setGstin((String) request.get("gstin"));
        if (request.get("securityDeposit") != null) {
            try {
                property.setSecurityDeposit(new java.math.BigDecimal(request.get("securityDeposit").toString()));
            } catch (Exception ignored) {}
        }
        if (request.get("wifiSsid") != null) {
            property.setWifiSsid(((String) request.get("wifiSsid")).trim());
        }
        if (request.get("wifiPassword") != null) {
            String wp = ((String) request.get("wifiPassword")).trim();
            if (!wp.isBlank() && wp.length() < 8) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Wi-Fi password must be at least 8 characters long."));
            }
            property.setWifiPassword(wp);
        }
        if (request.get("razorpayKeyId") != null)
            property.setRazorpayKeyId(((String) request.get("razorpayKeyId")).trim());
        if (request.get("razorpayKeySecret") != null && !((String) request.get("razorpayKeySecret")).isBlank() && !((String) request.get("razorpayKeySecret")).contains("•"))
            property.setRazorpayKeySecret(((String) request.get("razorpayKeySecret")).trim());

        Property saved = propertyService.saveProperty(property);

        try {
            UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            String targetUserEmail = userDetails.getUsername();
            if (targetUserEmail != null) {
                userRepository.findByEmail(targetUserEmail).ifPresent(u -> {
                    List<UUID> currentIds = u.getPropertyIds() != null ? new ArrayList<>(u.getPropertyIds()) : new ArrayList<>();
                    if (!currentIds.contains(saved.getId())) {
                        currentIds.add(saved.getId());
                        u.setPropertyIds(currentIds);
                        userRepository.save(u);
                    }
                });
            }
        } catch (Exception ignored) {}

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
        boolean isSuperAdmin = isSuperAdminUser();

        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));

        org.springframework.data.domain.Page<PropertyDTO> pageResult;
        if (isSuperAdmin) {
            List<PropertySummaryDTO> superAdminProps = propertyService.getPropertySummariesByOrganization(null);
            int total = superAdminProps.size();
            int fromIndex = Math.min((page - 1) * pageSize, total);
            int toIndex = Math.min(fromIndex + pageSize, total);
            List<PropertySummaryDTO> pageSlice = (fromIndex < total) ? superAdminProps.subList(fromIndex, toIndex) : new ArrayList<>();
            int totalPages = (total == 0) ? 1 : (int) Math.ceil((double) total / pageSize);
            return ResponseEntity.ok(new com.stayeaze.backend.payload.response.PageResponse<>(pageSlice, (long) total, page, pageSize, totalPages));
        } else {
            Organization organization = getLoggedUserOrg();
            List<PropertySummaryDTO> summaries = propertyService.getPropertySummariesByOrganization(organization);

            Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
            if (assignedProps != null) {
                summaries = summaries.stream()
                        .filter(p -> assignedProps.contains(p.getId()))
                        .collect(Collectors.toList());
            }
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(summaries, page, pageSize));
        }
    }

    @GetMapping("/minimal")
    public ResponseEntity<?> getMinimalProperties() {
        boolean isSuperAdmin = securityUtils.isSuperAdmin();

        List<MinimalPropertyDTO> properties;
        if (isSuperAdmin) {
            properties = propertyService.getMinimalPropertiesForSuperAdmin();
        } else {
            Organization org = getLoggedUserOrg();
            if (org != null) {
                List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findMinimalByOrgIdNative(org.getId());
                properties = views != null ? views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList()) : new ArrayList<>();
            } else {
                properties = new ArrayList<>();
            }

            Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
            if (assignedProps != null) {
                properties = properties.stream()
                        .filter(p -> assignedProps.contains(p.getId()))
                        .collect(Collectors.toList());
            }
        }

        return ResponseEntity.ok(properties);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPropertyById(@PathVariable UUID id) {
        boolean isSuperAdmin = isSuperAdminUser();

        Property property;
        if (isSuperAdmin) {
            property = propertyRepository.findByIdSuperAdmin(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            property = propertyRepository.findByIdAndOrganization(id, organization)
                    .orElse(null);
            if (property == null) {
                property = propertyRepository.findById(id).orElse(null);
            }
        }

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        return ResponseEntity.ok(PropertyDTO.fromEntity(propertyService.populatePropertyStats(property)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateProperty(@PathVariable UUID id, @Valid @RequestBody PropertyRequest request) {
        boolean isSuperAdmin = isSuperAdminUser();

        Property property;
        if (isSuperAdmin) {
            property = propertyRepository.findByIdSuperAdmin(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            property = propertyRepository.findByIdAndOrganization(id, organization).orElse(null);
            if (property == null && organization != null) {
                property = propertyRepository.findByIdSuperAdmin(id)
                        .filter(p -> p.getOrganization() != null && p.getOrganization().getId().equals(organization.getId()))
                        .orElse(null);
            }
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
        if (request.getSecurityDeposit() != null) {
            property.setSecurityDeposit(request.getSecurityDeposit());
        }
        if (request.getWifiSsid() != null) {
            property.setWifiSsid(request.getWifiSsid().trim());
        }
        if (request.getWifiPassword() != null) {
            String wp = request.getWifiPassword().trim();
            if (!wp.isBlank() && wp.length() < 8) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Wi-Fi password must be at least 8 characters long."));
            }
            property.setWifiPassword(wp);
        }
        if (request.getWifiNetworksJson() != null) {
            property.setWifiNetworksJson(request.getWifiNetworksJson());
        }
        if (!isSuperAdmin) {
            if (request.getRazorpayKeyId() != null)
                property.setRazorpayKeyId(request.getRazorpayKeyId().trim());
            if (request.getRazorpayKeySecret() != null && !request.getRazorpayKeySecret().isBlank() && !request.getRazorpayKeySecret().contains("•"))
                property.setRazorpayKeySecret(request.getRazorpayKeySecret().trim());
        }

        Property updated = propertyService.saveProperty(property);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/wifi-networks")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updatePropertyWifiNetworks(@PathVariable UUID id, @RequestBody Map<String, Object> payload) {
        boolean isSuperAdmin = isSuperAdminUser();
        Property property;
        if (isSuperAdmin) {
            property = propertyRepository.findByIdSuperAdmin(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            property = propertyRepository.findByIdAndOrganization(id, organization).orElse(null);
            if (property == null && organization != null) {
                property = propertyRepository.findByIdSuperAdmin(id)
                        .filter(p -> p.getOrganization() != null && p.getOrganization().getId().equals(organization.getId()))
                        .orElse(null);
            }
        }

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        if (payload.containsKey("wifiSsid")) {
            property.setWifiSsid(payload.get("wifiSsid") != null ? payload.get("wifiSsid").toString().trim() : null);
        }
        if (payload.containsKey("wifiPassword")) {
            String wp = payload.get("wifiPassword") != null ? payload.get("wifiPassword").toString().trim() : "";
            if (!wp.isBlank() && wp.length() < 8) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Wi-Fi password must be at least 8 characters long."));
            }
            property.setWifiPassword(wp.isBlank() ? null : wp);
        }
        if (payload.containsKey("wifiNetworksJson")) {
            property.setWifiNetworksJson(payload.get("wifiNetworksJson") != null ? payload.get("wifiNetworksJson").toString() : null);
        }

        Property updated = propertyService.saveProperty(property);
        return ResponseEntity.ok(PropertyDTO.fromEntity(propertyService.populatePropertyStats(updated)));
    }

    @GetMapping("/{id}/pre-delete-summary")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('ADMIN')")
    public ResponseEntity<?> getPropertyPreDeleteSummary(@PathVariable UUID id) {
        boolean isSuperAdmin = isSuperAdminUser();
        Organization organization = getLoggedUserOrg();
        Property property = isSuperAdmin ? propertyRepository.findByIdSuperAdmin(id).orElse(null)
                : propertyRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        Map<String, Object> summary = propertyService.getPropertyPreDeleteSummary(id, organization);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/{id}/export-snapshot")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('ADMIN')")
    public ResponseEntity<?> exportPropertySnapshot(@PathVariable UUID id) {
        boolean isSuperAdmin = isSuperAdminUser();
        Organization organization = getLoggedUserOrg();
        Property property = isSuperAdmin ? propertyRepository.findByIdSuperAdmin(id).orElse(null)
                : propertyRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        Map<String, Object> snapshot = propertyService.exportPropertySnapshot(id, organization);
        return ResponseEntity.ok(snapshot);
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('ADMIN')")
    public ResponseEntity<?> archivePropertyEndpoint(@PathVariable UUID id) {
        return handleArchive(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('ADMIN')")
    public ResponseEntity<?> deleteProperty(@PathVariable UUID id) {
        return handleArchive(id);
    }

    private ResponseEntity<?> handleArchive(UUID id) {
        boolean isSuperAdmin = isSuperAdminUser();
        Organization organization = getLoggedUserOrg();
        Property property = isSuperAdmin ? propertyRepository.findByIdSuperAdmin(id).orElse(null)
                : propertyRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        propertyService.archivePropertyCascade(id, organization);
        return ResponseEntity.ok(new MessageResponse("Property and its spaces successfully archived."));
    }

    @PutMapping("/{id}/restore")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('ADMIN')")
    public ResponseEntity<?> restoreProperty(@PathVariable UUID id) {
        boolean isSuperAdmin = isSuperAdminUser();
        Organization organization = getLoggedUserOrg();
        Property property = isSuperAdmin ? propertyRepository.findByIdSuperAdmin(id).orElse(null)
                : propertyRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        propertyService.restorePropertyCascade(id, organization);
        return ResponseEntity.ok(new MessageResponse("Property and spaces successfully restored to active."));
    }

    @DeleteMapping("/{id}/permanent")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('ADMIN')")
    public ResponseEntity<?> permanentPurgeProperty(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "false") boolean autoArchiveTenants) {
        boolean isSuperAdmin = isSuperAdminUser();
        Organization organization = getLoggedUserOrg();
        Property property = isSuperAdmin ? propertyRepository.findByIdSuperAdmin(id).orElse(null)
                : propertyRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Property not found or unauthorized."));
        }

        try {
            propertyService.permanentPurgeProperty(id, organization, autoArchiveTenants);
            return ResponseEntity.ok(new MessageResponse("Property and all associated assets successfully purged permanently."));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new MessageResponse(ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error during property purge: " + ex.getMessage()));
        }
    }
}
