package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.FrontDeskShiftHandover;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FrontDeskShiftHandoverRepository extends JpaRepository<FrontDeskShiftHandover, UUID> {
    List<FrontDeskShiftHandover> findByOrganizationOrderByCreatedAtDesc(Organization organization);
    List<FrontDeskShiftHandover> findByOrganizationAndPropertyIdOrderByCreatedAtDesc(Organization organization, UUID propertyId);
    List<FrontDeskShiftHandover> findByOrganizationAndStatus(Organization organization, String status);
}
