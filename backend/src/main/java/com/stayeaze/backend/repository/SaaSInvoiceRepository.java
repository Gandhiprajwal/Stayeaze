package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SaaSInvoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface SaaSInvoiceRepository extends JpaRepository<SaaSInvoice, UUID> {
    List<SaaSInvoice> findByOrganization(Organization organization);
    List<SaaSInvoice> findByOrganizationOrderByInvoiceDateDesc(Organization organization);
    boolean existsByInvoiceNumber(String invoiceNumber);
    long countByStatus(String status);

    @Query("SELECT i FROM SaaSInvoice i WHERE " +
           "(:query IS NULL OR :query = '' OR LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :query, '%')) " +
           " OR LOWER(i.organization.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
           " OR LOWER(i.planName) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "AND (:status IS NULL OR :status = '' OR UPPER(i.status) = UPPER(:status)) " +
           "AND (i.invoiceDate >= :fromDate AND i.invoiceDate <= :toDate)")
    Page<SaaSInvoice> searchInvoices(@Param("query") String query,
                                     @Param("status") String status,
                                     @Param("fromDate") OffsetDateTime fromDate,
                                     @Param("toDate") OffsetDateTime toDate,
                                     Pageable pageable);
}

