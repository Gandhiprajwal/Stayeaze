package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Invoice;
import com.stayeaze.backend.models.Tenant;
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

    @Query("SELECT i FROM Invoice i WHERE i.tenant.organization.id = :orgId")
    List<Invoice> findByOrganizationId(@Param("orgId") UUID orgId);
}
