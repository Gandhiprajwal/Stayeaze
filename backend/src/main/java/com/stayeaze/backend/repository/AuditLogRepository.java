package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.AuditLog;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findByOrganization(Organization organization);
    Page<AuditLog> findByOrganization(Organization organization, Pageable pageable);
    Page<AuditLog> findByOrganizationOrderByTimestampDesc(Organization organization, Pageable pageable);
    Page<AuditLog> findAll(Pageable pageable);
    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);
}
