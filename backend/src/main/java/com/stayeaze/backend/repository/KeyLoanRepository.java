package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.KeyLoan;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KeyLoanRepository extends JpaRepository<KeyLoan, UUID> {
    List<KeyLoan> findByOrganizationOrderByCreatedAtDesc(Organization organization);
    
    @Query("SELECT k FROM KeyLoan k WHERE k.organization = :org AND k.property.id = :propId ORDER BY k.createdAt DESC")
    List<KeyLoan> findByOrganizationAndPropertyIdOrderByCreatedAtDesc(@Param("org") Organization organization, @Param("propId") UUID propertyId);
    
    List<KeyLoan> findByOrganizationAndStatus(Organization organization, String status);
}
