package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Agreement;
import com.stayeaze.backend.models.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgreementRepository extends JpaRepository<Agreement, UUID> {
    List<Agreement> findByTenant(Tenant tenant);
    Optional<Agreement> findByIdAndTenant(UUID id, Tenant tenant);
}
