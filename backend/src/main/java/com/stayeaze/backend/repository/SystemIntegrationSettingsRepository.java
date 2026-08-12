package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.SystemIntegrationSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SystemIntegrationSettingsRepository extends JpaRepository<SystemIntegrationSettings, UUID> {
}
