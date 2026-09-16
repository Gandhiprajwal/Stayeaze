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

    @Query("SELECT b FROM Building b WHERE b.property.id = :propertyId")
    List<Building> findByPropertyId(@Param("propertyId") UUID propertyId);

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

    @Query(value = "SELECT " +
                   "CAST(bl.id AS text) as buildingId, " +
                   "COUNT(DISTINCT f.id) as totalFloors, " +
                   "COUNT(DISTINCT r.id) as totalRooms, " +
                   "COUNT(b.id) as totalBeds, " +
                   "COALESCE(SUM(CASE WHEN UPPER(b.status) = 'OCCUPIED' THEN 1 ELSE 0 END), 0) as occupiedBeds " +
                   "FROM buildings bl " +
                   "LEFT JOIN floors f ON f.building_id = bl.id AND (f.status IS NULL OR UPPER(f.status) != 'ARCHIVED') " +
                   "LEFT JOIN rooms r ON r.floor_id = f.id AND (r.status IS NULL OR UPPER(r.status) != 'ARCHIVED') " +
                   "LEFT JOIN beds b ON b.room_id = r.id AND (b.status IS NULL OR UPPER(b.status) != 'ARCHIVED') " +
                   "WHERE bl.property_id = CAST(:propertyId AS uuid) AND (bl.status IS NULL OR UPPER(bl.status) != 'ARCHIVED') " +
                   "GROUP BY bl.id", nativeQuery = true)
    List<Object[]> getMetricsByBuildingForPropertyNative(@Param("propertyId") UUID propertyId);

    Page<Building> findAll(Pageable pageable);
}
