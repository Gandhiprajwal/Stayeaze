package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.stayeaze.backend.payload.response.MinimalPropertyDTO;

import java.util.List;
import java.util.Optional;
import java.util.UUID;


@Repository
public interface PropertyRepository extends JpaRepository<Property, UUID> {
    List<Property> findByOrganization(Organization organization);
    List<Property> findByOrganizationAndStatusIgnoreCase(Organization organization, String status);
    List<Property> findByOrganizationId(UUID organizationId);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM properties WHERE org_id = :orgId", nativeQuery = true)
    List<Property> findAllByOrgId(@org.springframework.data.repository.query.Param("orgId") UUID orgId);
    Page<Property> findByOrganization(Organization organization, Pageable pageable);
    Page<Property> findAll(Pageable pageable);
    Optional<Property> findByIdAndOrganization(UUID id, Organization organization);
    List<Property> findByIdIn(List<UUID> ids);
    Page<Property> findByIdIn(List<UUID> ids, Pageable pageable);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM properties p ORDER BY p.created_at DESC",
        countQuery = "SELECT count(*) FROM properties",
        nativeQuery = true
    )
    Page<Property> findAllSuperAdminPaged(Pageable pageable);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM properties p ORDER BY p.created_at DESC", nativeQuery = true)
    List<Property> findAllSuperAdmin();

    // ── Optimised native projections ──────────────────────────────────────────
    // Uses native SQL interface projection: selects ONLY 11 scalar columns,
    // completely bypasses full entity hydration, eager joins, and Hibernate @TenantId interceptors.

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT p.id as id, p.name as name, p.code as code, p.type as type, p.city as city, " +
                "p.status as status, p.email as email, p.manager as manager, p.org_id as orgId, " +
                "p.total_beds as totalBeds, p.occupied_beds as occupiedBeds " +
                "FROM properties p ORDER BY p.created_at DESC",
        nativeQuery = true
    )
    List<com.stayeaze.backend.projection.MinimalPropertyView> findAllMinimalSuperAdminNative();

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT p.id as id, p.name as name, p.code as code, p.type as type, p.city as city, " +
                "p.status as status, p.email as email, p.manager as manager, p.org_id as orgId, " +
                "p.total_beds as totalBeds, p.occupied_beds as occupiedBeds " +
                "FROM properties p WHERE p.org_id = CAST(:organizationId AS uuid) ORDER BY p.created_at DESC",
        nativeQuery = true
    )
    List<com.stayeaze.backend.projection.MinimalPropertyView> findMinimalByOrgIdNative(@org.springframework.data.repository.query.Param("organizationId") UUID organizationId);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT p.id as id, p.name as name, p.code as code, p.type as type, p.city as city, " +
                "p.status as status, p.email as email, p.manager as manager, p.org_id as orgId, " +
                "p.total_beds as totalBeds, p.occupied_beds as occupiedBeds " +
                "FROM properties p WHERE p.id IN (:ids) ORDER BY p.created_at DESC",
        nativeQuery = true
    )
    List<com.stayeaze.backend.projection.MinimalPropertyView> findMinimalByIdsNative(@org.springframework.data.repository.query.Param("ids") List<UUID> ids);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM properties p WHERE p.id = CAST(:id AS uuid)", nativeQuery = true)
    Optional<Property> findByIdSuperAdmin(@org.springframework.data.repository.query.Param("id") UUID id);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM properties p WHERE p.org_id = CAST(:orgId AS uuid) ORDER BY p.created_at DESC", nativeQuery = true)
    List<Property> findByOrganizationIdNative(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM properties p WHERE p.org_id IN (:orgIds) ORDER BY p.created_at DESC", nativeQuery = true)
    List<Property> findByOrganizationIdsNative(@org.springframework.data.repository.query.Param("orgIds") List<UUID> orgIds);

    @org.springframework.data.jpa.repository.Query("SELECT p.id as id, p.name as name, p.code as code FROM Property p WHERE p.organization.id = :organizationId")
    List<com.stayeaze.backend.projection.MinimalPropertyProjection> findMinimalByOrganizationId(@org.springframework.data.repository.query.Param("organizationId") UUID organizationId);

    @org.springframework.data.jpa.repository.Query(value = "SELECT count(*) FROM properties", nativeQuery = true)
    long countSuperAdmin();

    @org.springframework.data.jpa.repository.Query(value = "SELECT COALESCE(SUM(total_beds), 0) FROM properties", nativeQuery = true)
    long sumTotalBedsNative();

    @org.springframework.data.jpa.repository.Query(value = "SELECT CAST(p.org_id AS text) as orgId, count(p.id) as count FROM properties p WHERE p.org_id IN (:orgIds) GROUP BY p.org_id", nativeQuery = true)
    List<Object[]> countPropertiesByOrgIdsNative(@org.springframework.data.repository.query.Param("orgIds") List<UUID> orgIds);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(p.totalBeds), 0) FROM Property p")
    long sumTotalBeds();
}
