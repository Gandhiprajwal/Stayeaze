package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.TenantDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantDocumentRepository extends JpaRepository<TenantDocument, UUID> {
    List<TenantDocument> findByTenant(Tenant tenant);
    Optional<TenantDocument> findByIdAndTenant(UUID id, Tenant tenant);
}
