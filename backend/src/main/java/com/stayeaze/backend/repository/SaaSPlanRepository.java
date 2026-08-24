package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.SaaSPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SaaSPlanRepository extends JpaRepository<SaaSPlan, UUID> {
    List<SaaSPlan> findByIsActiveTrue();
    Optional<SaaSPlan> findByPlanKey(String planKey);
    Optional<SaaSPlan> findByNameIgnoreCase(String name);
}
