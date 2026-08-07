package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.BillingPlan;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BillingPlanRepository extends JpaRepository<BillingPlan, UUID> {
    List<BillingPlan> findByOrganization(Organization organization);
    Optional<BillingPlan> findByIdAndOrganization(UUID id, Organization organization);
}
