package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Floor;
import com.stayeaze.backend.models.Room;
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
public interface RoomRepository extends JpaRepository<Room, UUID> {
    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE r.floor = :floor")
    List<Room> findByFloor(@Param("floor") Floor floor);

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE r.floor.id = :floorId")
    List<Room> findByFloorId(@Param("floorId") UUID floorId);

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE p.id = :propertyId")
    List<Room> findByPropertyId(@Param("propertyId") UUID propertyId);
    Optional<Room> findByIdAndFloor(UUID id, Floor floor);
    Boolean existsByFloorAndRoomNumber(Floor floor, String roomNumber);

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE p.organization.id = :orgId")
    List<Room> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT r FROM Room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p WHERE p.organization.id = :orgId",
           countQuery = "SELECT count(r) FROM Room r WHERE r.floor.building.property.organization.id = :orgId")
    Page<Room> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT floor_id FROM rooms WHERE id = :roomId", nativeQuery = true)
    UUID findFloorIdByRoomId(@Param("roomId") UUID roomId);

    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building b LEFT JOIN FETCH b.property p ORDER BY r.roomNumber ASC")
    List<Room> findAllSuperAdmin();

    Page<Room> findAll(Pageable pageable);

    @Query(value = "SELECT " +
            "CAST(r.id AS text) AS roomId, " +
            "r.room_number AS roomNumber, " +
            "r.sharing_type AS sharingType, " +
            "r.base_rent AS baseRent, " +
            "r.status AS status, " +
            "CAST(f.id AS text) AS floorId, " +
            "f.name AS floorName, " +
            "f.floor_number AS floorNumber, " +
            "CAST(bl.id AS text) AS buildingId, " +
            "bl.name AS buildingName, " +
            "CAST(p.id AS text) AS propertyId, " +
            "p.name AS propertyName " +
            "FROM rooms r " +
            "JOIN floors f ON r.floor_id = f.id " +
            "JOIN buildings bl ON f.building_id = bl.id " +
            "JOIN properties p ON bl.property_id = p.id " +
            "WHERE p.id = CAST(:propertyId AS uuid) " +
            "AND (r.status IS NULL OR LOWER(r.status) != 'archived') " +
            "ORDER BY r.room_number ASC",
            nativeQuery = true)
    List<Object[]> findPublicRoomsWithHierarchyNative(@Param("propertyId") UUID propertyId);

    @Query(value = "SELECT r.* FROM rooms r " +
            "JOIN floors f ON r.floor_id = f.id " +
            "JOIN buildings b ON f.building_id = b.id " +
            "WHERE b.property_id = CAST(:propertyId AS uuid) " +
            "AND LOWER(COALESCE(r.status, '')) != 'archived' " +
            "ORDER BY r.room_number ASC",
            nativeQuery = true)
    List<Room> findByPropertyIdNative(@Param("propertyId") UUID propertyId);

    @Query(value = "SELECT b.name FROM rooms r " +
            "JOIN floors f ON r.floor_id = f.id " +
            "JOIN buildings b ON f.building_id = b.id " +
            "WHERE r.room_number = :roomNumber AND b.property_id = CAST(:propertyId AS uuid) LIMIT 1",
            nativeQuery = true)
    String findBuildingNameByRoomNumberAndPropertyId(@Param("roomNumber") String roomNumber, @Param("propertyId") UUID propertyId);

    @Query(value = "SELECT b.name FROM rooms r " +
            "JOIN floors f ON r.floor_id = f.id " +
            "JOIN buildings b ON f.building_id = b.id " +
            "WHERE r.room_number = :roomNumber LIMIT 1",
            nativeQuery = true)
    String findBuildingNameByRoomNumber(@Param("roomNumber") String roomNumber);

    @Query("SELECT r FROM Room r " +
           "WHERE r.floor.building.property.id = :propertyId " +
           "AND (:buildingId IS NULL OR r.floor.building.id = :buildingId) " +
           "AND (r.status IS NULL OR LOWER(r.status) != 'archived') " +
           "ORDER BY r.roomNumber ASC")
    Page<Room> findByPropertyAndBuildingPaginated(
            @Param("propertyId") UUID propertyId,
            @Param("buildingId") UUID buildingId,
            Pageable pageable);

    @Query("SELECT r FROM Room r " +
           "WHERE r.floor.building.property.id = :propertyId " +
           "AND (:buildingId IS NULL OR r.floor.building.id = :buildingId) " +
           "AND (LOWER(r.roomNumber) LIKE :searchPattern " +
           "     OR LOWER(r.floor.building.name) LIKE :searchPattern " +
           "     OR LOWER(r.floor.name) LIKE :searchPattern) " +
           "AND (r.status IS NULL OR LOWER(r.status) != 'archived') " +
           "ORDER BY r.roomNumber ASC")
    Page<Room> findByPropertyAndFiltersWithSearchPaginated(
            @Param("propertyId") UUID propertyId,
            @Param("buildingId") UUID buildingId,
            @Param("searchPattern") String searchPattern,
            Pageable pageable);

    @Query(value = "SELECT b.property_id FROM rooms r " +
            "JOIN floors f ON r.floor_id = f.id " +
            "JOIN buildings b ON f.building_id = b.id " +
            "WHERE r.id = :roomId",
            nativeQuery = true)
    UUID findPropertyIdByRoomId(@Param("roomId") UUID roomId);
}
