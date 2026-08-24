package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Complaint;
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
public interface ComplaintRepository extends JpaRepository<Complaint, UUID> {
    List<Complaint> findByTenant(Tenant tenant);
    Optional<Complaint> findByIdAndTenant(UUID id, Tenant tenant);

    @Query(value = "SELECT * FROM complaints WHERE id = CAST(:id AS uuid)", nativeQuery = true)
    Optional<Complaint> findByIdNative(@Param("id") UUID id);

    @Query("SELECT c FROM Complaint c WHERE c.tenant.organization.id = :orgId")
    List<Complaint> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT c FROM Complaint c WHERE c.tenant.organization.id = :orgId")
    Page<Complaint> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT c.* FROM complaints c JOIN tenants t ON c.tenant_id = t.id WHERE t.org_id = CAST(:orgId AS uuid)", nativeQuery = true)
    List<Complaint> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    @Query("SELECT c FROM Complaint c WHERE c.tenant.organization.id = :orgId AND (:propertyId IS NULL OR c.tenant.propertyId = :propertyId)")
    List<Complaint> findByOrganizationIdAndOptionalPropertyId(@Param("orgId") UUID orgId, @Param("propertyId") UUID propertyId);

    @Query(value = "SELECT count(*) FROM complaints c " +
                   "JOIN tenants t ON c.tenant_id = t.id " +
                   "WHERE (:orgId IS NULL OR t.org_id = CAST(:orgId AS uuid)) " +
                   "AND UPPER(c.status) IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'ASSIGNED')", nativeQuery = true)
    long countOpenComplaintsNative(@Param("orgId") UUID orgId);

    Page<Complaint> findAll(Pageable pageable);
}
