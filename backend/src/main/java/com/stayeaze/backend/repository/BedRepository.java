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
    List<Bed> findByRoom(Room room);
    Optional<Bed> findByIdAndRoom(UUID id, Room room);
    Boolean existsByRoomAndBedNumber(Room room, String bedNumber);
    Optional<Bed> findByQrCode(String qrCode);

    @Query("SELECT b FROM Bed b WHERE b.room.floor.building.property.organization.id = :orgId")
    List<Bed> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT b FROM Bed b WHERE b.room.floor.building.property.organization.id = :orgId")
    Page<Bed> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    Page<Bed> findAll(Pageable pageable);
}
