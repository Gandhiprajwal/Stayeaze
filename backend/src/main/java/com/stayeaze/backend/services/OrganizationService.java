package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.repository.OrganizationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class OrganizationService {

    @Autowired
    private OrganizationRepository organizationRepository;

    @Cacheable(value = "organizationProfiles", key = "#id.toString()")
    public Optional<Organization> getOrganizationById(UUID id) {
        return organizationRepository.findById(id);
    }

    @CacheEvict(value = "organizationProfiles", key = "#organization.id.toString()")
    public Organization saveOrganization(Organization organization) {
        return organizationRepository.save(organization);
    }
}
