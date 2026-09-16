package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Booking;
import com.stayeaze.backend.models.Tenant;
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
public interface BookingRepository extends JpaRepository<Booking, UUID> {
    List<Booking> findByTenant(Tenant tenant);
    Optional<Booking> findByIdAndTenant(UUID id, Tenant tenant);

    @Query("SELECT b FROM Booking b WHERE b.tenant.organization.id = :orgId")
    List<Booking> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT b FROM Booking b WHERE b.tenant.organization.id = :orgId")
    Page<Booking> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT b.* FROM bookings b JOIN tenants t ON b.tenant_id = t.id WHERE t.org_id = CAST(:orgId AS uuid) ORDER BY b.created_at DESC", nativeQuery = true)
    List<Booking> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    @Query("SELECT DISTINCT b.tenant FROM Booking b WHERE b.bed.room.id = :roomId AND (b.status = 'CONFIRMED' OR b.status = 'CHECKED_IN' OR b.status = 'ACTIVE') AND (b.tenant.status IS NULL OR UPPER(b.tenant.status) = 'ACTIVE')")
    List<Tenant> findActiveTenantsByRoomId(@Param("roomId") UUID roomId);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.tenant.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") UUID orgId);

    boolean existsByBookingCode(String bookingCode);

    Page<Booking> findAll(Pageable pageable);
}
