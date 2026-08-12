package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationBillingProfileRepository extends JpaRepository<OrganizationBillingProfile, UUID> {
    Optional<OrganizationBillingProfile> findByOrganization(Organization organization);
}
