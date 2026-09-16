package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.CheckOut;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CheckOutRepository extends JpaRepository<CheckOut, UUID> {
    List<CheckOut> findByOrganization(Organization organization);

    @Query("SELECT c FROM CheckOut c WHERE c.organization.id = :orgId")
    List<CheckOut> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT c FROM CheckOut c WHERE c.organization.id = :orgId")
    Page<CheckOut> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query("SELECT c FROM CheckOut c WHERE c.organization.id = :orgId AND (" +
           "LOWER(c.tenantName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.roomNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.bedNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.reason) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.status) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.refundStatus) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<CheckOut> searchByOrganizationId(@Param("orgId") UUID orgId, @Param("search") String search, Pageable pageable);

    boolean existsByCode(String code);

    Page<CheckOut> findAll(Pageable pageable);
}
