package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.Visitor;
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
public interface VisitorRepository extends JpaRepository<Visitor, UUID> {
    List<Visitor> findByTenant(Tenant tenant);
    Optional<Visitor> findByIdAndTenant(UUID id, Tenant tenant);

    @Query("SELECT v FROM Visitor v LEFT JOIN v.tenant t WHERE (v.organization IS NOT NULL AND v.organization.id = :orgId) OR (t IS NOT NULL AND t.organization.id = :orgId) ORDER BY v.checkInTime DESC NULLS LAST")
    List<Visitor> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT v FROM Visitor v LEFT JOIN v.tenant t WHERE (v.organization IS NOT NULL AND v.organization.id = :orgId) OR (t IS NOT NULL AND t.organization.id = :orgId) ORDER BY v.checkInTime DESC NULLS LAST")
    Page<Visitor> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT v.* FROM visitors v LEFT JOIN tenants t ON v.tenant_id = t.id WHERE (v.org_id IS NOT NULL AND v.org_id = CAST(:orgId AS uuid)) OR (t.org_id IS NOT NULL AND t.org_id = CAST(:orgId AS uuid)) ORDER BY v.check_in_time DESC NULLS LAST", nativeQuery = true)
    List<Visitor> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    Optional<Visitor> findByIdAndOrganizationId(UUID id, UUID orgId);

    Optional<Visitor> findByPassCodeIgnoreCase(String passCode);

    Optional<Visitor> findByQrCodeData(String qrCodeData);

    List<Visitor> findByTenantAndStatus(Tenant tenant, String status);

    @Query("SELECT v FROM Visitor v WHERE v.tenant = :tenant ORDER BY COALESCE(v.checkInTime, v.expectedArrival) DESC NULLS LAST")
    List<Visitor> findByTenantOrderByTimeDesc(@Param("tenant") Tenant tenant);
}
