package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Building;
import com.stayeaze.backend.models.Floor;
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
public interface FloorRepository extends JpaRepository<Floor, UUID> {
    List<Floor> findByBuilding(Building building);

    @Query("SELECT f FROM Floor f WHERE f.building.id = :buildingId")
    List<Floor> findByBuildingId(@Param("buildingId") UUID buildingId);
    Optional<Floor> findByIdAndBuilding(UUID id, Building building);
    Boolean existsByBuildingAndFloorNumber(Building building, Integer floorNumber);

    @Query("SELECT f FROM Floor f WHERE f.building.property.organization.id = :orgId")
    List<Floor> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT f FROM Floor f WHERE f.building.property.organization.id = :orgId")
    Page<Floor> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT building_id FROM floors WHERE id = :floorId", nativeQuery = true)
    UUID findBuildingIdByFloorId(@Param("floorId") UUID floorId);

    @Query(value = "SELECT * FROM floors f ORDER BY f.floor_number ASC", nativeQuery = true)
    List<Floor> findAllSuperAdmin();

    Page<Floor> findAll(Pageable pageable);
}
