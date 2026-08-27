package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.FloorRequest;
import com.stayeaze.backend.payload.response.FloorDTO;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.BuildingRepository;
import com.stayeaze.backend.repository.FloorRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoomRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.TenantRepository;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class FloorController {

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private com.stayeaze.backend.services.FloorService floorService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    private Floor populateFloorStats(Floor f) {
        if (f == null) return null;
        List<Room> rooms = roomRepository.findByFloor(f);
        f.setRooms(rooms.size());
        int totalBeds = 0, occupiedBeds = 0;

        List<Tenant> activeTenants = null;
        try {
            Organization org = getLoggedUserOrg();
            activeTenants = tenantRepository.findByOrganization(org);
        } catch (Exception ignored) {}

        for (Room r : rooms) {
            List<Bed> beds = bedRepository.findByRoom(r);
            int rBedCount = beds.size();
            if (rBedCount == 0 && r.getSharing() != null && r.getSharing() > 0) {
                rBedCount = r.getSharing();
            }
            totalBeds += rBedCount;
            for (Bed b : beds) {
                boolean isOcc = "OCCUPIED".equalsIgnoreCase(b.getStatus());
                if (!isOcc && activeTenants != null) {
                    for (Tenant t : activeTenants) {
                        boolean statusOk = t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus());
                        if (statusOk && r.getRoomNumber() != null && r.getRoomNumber().equalsIgnoreCase(t.getRoomNumber())
                                && b.getBedNumber() != null && b.getBedNumber().equalsIgnoreCase(t.getBedNumber())) {
                            isOcc = true;
                            break;
                        }
                    }
                }
                if (isOcc) occupiedBeds++;
            }
        }
        f.setBeds(totalBeds);
        f.setOccupied(occupiedBeds);
        return f;
    }

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElse(null);
    }

    private Building getAuthorizedBuilding(UUID propertyId, UUID buildingId) {
        securityUtils.validatePropertyAccess(propertyId);
        Organization organization = getLoggedUserOrg();
        Property property = propertyRepository.findByIdAndOrganization(propertyId, organization)
                .orElseThrow(() -> new IllegalArgumentException("Property not found or unauthorized"));
        return buildingRepository.findByIdAndProperty(buildingId, property)
                .orElseThrow(() -> new IllegalArgumentException("Building not found or unauthorized"));
    }

    @PostMapping("/properties/{propertyId}/buildings/{buildingId}/floors")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createFloor(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @Valid @RequestBody FloorRequest request) {
        Building building;
        try {
            building = getAuthorizedBuilding(propertyId, buildingId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        if (floorRepository.existsByBuildingAndFloorNumber(building, request.getFloorNumber())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Floor number already exists in this building!"));
        }

        Floor floor = new Floor(building, request.getFloorNumber(), request.getName());
        Floor saved = floorService.saveFloor(floor);
        return new ResponseEntity<>(populateFloorStats(saved), HttpStatus.CREATED);
    }

    @GetMapping("/properties/{propertyId}/buildings/{buildingId}/floors")
    public ResponseEntity<?> getAllFloors(@PathVariable UUID propertyId, @PathVariable UUID buildingId) {
        Building building;
        try {
            building = getAuthorizedBuilding(propertyId, buildingId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        List<FloorDTO> dtos = floorService.getFloorsByBuilding(building);
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/floors")
    public ResponseEntity<?> getFlatFloors(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<com.stayeaze.backend.payload.response.FloorDTO> all = floorService.getFloorsByOrg(organization);
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            all = all.stream().filter(f -> f.getPropertyId() != null && assignedProps.contains(f.getPropertyId())).collect(java.util.stream.Collectors.toList());
        }
        if (propertyId != null) {
            all = all.stream().filter(f -> propertyId.equals(f.getPropertyId())).collect(java.util.stream.Collectors.toList());
        }
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(all, page, pageSize));
    }

    @GetMapping("/properties/{propertyId}/all-floors")
    public ResponseEntity<?> getAllFloorsForProperty(@PathVariable UUID propertyId) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Property not found"));
        }
        List<Building> buildings = buildingRepository.findByProperty(property);
        List<FloorDTO> floorDTOs = new ArrayList<>();
        for (Building b : buildings) {
            List<Floor> floors = floorRepository.findByBuilding(b);
            for (Floor f : floors) {
                FloorDTO dto = FloorDTO.fromEntity(f);
                dto.setPropertyId(property.getId());
                dto.setPropertyName(property.getName());
                dto.setBuildingId(b.getId());
                dto.setBuildingName(b.getName());
                floorDTOs.add(dto);
            }
        }
        return ResponseEntity.ok(floorDTOs);
    }

    @DeleteMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteFloor(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID id) {
        Building building;
        try {
            building = getAuthorizedBuilding(propertyId, buildingId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Floor floor = floorRepository.findByIdAndBuilding(id, building).orElse(null);
        if (floor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found in this building."));
        }

        archiveFloorCascade(floor);
        return ResponseEntity.ok(new MessageResponse("Floor successfully archived."));
    }

    private boolean isSuperAdminUser() {
        if (SecurityContextHolder.getContext().getAuthentication() == null) return false;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities() != null) {
            boolean hasSuperAdminRole = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") || a.getAuthority().equalsIgnoreCase("SUPER_ADMIN"));
            if (hasSuperAdminRole) return true;
        }
        return false;
    }

    private boolean isBuildingAuthorizedForUser(Building building) {
        if (building == null || building.getId() == null) return false;
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

    private boolean isFloorAuthorizedForUser(Floor floor) {
        if (floor == null) return false;
        if (isSuperAdminUser()) return true;
        try {
            UUID bldgId = floorRepository.findBuildingIdByFloorId(floor.getId());
            if (bldgId != null) {
                Building b = buildingRepository.findById(bldgId).orElse(new Building());
                if (b.getId() == null) b.setId(bldgId);
                return isBuildingAuthorizedForUser(b);
            }
        } catch (Exception ignored) {}
        return false;
    }

    @PostMapping("/floors")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createFlatFloor(@RequestBody FloorRequest request) {
        if (request.getBuildingId() == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: buildingId is required!"));
        }
        Building building = buildingRepository.findById(request.getBuildingId()).orElse(null);
        if (building == null || !isBuildingAuthorizedForUser(building)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Building not found or unauthorized"));
        }
        if (request.getPropertyId() != null && building.getProperty() != null && !building.getProperty().getId().equals(request.getPropertyId())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Specified building does not belong to the selected property!"));
        }

        // Use provided floorNumber, or derive from name, or auto-increment
        Integer floorNum = request.getFloorNumber();
        if (floorNum == null && request.getName() != null) {
            // try to parse floor number from name like "Floor 1" -> 1
            try { floorNum = Integer.parseInt(request.getName().replaceAll("[^0-9]", "")); } catch (Exception ignored) {}
        }
        if (floorNum == null) {
            floorNum = floorRepository.findByBuilding(building).size() + 1;
        }

        if (floorRepository.existsByBuildingAndFloorNumber(building, floorNum)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Floor number already exists in this building!"));
        }

        Floor floor = new Floor(building, floorNum, request.getName());
        Floor saved = floorService.saveFloor(floor);
        return new ResponseEntity<>(populateFloorStats(saved), HttpStatus.CREATED);
    }

    @GetMapping("/floors/{id}")
    public ResponseEntity<?> getFlatFloorById(@PathVariable UUID id) {
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || !isFloorAuthorizedForUser(floor)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        return ResponseEntity.ok(populateFloorStats(floor));
    }

    @PutMapping("/floors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateFlatFloor(@PathVariable UUID id, @RequestBody FloorRequest request) {
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || !isFloorAuthorizedForUser(floor)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        if (request.getFloorNumber() != null) {
            floor.setFloorNumber(request.getFloorNumber());
        }
        if (request.getName() != null && !request.getName().isBlank()) {
            floor.setName(request.getName().trim());
        }
        Floor saved = floorService.saveFloor(floor);
        return ResponseEntity.ok(populateFloorStats(saved));
    }

    @DeleteMapping("/floors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteFlatFloor(@PathVariable UUID id) {
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || !isFloorAuthorizedForUser(floor)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        archiveFloorCascade(floor);
        return ResponseEntity.ok(new MessageResponse("Floor deleted successfully."));
    }

    private Building getBuildingForFloor(Floor floor) {
        if (floor == null) return null;
        try {
            UUID bldgId = floorRepository.findBuildingIdByFloorId(floor.getId());
            if (bldgId != null) {
                return buildingRepository.findById(bldgId).orElse(null);
            }
        } catch (Exception ignored) {}
        try {
            return floor.getBuilding();
        } catch (Exception ignored) {}
        return null;
    }

    private void archiveFloorCascade(Floor floor) {
        if (floor == null) return;
        floor.setStatus("ARCHIVED");
        try { floorService.saveFloor(floor); } catch (Exception ignored) {}

        try {
            List<Room> rooms = roomRepository.findByFloor(floor);
            for (Room r : rooms) {
                r.setStatus("ARCHIVED");
                roomRepository.save(r);

                List<Bed> beds = bedRepository.findByRoom(r);
                for (Bed b : beds) {
                    b.setStatus("ARCHIVED");
                    bedRepository.save(b);
                }
            }
        } catch (Exception ignored) {}

        Building building = getBuildingForFloor(floor);
        if (building != null) {
            try {
                List<Floor> activeFloors = floorRepository.findByBuilding(building).stream()
                        .filter(f -> f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus()))
                        .collect(java.util.stream.Collectors.toList());

                int bldRooms = 0, bldBeds = 0, bldOcc = 0;
                for (Floor f : activeFloors) {
                    List<Room> fRooms = roomRepository.findByFloor(f).stream()
                            .filter(r -> r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus()))
                            .collect(java.util.stream.Collectors.toList());
                    bldRooms += fRooms.size();
                    for (Room r : fRooms) {
                        List<Bed> rBeds = bedRepository.findByRoom(r).stream()
                                .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                                .collect(java.util.stream.Collectors.toList());
                        bldBeds += rBeds.size();
                        bldOcc += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                    }
                }
                building.setRooms(bldRooms);
                building.setBeds(bldBeds);
                building.setOccupied(bldOcc);
                buildingRepository.save(building);
            } catch (Exception ignored) {}
        }

        try { floorService.evictCaches(); } catch (Exception ignored) {}
    }

    @PutMapping("/floors/{id}/unarchive")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> unarchiveFlatFloor(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || (organization != null && floor.getBuilding() != null && floor.getBuilding().getProperty() != null && floor.getBuilding().getProperty().getOrganization() != null && !floor.getBuilding().getProperty().getOrganization().getId().equals(organization.getId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        unarchiveFloorCascade(floor);
        return ResponseEntity.ok(new MessageResponse("Floor and all nested rooms/beds successfully unarchived."));
    }

    @PutMapping("/properties/{propertyId}/buildings/{buildingId}/floors/{id}/unarchive")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> unarchiveFloor(@PathVariable UUID propertyId, @PathVariable UUID buildingId, @PathVariable UUID id) {
        Building building;
        try {
            building = getAuthorizedBuilding(propertyId, buildingId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse(e.getMessage()));
        }

        Floor floor = floorRepository.findByIdAndBuilding(id, building).orElse(null);
        if (floor == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found in this building."));
        }

        unarchiveFloorCascade(floor);
        return ResponseEntity.ok(new MessageResponse("Floor and all nested rooms/beds successfully unarchived."));
    }

    private void unarchiveFloorCascade(Floor floor) {
        if (floor == null) return;
        floor.setStatus("AVAILABLE");
        floorService.saveFloor(floor);

        List<Room> rooms = roomRepository.findByFloor(floor);
        for (Room r : rooms) {
            if ("ARCHIVED".equalsIgnoreCase(r.getStatus())) {
                r.setStatus("available");
                roomRepository.save(r);
            }

            List<Bed> beds = bedRepository.findByRoom(r);
            for (Bed b : beds) {
                if ("ARCHIVED".equalsIgnoreCase(b.getStatus())) {
                    b.setStatus("AVAILABLE");
                    bedRepository.save(b);
                }
            }
        }

        if (floor.getBuilding() != null) {
            Building building = floor.getBuilding();
            if ("ARCHIVED".equalsIgnoreCase(building.getStatus())) {
                building.setStatus("ACTIVE");
                buildingRepository.save(building);
            }
            List<Floor> activeFloors = floorRepository.findByBuilding(building).stream()
                    .filter(f -> f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus()))
                    .collect(java.util.stream.Collectors.toList());

            int bldRooms = 0, bldBeds = 0, bldOcc = 0;
            for (Floor f : activeFloors) {
                List<Room> fRooms = roomRepository.findByFloor(f).stream()
                        .filter(r -> r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus()))
                        .collect(java.util.stream.Collectors.toList());
                bldRooms += fRooms.size();
                for (Room r : fRooms) {
                    List<Bed> rBeds = bedRepository.findByRoom(r).stream()
                            .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                            .collect(java.util.stream.Collectors.toList());
                    bldBeds += rBeds.size();
                    bldOcc += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                }
            }
            building.setRooms(bldRooms);
            building.setBeds(bldBeds);
            building.setOccupied(bldOcc);
            buildingRepository.save(building);

            Property property = building.getProperty();
            if (property != null) {
                List<Building> pBuildings = buildingRepository.findByProperty(property);
                int propRooms = pBuildings.stream().mapToInt(Building::getRooms).sum();
                int propBeds = pBuildings.stream().mapToInt(Building::getBeds).sum();
                int propOcc = pBuildings.stream().mapToInt(Building::getOccupied).sum();
                property.setTotalRooms(propRooms);
                property.setTotalBeds(propBeds);
                property.setOccupiedBeds(propOcc);
                propertyRepository.save(property);
            }
        }

        floorService.evictCaches();
    }
}
