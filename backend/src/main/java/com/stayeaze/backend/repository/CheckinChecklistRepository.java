package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Booking;
import com.stayeaze.backend.models.CheckinChecklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CheckinChecklistRepository extends JpaRepository<CheckinChecklist, UUID> {
    Optional<CheckinChecklist> findByBooking(Booking booking);
}
