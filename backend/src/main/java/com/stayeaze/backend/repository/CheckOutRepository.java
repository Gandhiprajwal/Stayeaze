package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.CheckOut;
import com.stayeaze.backend.models.Organization;
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
}
