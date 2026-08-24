package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.payload.response.MinimalPropertyDTO;
import com.stayeaze.backend.payload.response.PropertyDTO;
import com.stayeaze.backend.repository.PropertyRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PropertyService {

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private CacheManager cacheManager;

    /** Evict stale minimalProperties cache on startup (e.g., after DTO shape changes). */
    @PostConstruct
    public void evictMinimalCacheOnStartup() {
        try {
            var cache = cacheManager.getCache("minimalProperties");
            if (cache != null) cache.clear();
        } catch (Exception ignored) {
            // Redis may not be available during tests; safe to ignore
        }
    }

    @Autowired
    private com.stayeaze.backend.repository.BuildingRepository buildingRepository;

    @Autowired
    private com.stayeaze.backend.repository.FloorRepository floorRepository;

    @Autowired
    private com.stayeaze.backend.repository.RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.repository.BedRepository bedRepository;

    public Property populatePropertyStats(Property p) {
        if (p == null) return null;
        try {
            List<com.stayeaze.backend.models.Building> buildings = buildingRepository.findByProperty(p);
            if (buildings == null || buildings.isEmpty()) {
                if (p.getTotalBeds() == null) p.setTotalBeds(0);
                if (p.getOccupiedBeds() == null) p.setOccupiedBeds(0);
                if (p.getTotalRooms() == null) p.setTotalRooms(0);
                if (p.getTotalBuildings() == null) p.setTotalBuildings(0);
                return p;
            }

            int activeBuildings = 0;
            int totalRooms = 0;
            int totalBeds = 0;
            int occupiedBeds = 0;

            for (com.stayeaze.backend.models.Building b : buildings) {
                if (b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus())) {
                    activeBuildings++;
                    List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuilding(b);
                    for (com.stayeaze.backend.models.Floor f : floors) {
                        if (f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus())) {
                            List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
                            for (com.stayeaze.backend.models.Room r : rooms) {
                                if (r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus())) {
                                    totalRooms++;
                                    List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoomId(r.getId());
                                    int bCount = beds.size();
                                    if (bCount == 0 && r.getSharing() != null && r.getSharing() > 0) {
                                        bCount = r.getSharing();
                                    }
                                    totalBeds += bCount;
                                    for (com.stayeaze.backend.models.Bed bed : beds) {
                                        if ("OCCUPIED".equalsIgnoreCase(bed.getStatus())) {
                                            occupiedBeds++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            p.setTotalBuildings(activeBuildings);
            p.setTotalRooms(totalRooms);
            p.setTotalBeds(totalBeds);
            p.setOccupiedBeds(occupiedBeds);
        } catch (Exception e) {
            if (p.getTotalBeds() == null) p.setTotalBeds(0);
            if (p.getOccupiedBeds() == null) p.setOccupiedBeds(0);
        }
        return p;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPropertyOverallStats(UUID propertyId, UUID orgId) {
        List<Object[]> rows = bedRepository.getOverallMetricsAggregateNative(propertyId, orgId);
        int totalProperties = 0;
        int totalBuildings = 0;
        int totalRooms = 0;
        int totalBeds = 0;
        int occupiedBeds = 0;

        if (rows != null && !rows.isEmpty() && rows.get(0) != null) {
            Object[] row = rows.get(0);
            totalProperties = row[0] != null ? ((Number) row[0]).intValue() : 0;
            totalBuildings = row[1] != null ? ((Number) row[1]).intValue() : 0;
            totalRooms = row[2] != null ? ((Number) row[2]).intValue() : 0;
            totalBeds = row[3] != null ? ((Number) row[3]).intValue() : 0;
            occupiedBeds = row[4] != null ? ((Number) row[4]).intValue() : 0;
        }

        int availableBeds = Math.max(0, totalBeds - occupiedBeds);
        double occupancyRate = totalBeds > 0 
                ? Math.round(((double) occupiedBeds / totalBeds) * 1000.0) / 10.0 
                : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProperties", totalProperties);
        stats.put("totalBuildings", totalBuildings);
        stats.put("totalRooms", totalRooms);
        stats.put("totalBeds", totalBeds);
        stats.put("occupiedBeds", occupiedBeds);
        stats.put("availableBeds", availableBeds);
        stats.put("occupancyRate", occupancyRate);
        return stats;
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getPropertiesByOrganizationPaged(Organization organization, org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<Property> page;
        if (organization == null) {
            page = propertyRepository.findAll(pageable);
        } else {
            page = propertyRepository.findByOrganization(organization, pageable);
        }
        return page.map(p -> PropertyDTO.fromEntity(populatePropertyStats(p)));
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getAllPropertiesForSuperAdminPaged(org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<Property> page = propertyRepository.findAllSuperAdminPaged(pageable);
        return page.map(p -> PropertyDTO.fromEntity(populatePropertyStats(p)));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "propertyDtos", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<PropertyDTO> getPropertiesByOrganization(Organization organization) {
        List<Property> properties;
        if (organization == null) {
            properties = propertyRepository.findAllSuperAdmin();
        } else {
            properties = propertyRepository.findByOrganization(organization);
        }
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(p -> PropertyDTO.fromEntity(populatePropertyStats(p))).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PropertyDTO> getAllPropertiesForSuperAdmin() {
        List<Property> properties = propertyRepository.findAllSuperAdmin();
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(p -> PropertyDTO.fromEntity(populatePropertyStats(p))).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "minimalProperties", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<MinimalPropertyDTO> getMinimalPropertiesByOrganization(Organization organization) {
        if (organization == null) {
            return getMinimalPropertiesForSuperAdmin();
        }
        List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findMinimalByOrgIdNative(organization.getId());
        if (views == null) return new ArrayList<>();
        return views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "minimalProperties", key = "'all_super_admin'")
    public List<MinimalPropertyDTO> getMinimalPropertiesForSuperAdmin() {
        // Native interface projection: 1 single SQL query selecting 11 columns, 0 entity hydration, sub-25ms execution
        List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findAllMinimalSuperAdminNative();
        if (views == null) return new ArrayList<>();
        return views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getPropertiesByIdsPaged(List<UUID> ids, org.springframework.data.domain.Pageable pageable) {
        if (ids == null || ids.isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }
        org.springframework.data.domain.Page<Property> page = propertyRepository.findByIdIn(ids, pageable);
        return page.map(PropertyDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    public List<MinimalPropertyDTO> getMinimalPropertiesByIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findMinimalByIdsNative(ids);
        if (views == null) return new ArrayList<>();
        return views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList());
    }

    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true)
    })
    public Property saveProperty(Property property) {
        return propertyRepository.save(property);
    }

    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true)
    })
    public void deleteProperty(UUID propertyId) {
        propertyRepository.deleteById(propertyId);
    }
}
