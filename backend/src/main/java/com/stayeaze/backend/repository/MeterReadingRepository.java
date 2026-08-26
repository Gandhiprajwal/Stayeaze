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
    
    @org.springframework.data.jpa.repository.Query("SELECT m FROM MeterReading m WHERE m.room.floor.building.property.id = :propertyId AND m.billingMonth = :month AND m.billingYear = :year")
    List<MeterReading> findByPropertyIdAndBillingMonthAndBillingYear(
            @org.springframework.data.repository.query.Param("propertyId") UUID propertyId,
            @org.springframework.data.repository.query.Param("month") Integer month,
            @org.springframework.data.repository.query.Param("year") Integer year);

    @org.springframework.data.jpa.repository.Query("SELECT m FROM MeterReading m WHERE m.room.id IN (:roomIds) AND m.billingMonth = :month AND m.billingYear = :year")
    List<MeterReading> findByRoomIdInAndBillingMonthAndBillingYear(
            @org.springframework.data.repository.query.Param("roomIds") List<UUID> roomIds,
            @org.springframework.data.repository.query.Param("month") Integer month,
            @org.springframework.data.repository.query.Param("year") Integer year);

    @org.springframework.data.jpa.repository.Query("SELECT m FROM MeterReading m WHERE m.room.id IN (:roomIds)")
    List<MeterReading> findByRoomIdIn(@org.springframework.data.repository.query.Param("roomIds") List<UUID> roomIds);

    List<MeterReading> findByRoomAndBillingMonthAndBillingYear(Room room, Integer billingMonth, Integer billingYear);
}

