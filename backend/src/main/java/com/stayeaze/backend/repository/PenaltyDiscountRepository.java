package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.PenaltyDiscount;
import com.stayeaze.backend.models.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PenaltyDiscountRepository extends JpaRepository<PenaltyDiscount, UUID> {
    List<PenaltyDiscount> findByTenant(Tenant tenant);
    Optional<PenaltyDiscount> findByIdAndTenant(UUID id, Tenant tenant);
}
