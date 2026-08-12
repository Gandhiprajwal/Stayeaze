package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.FloorDTO;
import com.stayeaze.backend.repository.FloorRepository;
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
public class FloorService {

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private com.stayeaze.backend.repository.RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.repository.BedRepository bedRepository;

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    private Floor populateFloorStats(Floor f, Organization organization) {
        if (f == null) return null;
        List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
        f.setRooms(rooms.size());
        int totalBeds = 0, occupiedBeds = 0;

        List<com.stayeaze.backend.models.Tenant> activeTenants = null;
        try {
            activeTenants = organization != null ? tenantRepository.findByOrganization(organization) : tenantRepository.findAll();
        } catch (Exception ignored) {}

        for (com.stayeaze.backend.models.Room r : rooms) {
            List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoom(r);
            int rBedCount = beds.size();
            if (rBedCount == 0 && r.getSharing() != null && r.getSharing() > 0) {
                rBedCount = r.getSharing();
            }
            totalBeds += rBedCount;
            for (com.stayeaze.backend.models.Bed b : beds) {
                boolean isOcc = "OCCUPIED".equalsIgnoreCase(b.getStatus());
                if (!isOcc && activeTenants != null) {
                    for (com.stayeaze.backend.models.Tenant t : activeTenants) {
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

    @Transactional(readOnly = true)
    @Cacheable(value = "floors_v2", key = "#organization != null ? #organization.id.toString() : 'all_super_admin'")
    public List<FloorDTO> getFloorsByOrg(Organization organization) {
        List<Floor> list = organization == null ? floorRepository.findAll()
                : floorRepository.findByOrganizationId(organization.getId());
        return list.stream()
                .map(f -> FloorDTO.fromEntity(populateFloorStats(f, organization)))
                .collect(Collectors.toList());
    }

    @Caching(evict = {
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "tenants", allEntries = true),
        @CacheEvict(value = "buildings", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true)
    })
    public void evictCaches() {
    }

    @Caching(evict = {
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "tenants", allEntries = true),
        @CacheEvict(value = "buildings", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true)
    })
    public Floor saveFloor(Floor floor) {
        return floorRepository.save(floor);
    }

    @Caching(evict = {
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "tenants", allEntries = true),
        @CacheEvict(value = "buildings", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true)
    })
    public void deleteFloor(UUID id) {
        floorRepository.deleteById(id);
    }
}
