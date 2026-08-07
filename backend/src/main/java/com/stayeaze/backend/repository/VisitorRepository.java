package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.Visitor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VisitorRepository extends JpaRepository<Visitor, UUID> {
    List<Visitor> findByTenant(Tenant tenant);
    Optional<Visitor> findByIdAndTenant(UUID id, Tenant tenant);

    @Query("SELECT v FROM Visitor v WHERE v.tenant.organization.id = :orgId")
    List<Visitor> findByOrganizationId(@Param("orgId") UUID orgId);
}
