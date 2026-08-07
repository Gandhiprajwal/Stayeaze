package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.CheckIn;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CheckInRepository extends JpaRepository<CheckIn, UUID> {
    List<CheckIn> findByOrganization(Organization organization);

    @Query("SELECT c FROM CheckIn c WHERE c.organization.id = :orgId")
    List<CheckIn> findByOrganizationId(@Param("orgId") UUID orgId);
}
