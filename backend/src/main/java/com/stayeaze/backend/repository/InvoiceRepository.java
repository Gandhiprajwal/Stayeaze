package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Invoice;
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
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    List<Invoice> findByTenant(Tenant tenant);
    Optional<Invoice> findByIdAndTenant(UUID id, Tenant tenant);
    boolean existsByInvoiceNumber(String invoiceNumber);

    @Query("SELECT i FROM Invoice i JOIN FETCH i.tenant t WHERE t.organization.id = :orgId")
    List<Invoice> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT i FROM Invoice i JOIN FETCH i.tenant t WHERE t.organization.id = :orgId",
           countQuery = "SELECT count(i) FROM Invoice i WHERE i.tenant.organization.id = :orgId")
    Page<Invoice> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.tenant.propertyId = :propertyId AND i.issueDate >= :startDate AND i.issueDate <= :endDate")
    long countByPropertyIdAndFinancialYear(@Param("propertyId") UUID propertyId, @Param("startDate") java.time.LocalDate startDate, @Param("endDate") java.time.LocalDate endDate);

    @Query(value = "SELECT i.* FROM invoices i JOIN tenants t ON i.tenant_id = t.id WHERE t.org_id = CAST(:orgId AS uuid)", nativeQuery = true)
    List<Invoice> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    @Query("SELECT i FROM Invoice i JOIN FETCH i.tenant t WHERE t.organization.id = :orgId AND (:propertyId IS NULL OR t.propertyId = :propertyId)")
    List<Invoice> findByOrganizationIdAndOptionalPropertyId(@Param("orgId") UUID orgId, @Param("propertyId") UUID propertyId);

    @Query("SELECT i FROM Invoice i JOIN FETCH i.tenant t")
    List<Invoice> findAllWithTenant();

    Page<Invoice> findAll(Pageable pageable);
}
