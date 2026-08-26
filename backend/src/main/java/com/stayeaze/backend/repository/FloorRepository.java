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
    @Query("SELECT f FROM Floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE f.building = :building")
    List<Floor> findByBuilding(@Param("building") Building building);

    @Query("SELECT f FROM Floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE f.building.id = :buildingId")
    List<Floor> findByBuildingId(@Param("buildingId") UUID buildingId);
    Optional<Floor> findByIdAndBuilding(UUID id, Building building);
    Boolean existsByBuildingAndFloorNumber(Building building, Integer floorNumber);

    @Query("SELECT f FROM Floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE p.organization.id = :orgId")
    List<Floor> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT f FROM Floor f WHERE f.building.property.organization.id = :orgId")
    Page<Floor> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT building_id FROM floors WHERE id = :floorId", nativeQuery = true)
    UUID findBuildingIdByFloorId(@Param("floorId") UUID floorId);

    @Query("SELECT f FROM Floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p ORDER BY f.floorNumber ASC")
    List<Floor> findAllSuperAdmin();

    @Query(value = "SELECT " +
                   "CAST(f.id AS text) as floorId, " +
                   "COUNT(DISTINCT r.id) as totalRooms, " +
                   "COUNT(b.id) as totalBeds, " +
                   "COALESCE(SUM(CASE WHEN UPPER(b.status) = 'OCCUPIED' THEN 1 ELSE 0 END), 0) as occupiedBeds " +
                   "FROM floors f " +
                   "LEFT JOIN rooms r ON r.floor_id = f.id AND (r.status IS NULL OR UPPER(r.status) != 'ARCHIVED') " +
                   "LEFT JOIN beds b ON b.room_id = r.id AND (b.status IS NULL OR UPPER(b.status) != 'ARCHIVED') " +
                   "WHERE f.building_id = CAST(:buildingId AS uuid) AND (f.status IS NULL OR UPPER(f.status) != 'ARCHIVED') " +
                   "GROUP BY f.id", nativeQuery = true)
    List<Object[]> getMetricsByFloorForBuildingNative(@Param("buildingId") UUID buildingId);

    Page<Floor> findAll(Pageable pageable);
}
