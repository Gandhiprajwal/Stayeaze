package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.TenantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class TenantService {

    @Autowired
    private TenantRepository tenantRepository;

    @Cacheable(value = "tenants", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<Tenant> getTenantsByOrganization(Organization organization) {
        if (organization == null) {
            return tenantRepository.findAll();
        }
        return tenantRepository.findByOrganization(organization);
    }

    @CacheEvict(value = "tenants", allEntries = true)
    public Tenant saveTenant(Tenant tenant) {
        return tenantRepository.save(tenant);
    }

    @CacheEvict(value = "tenants", allEntries = true)
    public void deleteTenant(UUID id) {
        tenantRepository.deleteById(id);
    }
}
