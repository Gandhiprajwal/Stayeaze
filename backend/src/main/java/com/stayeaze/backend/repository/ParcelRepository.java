package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Parcel;
import com.stayeaze.backend.models.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ParcelRepository extends JpaRepository<Parcel, UUID> {
    List<Parcel> findByTenant(Tenant tenant);

    Optional<Parcel> findByIdAndTenant(UUID id, Tenant tenant);

    List<Parcel> findByOrganization(Organization organization);

    @Query("SELECT p FROM Parcel p LEFT JOIN p.tenant t WHERE (p.organization IS NOT NULL AND p.organization.id = :orgId) OR (t IS NOT NULL AND t.organization.id = :orgId) ORDER BY p.receivedDate DESC")
    List<Parcel> findByOrganizationId(@Param("orgId") UUID orgId);
}
