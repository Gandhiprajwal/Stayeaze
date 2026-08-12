package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.payload.request.FloorRequest;
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

import java.util.List;
import java.util.UUID;

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

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        if (userDetails.getOrgId() == null) return null;
        return organizationRepository.findById(userDetails.getOrgId()).orElse(null);
    }

    private Building getAuthorizedBuilding(UUID propertyId, UUID buildingId) {
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

        Floor floor = new Floor(building, request.getFloorNumber());
        Floor saved = floorRepository.save(floor);
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

        List<Floor> floors = floorRepository.findByBuilding(building);
        floors.forEach(this::populateFloorStats);
        return ResponseEntity.ok(floors);
    }

    @GetMapping("/floors")
    public ResponseEntity<?> getFlatFloors(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = null;
        try { organization = getLoggedUserOrg(); } catch (Exception ignored) {}
        List<com.stayeaze.backend.payload.response.FloorDTO> all = floorService.getFloorsByOrg(organization);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(all, page, pageSize));
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

    @PostMapping("/floors")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> createFlatFloor(@RequestBody FloorRequest request) {
        if (request.getBuildingId() == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: buildingId is required!"));
        }
        Organization organization = getLoggedUserOrg();
        Building building = buildingRepository.findById(request.getBuildingId()).orElse(null);
        if (building == null || !building.getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Building not found or unauthorized"));
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

        Floor floor = new Floor(building, floorNum);
        Floor saved = floorService.saveFloor(floor);
        return new ResponseEntity<>(populateFloorStats(saved), HttpStatus.CREATED);
    }

    @GetMapping("/floors/{id}")
    public ResponseEntity<?> getFlatFloorById(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || !floor.getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        return ResponseEntity.ok(populateFloorStats(floor));
    }

    @PutMapping("/floors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateFlatFloor(@PathVariable UUID id, @RequestBody FloorRequest request) {
        Organization organization = getLoggedUserOrg();
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || !floor.getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        if (request.getFloorNumber() != null) {
            floor.setFloorNumber(request.getFloorNumber());
        }
        Floor saved = floorService.saveFloor(floor);
        return ResponseEntity.ok(populateFloorStats(saved));
    }

    @DeleteMapping("/floors/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteFlatFloor(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Floor floor = floorRepository.findById(id).orElse(null);
        if (floor == null || !floor.getBuilding().getProperty().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Floor not found."));
        }
        archiveFloorCascade(floor);
        return ResponseEntity.ok(new MessageResponse("Floor deleted successfully."));
    }

    private void archiveFloorCascade(Floor floor) {
        if (floor == null) return;
        floor.setStatus("ARCHIVED");
        floorService.saveFloor(floor);

        List<Room> rooms = roomRepository.findByFloor(floor);
        for (Room r : rooms) {
            r.setStatus("ARCHIVED");
            roomRepository.save(r);

            List<Bed> beds = bedRepository.findByRoom(r);
            for (Bed b : beds) {
                b.setStatus("ARCHIVED");
                bedRepository.save(b);

                if (r.getRoomNumber() != null && b.getBedNumber() != null) {
                    List<Tenant> tenants = tenantRepository.findAll();
                    for (Tenant t : tenants) {
                        if (r.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                            b.getBedNumber().equalsIgnoreCase(t.getBedNumber()) &&
                            (t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()))) {
                            t.setStatus("INACTIVE");
                            tenantRepository.save(t);
                        }
                    }
                }
            }
        }

        if (floor.getBuilding() != null) {
            Building building = floor.getBuilding();
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
