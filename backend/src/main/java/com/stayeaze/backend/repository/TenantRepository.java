package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    List<Tenant> findByOrganization(Organization organization);
    Page<Tenant> findByOrganization(Organization organization, Pageable pageable);
    Page<Tenant> findAll(Pageable pageable);
    Optional<Tenant> findByIdAndOrganization(UUID id, Organization organization);
    Boolean existsByOrganizationAndMobile(Organization organization, String mobile);
    Boolean existsByMobile(String mobile);
    Optional<Tenant> findFirstByMobile(String mobile);
    Optional<Tenant> findFirstByEmail(String email);
}
