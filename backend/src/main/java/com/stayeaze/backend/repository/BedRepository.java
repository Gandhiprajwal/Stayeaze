package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Bed;
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
public interface BedRepository extends JpaRepository<Bed, UUID> {
    @Query("SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building bl LEFT JOIN FETCH bl.property p WHERE b.room = :room")
    List<Bed> findByRoom(@Param("room") Room room);

    @Query("SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building bl LEFT JOIN FETCH bl.property p WHERE b.room.id = :roomId")
    List<Bed> findByRoomId(@Param("roomId") UUID roomId);

    @Query("SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building bl LEFT JOIN FETCH bl.property p WHERE b.room.id IN (:roomIds)")
    List<Bed> findByRoomIdIn(@Param("roomIds") List<UUID> roomIds);

    Optional<Bed> findByIdAndRoom(UUID id, Room room);
    Boolean existsByRoomAndBedNumber(Room room, String bedNumber);

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Bed b WHERE b.room.id = :roomId AND b.bedNumber = :bedNumber")
    Boolean existsByRoomIdAndBedNumber(@Param("roomId") UUID roomId, @Param("bedNumber") String bedNumber);
    Optional<Bed> findByQrCode(String qrCode);

    @Query("SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building bl LEFT JOIN FETCH bl.property p WHERE p.organization.id = :orgId")
    List<Bed> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building bl LEFT JOIN FETCH bl.property p WHERE p.organization.id = :orgId",
           countQuery = "SELECT count(b) FROM Bed b WHERE b.room.floor.building.property.organization.id = :orgId")
    Page<Bed> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query("SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f WHERE LOWER(r.roomNumber) = LOWER(:roomNumber) AND LOWER(b.bedNumber) = LOWER(:bedNumber) AND r.floor.building.property.organization.id = :orgId")
    Optional<Bed> findByRoomNumberAndBedNumberAndOrgId(@Param("roomNumber") String roomNumber, @Param("bedNumber") String bedNumber, @Param("orgId") UUID orgId);

    @Query("SELECT b FROM Bed b LEFT JOIN FETCH b.room r LEFT JOIN FETCH r.floor f LEFT JOIN FETCH f.building bl LEFT JOIN FETCH bl.property p ORDER BY b.bedNumber ASC")
    List<Bed> findAllSuperAdmin();

    @Query(value = "SELECT " +
                   "CAST(b.id AS text) AS bedId, " +
                   "b.bed_number AS bedNumber, " +
                   "b.status AS status, " +
                   "CAST(r.id AS text) AS roomId, " +
                   "r.room_number AS roomNumber, " +
                   "bl.name AS buildingName, " +
                   "f.name AS floorName, " +
                   "p.name AS propertyName " +
                   "FROM beds b " +
                   "JOIN rooms r ON b.room_id = r.id " +
                   "JOIN floors f ON r.floor_id = f.id " +
                   "JOIN buildings bl ON f.building_id = bl.id " +
                   "JOIN properties p ON bl.property_id = p.id " +
                   "WHERE r.id = CAST(:roomId AS uuid) " +
                   "AND (b.status IS NULL OR LOWER(b.status) != 'archived') " +
                   "ORDER BY b.bed_number ASC",
                   nativeQuery = true)
    List<Object[]> findPublicBedsWithHierarchyNative(@Param("roomId") UUID roomId);

    @Query(value = "SELECT b.* FROM beds b " +
                   "JOIN rooms r ON b.room_id = r.id " +
                   "JOIN floors f ON r.floor_id = f.id " +
                   "JOIN buildings bl ON f.building_id = bl.id " +
                   "JOIN properties p ON bl.property_id = p.id " +
                   "WHERE p.org_id = CAST(:orgId AS uuid)", nativeQuery = true)
    List<Bed> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    @Query(value = "SELECT CAST(p.org_id AS text) as orgId, count(b.id) as totalBeds, " +
                   "COALESCE(SUM(CASE WHEN UPPER(b.status) = 'OCCUPIED' THEN 1 ELSE 0 END), 0) as occupiedBeds " +
                   "FROM properties p " +
                   "JOIN buildings bl ON bl.property_id = p.id " +
                   "JOIN floors f ON f.building_id = bl.id " +
                   "JOIN rooms r ON r.floor_id = f.id " +
                   "JOIN beds b ON b.room_id = r.id " +
                   "WHERE p.org_id IN (:orgIds) " +
                   "GROUP BY p.org_id", nativeQuery = true)
    List<Object[]> countBedsByOrgIdsNative(@Param("orgIds") List<UUID> orgIds);

    @Query(value = "SELECT " +
                   "COUNT(DISTINCT p.id) as totalProperties, " +
                   "COUNT(DISTINCT bl.id) as totalBuildings, " +
                   "COUNT(DISTINCT r.id) as totalRooms, " +
                   "COUNT(b.id) as totalBeds, " +
                   "COALESCE(SUM(CASE WHEN UPPER(b.status) = 'OCCUPIED' THEN 1 ELSE 0 END), 0) as occupiedBeds " +
                   "FROM properties p " +
                   "LEFT JOIN buildings bl ON bl.property_id = p.id AND (bl.status IS NULL OR UPPER(bl.status) != 'ARCHIVED') " +
                   "LEFT JOIN floors f ON f.building_id = bl.id AND (f.status IS NULL OR UPPER(f.status) != 'ARCHIVED') " +
                   "LEFT JOIN rooms r ON r.floor_id = f.id AND (r.status IS NULL OR UPPER(r.status) != 'ARCHIVED') " +
                   "LEFT JOIN beds b ON b.room_id = r.id AND (b.status IS NULL OR UPPER(b.status) != 'ARCHIVED') " +
                   "WHERE (:propertyId IS NULL OR p.id = CAST(:propertyId AS uuid)) " +
                   "AND (:orgId IS NULL OR p.org_id = CAST(:orgId AS uuid))", nativeQuery = true)
    List<Object[]> getOverallMetricsAggregateNative(@Param("propertyId") UUID propertyId, @Param("orgId") UUID orgId);

    @Query(value = "SELECT " +
                   "CAST(p.id AS text) as propertyId, " +
                   "COUNT(DISTINCT bl.id) as totalBuildings, " +
                   "COUNT(DISTINCT r.id) as totalRooms, " +
                   "COUNT(b.id) as totalBeds, " +
                   "COALESCE(SUM(CASE WHEN UPPER(b.status) = 'OCCUPIED' THEN 1 ELSE 0 END), 0) as occupiedBeds " +
                   "FROM properties p " +
                   "LEFT JOIN buildings bl ON bl.property_id = p.id AND (bl.status IS NULL OR UPPER(bl.status) != 'ARCHIVED') " +
                   "LEFT JOIN floors f ON f.building_id = bl.id AND (f.status IS NULL OR UPPER(f.status) != 'ARCHIVED') " +
                   "LEFT JOIN rooms r ON r.floor_id = f.id AND (r.status IS NULL OR UPPER(r.status) != 'ARCHIVED') " +
                   "LEFT JOIN beds b ON b.room_id = r.id AND (b.status IS NULL OR UPPER(b.status) != 'ARCHIVED') " +
                   "WHERE p.id IN (:propertyIds) " +
                   "GROUP BY p.id", nativeQuery = true)
    List<Object[]> getMetricsByPropertyIdsNative(@Param("propertyIds") List<UUID> propertyIds);

    @Query(value = "SELECT count(*) FROM beds", nativeQuery = true)
    long countSuperAdmin();

    Page<Bed> findAll(Pageable pageable);
}
