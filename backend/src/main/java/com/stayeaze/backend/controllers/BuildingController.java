package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.payload.request.BuildingRequest;
import com.stayeaze.backend.payload.response.BuildingDTO;
import com.stayeaze.backend.payload.response.MinimalBuildingDTO;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.BuildingRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.repository.FloorRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.TenantRepository;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class BuildingController {

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.stayeaze.backend.services.BuildingService buildingService;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Building populateBuildingStats(Building b) {
        if (b == null) return null;
        List<Floor> bFloors = floorRepository.findByBuildingId(b.getId());
        b.setFloors(bFloors.size());

        int totalRooms = 0;
        int totalBeds = 0;
        int occupiedBeds = 0;

        List<Tenant> activeTenants = null;
        try {
            Organization org = getLoggedUserOrg();
            activeTenants = tenantRepository.findByOrganization(org);
        } catch (Exception ignored) {}

        for (Floor f : bFloors) {
            List<Room> fRooms = roomRepository.findByFloorId(f.getId());
            totalRooms += fRooms.size();
            for (Room r : fRooms) {
                List<Bed> rBeds = bedRepository.findByRoomId(r.getId());
                int rBedCount = rBeds.size();
                if (rBedCount == 0 && r.getSharing() != null && r.getSharing() > 0) {
                    rBedCount = r.getSharing();
                }
                totalBeds += rBedCount;
                if (activeTenants != null) {
                    String rNum = r.getRoomNumber();
                    occupiedBeds += (int) activeTenants.stream().filter(t -> {
                        String ts = t.getStatus();
                        boolean isOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
                        return !isOut && rNum != null && rNum.equalsIgnoreCase(t.getRoomNumber());
                    }).count();
                }
            }
        }
        b.setRooms(totalRooms);
        b.setBeds(totalBeds);
        b.setOccupied(occupiedBeds);
        return b;
    }

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

    private Property getAuthorizedProperty(UUID propertyId) {
        boolean isSuperAdmin = isSuperAdminUser();
        if (isSuperAdmin) {
            return propertyRepository.findByIdSuperAdmin(propertyId)
                    .orElseThrow(() -> new IllegalArgumentException("Property not found"));
        }

        Organization organization = getLoggedUserOrg();
        Property property = propertyRepository.findByIdAndOrganization(propertyId, organization)
                .orElseGet(() -> propertyRepository.findById(propertyId).orElse(null));
        if (property == null) {
            throw new IllegalArgumentException("Property not found or unauthorized");
        }

        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
            if (!user.getPropertyIds().contains(propertyId)) {
                throw new IllegalArgumentException("Property not found or unauthorized");
            }
        }
        return property;
    }

    @PostMapping("/properties/{propertyId}/buildings")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createBuilding(@PathVariable UUID propertyId, @Valid @RequestBody BuildingRequest request) {
        Property property;
        try {
            property = getAuthorizedProperty(propertyId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        if (buildingRepository.existsByPropertyAndCode(property, request.getCode())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Building code already exists in this property!"));
        }

        Building building = new Building(property, request.getName(), request.getCode());
        Building saved = buildingService.saveBuilding(building);
        return new ResponseEntity<>(populateBuildingStats(saved), HttpStatus.CREATED);
    }

    @GetMapping("/properties/{propertyId}/buildings")
    public ResponseEntity<?> getAllBuildings(@PathVariable UUID propertyId) {
        Property property;
        try {
            property = getAuthorizedProperty(propertyId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<Building> buildings = buildingRepository.findByProperty(property);
        try {
            List<Object[]> rows = buildingRepository.getMetricsByBuildingForPropertyNative(property.getId());
            Map<UUID, int[]> metricMap = new HashMap<>();
            if (rows != null) {
                for (Object[] r : rows) {
                    if (r == null || r[0] == null) continue;
                    UUID bId = UUID.fromString(r[0].toString());
                    int flrs = r[1] != null ? ((Number) r[1]).intValue() : 0;
                    int rms = r[2] != null ? ((Number) r[2]).intValue() : 0;
                    int bds = r[3] != null ? ((Number) r[3]).intValue() : 0;
                    int occ = r[4] != null ? ((Number) r[4]).intValue() : 0;
                    metricMap.put(bId, new int[]{flrs, rms, bds, occ});
                }
            }
            for (Building b : buildings) {
                int[] m = metricMap.get(b.getId());
                if (m != null) {
                    b.setFloors(m[0]);
                    b.setRooms(m[1]);
                    b.setBeds(m[2]);
                    b.setOccupied(m[3]);
                } else {
                    populateBuildingStats(b);
                }
            }
        } catch (Exception e) {
            buildings.forEach(this::populateBuildingStats);
        }
        List<BuildingDTO> dtos = buildings.stream().map(BuildingDTO::fromEntity).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/buildings/minimal")
    public ResponseEntity<List<MinimalBuildingDTO>> getMinimalBuildings(@RequestParam(required = false) UUID propertyId) {
        boolean isSuperAdmin = securityUtils.isSuperAdmin();
        Organization organization = !isSuperAdmin ? getLoggedUserOrg() : null;
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();

        List<Building> buildings;
        if (propertyId != null) {
            buildings = buildingRepository.findByPropertyId(propertyId);
        } else if (isSuperAdmin || organization == null) {
            buildings = buildingRepository.findAll();
        } else {
            buildings = buildingRepository.findByOrganizationId(organization.getId());
        }

        List<MinimalBuildingDTO> dtos = buildings.stream()
                .filter(b -> b.getProperty() != null)
                .filter(b -> assignedProps == null || assignedProps.contains(b.getProperty().getId()))
                .filter(b -> propertyId == null || propertyId.equals(b.getProperty().getId()))
                .map(MinimalBuildingDTO::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/buildings")
    public ResponseEntity<?> getFlatBuildings(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        boolean isSuperAdmin = securityUtils.isSuperAdmin();
        Organization organization = !isSuperAdmin ? getLoggedUserOrg() : null;

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (organization != null && (assignedProps != null || propertyId != null)) {
            List<Building> buildings = buildingRepository.findByOrganizationId(organization.getId()).stream()
                    .filter(b -> b.getProperty() != null)
                    .filter(b -> assignedProps == null || assignedProps.contains(b.getProperty().getId()))
                    .filter(b -> propertyId == null || propertyId.equals(b.getProperty().getId()))
                    .collect(Collectors.toList());
            buildings.forEach(this::populateBuildingStats);
            List<BuildingDTO> dtos = buildings.stream().map(BuildingDTO::fromEntity).collect(Collectors.toList());
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(dtos, page, pageSize));
        }

        // Use cached service for standard org/superAdmin queries
        List<BuildingDTO> all = (isSuperAdmin || organization == null)
                ? buildingService.getAllBuildings()
                : buildingService.getBuildingsByOrg(organization);

        if (propertyId != null) {
            all = all.stream().filter(b -> propertyId.equals(b.getPropertyId())).collect(Collectors.toList());
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(all, page, pageSize));
    }

    @PostMapping("/buildings")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createFlatBuilding(@Valid @RequestBody BuildingRequest request) {
        if (request.getPropertyId() == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: propertyId is required!"));
        }
        Property property;
        try {
            property = getAuthorizedProperty(request.getPropertyId());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        if (buildingRepository.existsByPropertyAndCode(property, request.getCode())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Building code already exists in this property!"));
        }

        Building building = new Building(property, request.getName(), request.getCode());
        Building saved = buildingService.saveBuilding(building);
        return new ResponseEntity<>(populateBuildingStats(saved), HttpStatus.CREATED);
    }

    private boolean isBuildingAuthorizedForUser(Building building) {
        if (building == null) return false;
        if (isSuperAdminUser()) return true;
        try {
            Organization organization = getLoggedUserOrg();
            if (organization == null) return false;
            UUID propId = buildingRepository.findPropertyIdByBuildingId(building.getId());
            if (propId != null) {
                Property prop = propertyRepository.findByIdSuperAdmin(propId).orElse(null);
                if (prop != null && prop.getOrganization() != null) {
                    return prop.getOrganization().getId().equals(organization.getId());
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    @PutMapping("/buildings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateFlatBuilding(@PathVariable UUID id, @Valid @RequestBody BuildingRequest request) {
        Building building = buildingRepository.findById(id).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        if (!isBuildingAuthorizedForUser(building)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized to update this building."));
        }

        try {
            if (!building.getCode().equals(request.getCode()) && 
                building.getProperty() != null &&
                buildingRepository.existsByPropertyAndCode(building.getProperty(), request.getCode())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Building code already exists in this property!"));
            }
        } catch (Exception ignored) {}

        building.setName(request.getName());
        building.setCode(request.getCode());
        Building saved = buildingService.saveBuilding(building);
        return ResponseEntity.ok(populateBuildingStats(saved));
    }

    @DeleteMapping("/buildings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteFlatBuilding(@PathVariable UUID id) {
        Building building = buildingRepository.findById(id).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        if (!isBuildingAuthorizedForUser(building)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized to delete this building."));
        }

        archiveBuildingCascade(building);
        return ResponseEntity.ok(new MessageResponse("Building deleted successfully."));
    }

    @GetMapping("/properties/{propertyId}/buildings/{id}")
    public ResponseEntity<?> getBuildingById(@PathVariable UUID propertyId, @PathVariable UUID id) {
        Property property;
        try {
            property = getAuthorizedProperty(propertyId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Building building = buildingRepository.findByIdAndProperty(id, property).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found in this property."));
        }

        return ResponseEntity.ok(populateBuildingStats(building));
    }

    @PutMapping("/properties/{propertyId}/buildings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateBuilding(@PathVariable UUID propertyId, @PathVariable UUID id, @Valid @RequestBody BuildingRequest request) {
        Property property;
        try {
            property = getAuthorizedProperty(propertyId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Building building = buildingRepository.findByIdAndProperty(id, property).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        // Check if code has changed and if the new code exists
        if (!building.getCode().equals(request.getCode()) && buildingRepository.existsByPropertyAndCode(property, request.getCode())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Building code already exists in this property!"));
        }

        building.setName(request.getName());
        building.setCode(request.getCode());

        Building updated = buildingService.saveBuilding(building);
        return ResponseEntity.ok(populateBuildingStats(updated));
    }

    @DeleteMapping("/properties/{propertyId}/buildings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteBuilding(@PathVariable UUID propertyId, @PathVariable UUID id) {
        Property property;
        try {
            property = getAuthorizedProperty(propertyId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Building building = buildingRepository.findByIdAndProperty(id, property).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        archiveBuildingCascade(building);
        return ResponseEntity.ok(new MessageResponse("Building successfully archived."));
    }

    @org.springframework.transaction.annotation.Transactional
    protected void archiveBuildingCascade(Building building) {
        if (building == null) return;
        building.setStatus("ARCHIVED");
        buildingService.saveBuilding(building);

        try {
            List<Floor> floors = floorRepository.findByBuilding(building);
            for (Floor f : floors) {
                f.setStatus("ARCHIVED");
                floorRepository.save(f);

                List<Room> rooms = roomRepository.findByFloor(f);
                for (Room r : rooms) {
                    r.setStatus("ARCHIVED");
                    roomRepository.save(r);

                    List<Bed> beds = bedRepository.findByRoom(r);
                    for (Bed b : beds) {
                        b.setStatus("ARCHIVED");
                        bedRepository.save(b);
                    }
                }
            }
        } catch (Exception ignored) {}

        try {
            UUID propId = buildingRepository.findPropertyIdByBuildingId(building.getId());
            if (propId != null) {
                Property property = propertyRepository.findByIdSuperAdmin(propId).orElse(null);
                if (property != null) {
                    List<Building> activeBuildings = buildingRepository.findByProperty(property).stream()
                            .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                            .collect(Collectors.toList());

                    int propRooms = activeBuildings.stream().mapToInt(Building::getRooms).sum();
                    int propBeds = activeBuildings.stream().mapToInt(Building::getBeds).sum();
                    int propOcc = activeBuildings.stream().mapToInt(Building::getOccupied).sum();

                    property.setTotalBuildings(activeBuildings.size());
                    property.setTotalRooms(propRooms);
                    property.setTotalBeds(propBeds);
                    property.setOccupiedBeds(propOcc);
                    propertyRepository.save(property);
                }
            }
        } catch (Exception ignored) {}
    }

    @PutMapping("/buildings/{id}/unarchive")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> unarchiveFlatBuilding(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Building building = buildingRepository.findById(id).orElse(null);
        if (building == null || (organization != null && building.getProperty() != null && building.getProperty().getOrganization() != null && !building.getProperty().getOrganization().getId().equals(organization.getId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }
        unarchiveBuildingCascade(building);
        return ResponseEntity.ok(new MessageResponse("Building and all nested floors/rooms/beds successfully unarchived."));
    }

    @PutMapping("/properties/{propertyId}/buildings/{id}/unarchive")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> unarchiveBuilding(@PathVariable UUID propertyId, @PathVariable UUID id) {
        Property property;
        try {
            property = getAuthorizedProperty(propertyId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Building building = buildingRepository.findByIdAndProperty(id, property).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        unarchiveBuildingCascade(building);
        return ResponseEntity.ok(new MessageResponse("Building successfully unarchived."));
    }

    private void unarchiveBuildingCascade(Building building) {
        if (building == null) return;
        building.setStatus("ACTIVE");
        buildingService.saveBuilding(building);

        List<Floor> floors = floorRepository.findByBuilding(building);
        for (Floor f : floors) {
            f.setStatus("AVAILABLE");
            floorRepository.save(f);

            List<Room> rooms = roomRepository.findByFloor(f);
            for (Room r : rooms) {
                r.setStatus("available");
                roomRepository.save(r);

                List<Bed> beds = bedRepository.findByRoom(r);
                for (Bed b : beds) {
                    b.setStatus("AVAILABLE");
                    bedRepository.save(b);
                }
            }
        }

        Property property = building.getProperty();
        if (property != null) {
            List<Building> activeBuildings = buildingRepository.findByProperty(property).stream()
                    .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                    .collect(Collectors.toList());

            int propRooms = activeBuildings.stream().mapToInt(Building::getRooms).sum();
            int propBeds = activeBuildings.stream().mapToInt(Building::getBeds).sum();
            int propOcc = activeBuildings.stream().mapToInt(Building::getOccupied).sum();

            property.setTotalBuildings(activeBuildings.size());
            property.setTotalRooms(propRooms);
            property.setTotalBeds(propBeds);
            property.setOccupiedBeds(propOcc);
            propertyRepository.save(property);
        }

        buildingService.saveBuilding(building);
    }
}
