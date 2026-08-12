package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Maintenance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MaintenanceRepository extends JpaRepository<Maintenance, UUID> {
    @Query("SELECT m FROM Maintenance m WHERE m.organization.id = :orgId")
    List<Maintenance> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT m FROM Maintenance m WHERE m.organization.id = :orgId")
    Page<Maintenance> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    Page<Maintenance> findAll(Pageable pageable);
}
