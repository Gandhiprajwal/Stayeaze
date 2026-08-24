package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Invoice;
import com.stayeaze.backend.models.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByInvoice(Invoice invoice);

    @Query("SELECT p FROM Payment p WHERE p.invoice.tenant.organization.id = :orgId")
    List<Payment> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT p FROM Payment p WHERE p.invoice.tenant.organization.id = :orgId")
    Page<Payment> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query(value = "SELECT p.* FROM payments p JOIN invoices i ON p.invoice_id = i.id JOIN tenants t ON i.tenant_id = t.id WHERE t.org_id = CAST(:orgId AS uuid)", nativeQuery = true)
    List<Payment> findByOrganizationIdNative(@Param("orgId") UUID orgId);

    Page<Payment> findAll(Pageable pageable);
}
