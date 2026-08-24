package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SystemConfigRepository extends JpaRepository<SystemConfig, UUID> {
    Optional<SystemConfig> findByOrganization(Organization organization);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM system_configs LIMIT 1", nativeQuery = true)
    Optional<SystemConfig> findFirstNative();
}
