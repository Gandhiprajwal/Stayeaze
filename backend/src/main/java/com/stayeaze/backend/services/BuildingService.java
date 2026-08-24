package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.BuildingDTO;
import com.stayeaze.backend.repository.BuildingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BuildingService {

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private com.stayeaze.backend.repository.FloorRepository floorRepository;

    @Autowired
    private com.stayeaze.backend.repository.RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.repository.BedRepository bedRepository;

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    private Building populateBuildingStats(Building b, Organization organization) {
        if (b == null) return null;
        List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuildingId(b.getId());
        b.setFloors(floors.size());

        int totalRooms = 0;
        int totalBeds = 0;
        int occupiedBeds = 0;

        List<com.stayeaze.backend.models.Tenant> activeTenants = null;
        try {
            activeTenants = organization != null ? tenantRepository.findByOrganization(organization) : tenantRepository.findAll();
        } catch (Exception ignored) {}

        for (com.stayeaze.backend.models.Floor f : floors) {
            List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloorId(f.getId());
            totalRooms += rooms.size();

            for (com.stayeaze.backend.models.Room r : rooms) {
                List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoomId(r.getId());
                int rBedCount = beds.size();
                if (rBedCount == 0 && r.getSharing() != null && r.getSharing() > 0) {
                    rBedCount = r.getSharing();
                }
                totalBeds += rBedCount;

                for (com.stayeaze.backend.models.Bed bed : beds) {
                    boolean isOcc = "OCCUPIED".equalsIgnoreCase(bed.getStatus());
                    if (!isOcc && activeTenants != null) {
                        for (com.stayeaze.backend.models.Tenant t : activeTenants) {
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

    /**
     * Returns all BuildingDTOs for the given org, cached by orgId.
     * Pagination is applied at the controller/PageResponse level after retrieval.
     * Note: PageImpl is not JSON-serializable by Redis; caching flat lists is the correct pattern.
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "buildings", key = "#organization != null ? #organization.id.toString() : 'all_super_admin'")
    public List<BuildingDTO> getBuildingsByOrg(Organization organization) {
        if (organization == null) {
            return getAllBuildings();
        }
        return buildingRepository.findByOrganizationId(organization.getId()).stream()
                .map(b -> BuildingDTO.fromEntity(populateBuildingStats(b, organization)))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "buildings", key = "'all_super_admin'")
    public List<BuildingDTO> getAllBuildings() {
        List<Building> buildings = buildingRepository.findAllSuperAdmin();
        if (buildings == null) return java.util.Collections.emptyList();
        return buildings.stream()
                .map(b -> BuildingDTO.fromEntity(populateBuildingStats(b, null)))
                .collect(Collectors.toList());
    }

    @Caching(evict = {
        @CacheEvict(value = "buildings", allEntries = true)
    })
    public Building saveBuilding(Building building) {
        return buildingRepository.save(building);
    }

    @Caching(evict = {
        @CacheEvict(value = "buildings", allEntries = true)
    })
    public void deleteBuilding(UUID id) {
        buildingRepository.deleteById(id);
    }

    @Caching(evict = {
        @CacheEvict(value = "buildings", allEntries = true)
    })
    public void evictCaches() {}
}
