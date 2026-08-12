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

    @Query("SELECT c FROM Complaint c WHERE c.tenant.organization.id = :orgId")
    List<Complaint> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT c FROM Complaint c WHERE c.tenant.organization.id = :orgId")
    Page<Complaint> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    Page<Complaint> findAll(Pageable pageable);
}
