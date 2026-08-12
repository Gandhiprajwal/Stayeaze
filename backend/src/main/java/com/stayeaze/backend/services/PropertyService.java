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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getPropertiesByOrganizationPaged(Organization organization, org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<Property> page;
        if (organization == null) {
            page = propertyRepository.findAll(pageable);
        } else {
            page = propertyRepository.findByOrganization(organization, pageable);
        }
        return page.map(PropertyDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getAllPropertiesForSuperAdminPaged(org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<Property> page = propertyRepository.findAll(pageable);
        return page.map(PropertyDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "propertyDtos", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<PropertyDTO> getPropertiesByOrganization(Organization organization) {
        List<Property> properties;
        if (organization == null) {
            properties = propertyRepository.findAll();
        } else {
            properties = propertyRepository.findByOrganization(organization);
        }
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(PropertyDTO::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "propertyDtos", key = "'all_super_admin'")
    public List<PropertyDTO> getAllPropertiesForSuperAdmin() {
        List<Property> properties = propertyRepository.findAll();
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(PropertyDTO::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "minimalProperties", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<MinimalPropertyDTO> getMinimalPropertiesByOrganization(Organization organization) {
        List<Property> properties;
        if (organization == null) {
            properties = propertyRepository.findAll();
        } else {
            properties = propertyRepository.findByOrganization(organization);
        }
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(MinimalPropertyDTO::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "minimalProperties", key = "'all_super_admin'")
    public List<MinimalPropertyDTO> getMinimalPropertiesForSuperAdmin() {
        List<Property> properties = propertyRepository.findAll();
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(MinimalPropertyDTO::fromEntity).collect(Collectors.toList());
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
        List<Property> properties = propertyRepository.findByIdIn(ids);
        return properties.stream().map(MinimalPropertyDTO::fromEntity).collect(Collectors.toList());
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
