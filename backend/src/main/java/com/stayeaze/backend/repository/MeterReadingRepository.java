package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.MeterReading;
import com.stayeaze.backend.models.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MeterReadingRepository extends JpaRepository<MeterReading, UUID> {
    List<MeterReading> findByRoom(Room room);
    @org.springframework.data.jpa.repository.Query("SELECT m FROM MeterReading m WHERE m.room.floor.building.property.id = :propertyId")
    List<MeterReading> findByPropertyId(@org.springframework.data.repository.query.Param("propertyId") UUID propertyId);
    Optional<MeterReading> findByRoomAndBillingMonthAndBillingYear(Room room, Integer billingMonth, Integer billingYear);
}

