package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.payload.request.BuildingRequest;
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

import java.util.List;
import java.util.UUID;

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
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    private Building populateBuildingStats(Building b) {
        if (b == null) return null;
        List<Floor> bFloors = floorRepository.findByBuilding(b);
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
            List<Room> fRooms = roomRepository.findByFloor(f);
            totalRooms += fRooms.size();
            for (Room r : fRooms) {
                List<Bed> rBeds = bedRepository.findByRoom(r);
                int rBedCount = rBeds.size();
                if (rBedCount == 0 && r.getSharing() != null && r.getSharing() > 0) {
                    rBedCount = r.getSharing();
                }
                totalBeds += rBedCount;
                for (Bed bed : rBeds) {
                    boolean isOcc = "OCCUPIED".equalsIgnoreCase(bed.getStatus());
                    if (!isOcc && activeTenants != null) {
                        for (Tenant t : activeTenants) {
                            boolean statusOk = t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus());
                            if (statusOk && r.getRoomNumber() != null && r.getRoomNumber().equalsIgnoreCase(t.getRoomNumber())
                                    && bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(t.getBedNumber())) {
                                isOcc = true;
                                break;
                            }
                        }
                    }
                    if (isOcc) occupiedBeds++;
                }
            }
        }
        b.setRooms(totalRooms);
        b.setBeds(totalBeds);
        b.setOccupied(occupiedBeds);
        return b;
    }

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Property getAuthorizedProperty(UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        Property property = propertyRepository.findByIdAndOrganization(propertyId, organization)
                .orElseThrow(() -> new IllegalArgumentException("Property not found or unauthorized"));

        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        if (!isSuperAdmin) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                if (!user.getPropertyIds().contains(propertyId)) {
                    throw new IllegalArgumentException("Property not found or unauthorized");
                }
            }
        }
        return property;
    }

    @PostMapping("/properties/{propertyId}/buildings")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
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
        Building saved = buildingRepository.save(building);
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
        buildings.forEach(this::populateBuildingStats);
        return ResponseEntity.ok(buildings);
    }

    @GetMapping("/buildings")
    public ResponseEntity<?> getFlatBuildings() {
        Organization organization = getLoggedUserOrg();
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        List<Building> buildings;
        if (isSuperAdmin) {
            buildings = buildingRepository.findAll();
        } else {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                buildings = buildingRepository.findByOrganizationId(organization.getId()).stream()
                        .filter(b -> b.getProperty() != null && user.getPropertyIds().contains(b.getProperty().getId()))
                        .collect(Collectors.toList());
            } else {
                buildings = buildingRepository.findByOrganizationId(organization.getId());
            }
        }
        buildings.forEach(this::populateBuildingStats);
        return ResponseEntity.ok(buildings);
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
        Building saved = buildingRepository.save(building);
        return new ResponseEntity<>(populateBuildingStats(saved), HttpStatus.CREATED);
    }

    @PutMapping("/buildings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateFlatBuilding(@PathVariable UUID id, @Valid @RequestBody BuildingRequest request) {
        Organization organization = getLoggedUserOrg();
        Building building = buildingRepository.findById(id).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        if (!building.getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized to update this building."));
        }

        if (!building.getCode().equals(request.getCode()) && 
            buildingRepository.existsByPropertyAndCode(building.getProperty(), request.getCode())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Building code already exists in this property!"));
        }

        building.setName(request.getName());
        building.setCode(request.getCode());
        Building saved = buildingRepository.save(building);
        return ResponseEntity.ok(populateBuildingStats(saved));
    }

    @DeleteMapping("/buildings/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<?> deleteFlatBuilding(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Building building = buildingRepository.findById(id).orElse(null);
        if (building == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Building not found."));
        }

        if (!building.getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized to delete this building."));
        }

        buildingRepository.delete(building);
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

        Building updated = buildingRepository.save(building);
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

        building.setStatus("ARCHIVED");
        buildingRepository.save(building);

        return ResponseEntity.ok(new MessageResponse("Building successfully archived."));
    }
}
