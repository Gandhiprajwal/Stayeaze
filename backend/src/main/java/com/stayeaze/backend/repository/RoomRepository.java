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
    List<Room> findByFloor(Floor floor);
    Optional<Room> findByIdAndFloor(UUID id, Floor floor);
    Boolean existsByFloorAndRoomNumber(Floor floor, String roomNumber);

    @Query("SELECT r FROM Room r WHERE r.floor.building.property.organization.id = :orgId")
    List<Room> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT r FROM Room r WHERE r.floor.building.property.organization.id = :orgId")
    Page<Room> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    Page<Room> findAll(Pageable pageable);
}
