package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PropertyRepository extends JpaRepository<Property, UUID> {
    List<Property> findByOrganization(Organization organization);
    List<Property> findByOrganizationId(UUID organizationId);
    Page<Property> findByOrganization(Organization organization, Pageable pageable);
    Page<Property> findAll(Pageable pageable);
    Optional<Property> findByIdAndOrganization(UUID id, Organization organization);
    List<Property> findByIdIn(List<UUID> ids);
    Page<Property> findByIdIn(List<UUID> ids, Pageable pageable);
}
