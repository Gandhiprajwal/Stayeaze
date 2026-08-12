package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BuildingRepository extends JpaRepository<Building, UUID> {
    List<Building> findByProperty(Property property);
    Optional<Building> findByIdAndProperty(UUID id, Property property);
    Boolean existsByPropertyAndCode(Property property, String code);

    @Query("SELECT b FROM Building b WHERE b.property.organization.id = :orgId")
    List<Building> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT b FROM Building b WHERE b.property.organization.id = :orgId")
    Page<Building> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    Page<Building> findAll(Pageable pageable);
}
