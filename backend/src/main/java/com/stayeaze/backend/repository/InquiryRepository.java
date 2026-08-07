package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Inquiry;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InquiryRepository extends JpaRepository<Inquiry, UUID> {
    List<Inquiry> findByOrganization(Organization organization);
    Optional<Inquiry> findByIdAndOrganization(UUID id, Organization organization);
}
