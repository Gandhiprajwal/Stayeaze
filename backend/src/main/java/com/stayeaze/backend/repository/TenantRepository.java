package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    List<Tenant> findByOrganization(Organization organization);
    Page<Tenant> findByOrganization(Organization organization, Pageable pageable);
    Page<Tenant> findAll(Pageable pageable);
    Optional<Tenant> findByIdAndOrganization(UUID id, Organization organization);
    Boolean existsByOrganizationAndMobile(Organization organization, String mobile);
    Boolean existsByOrganizationAndEmail(Organization organization, String email);
    Boolean existsByMobile(String mobile);
    Optional<Tenant> findFirstByMobile(String mobile);
    Optional<Tenant> findFirstByEmail(String email);
    Optional<Tenant> findFirstByOrganizationAndMobile(Organization organization, String mobile);
    Optional<Tenant> findFirstByOrganizationAndEmail(Organization organization, String email);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM tenants WHERE id = :id", nativeQuery = true)
    Optional<Tenant> findByIdSuperAdmin(@org.springframework.data.repository.query.Param("id") UUID id);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM tenants", nativeQuery = true)
    List<Tenant> findAllSuperAdmin();

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM tenants WHERE org_id = :orgId", nativeQuery = true)
    List<Tenant> findByOrganizationIdNative(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Tenant t WHERE t.organization = :org")
    long countByOrganization(@org.springframework.data.repository.query.Param("org") Organization organization);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Tenant t WHERE t.propertyId = :propertyId")
    long countByPropertyId(@org.springframework.data.repository.query.Param("propertyId") UUID propertyId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Tenant t WHERE t.organization = :org AND UPPER(t.status) = UPPER(:status)")
    long countByOrganizationAndStatus(@org.springframework.data.repository.query.Param("org") Organization organization, @org.springframework.data.repository.query.Param("status") String status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Tenant t WHERE t.propertyId = :propertyId AND UPPER(t.status) = UPPER(:status)")
    long countByPropertyIdAndStatus(@org.springframework.data.repository.query.Param("propertyId") UUID propertyId, @org.springframework.data.repository.query.Param("status") String status);
}
