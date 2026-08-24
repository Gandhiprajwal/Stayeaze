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

    @Query("SELECT b FROM Building b WHERE b.property.organization = :org")
    List<Building> findByOrganization(@Param("org") Organization org);

    @Query("SELECT b FROM Building b WHERE b.property.organization.id = :orgId")
    Page<Building> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT property_id FROM buildings WHERE id = :buildingId", nativeQuery = true)
    UUID findPropertyIdByBuildingId(@Param("buildingId") UUID buildingId);

    @Query(value = "SELECT * FROM buildings b ORDER BY b.name ASC", nativeQuery = true)
    List<Building> findAllSuperAdmin();

    @Query(value = "SELECT b.* FROM buildings b JOIN properties p ON b.property_id = p.id WHERE p.org_id = CAST(:orgId AS uuid)", nativeQuery = true)
    List<Building> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    Page<Building> findAll(Pageable pageable);
}
