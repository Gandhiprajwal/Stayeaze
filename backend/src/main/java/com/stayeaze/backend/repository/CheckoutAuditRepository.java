package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Booking;
import com.stayeaze.backend.models.CheckoutAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CheckoutAuditRepository extends JpaRepository<CheckoutAudit, UUID> {
    Optional<CheckoutAudit> findByBooking(Booking booking);
}
