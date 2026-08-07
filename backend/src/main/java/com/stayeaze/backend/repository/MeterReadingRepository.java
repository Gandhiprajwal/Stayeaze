package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.MeterReading;
import com.stayeaze.backend.models.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MeterReadingRepository extends JpaRepository<MeterReading, UUID> {
    List<MeterReading> findByRoom(Room room);
}
