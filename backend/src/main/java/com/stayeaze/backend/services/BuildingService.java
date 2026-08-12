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
                .map(BuildingDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "buildings", key = "'all_super_admin'")
    public List<BuildingDTO> getAllBuildings() {
        return buildingRepository.findAll().stream()
                .map(BuildingDTO::fromEntity)
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
}
