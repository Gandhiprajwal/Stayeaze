package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
    Optional<Organization> findBySubdomain(String subdomain);
    Boolean existsBySubdomain(String subdomain);

    @Query(
        value = "SELECT o FROM Organization o WHERE LOWER(o.subdomain) <> 'system' " +
                "AND (:q IS NULL OR :q = '' OR LOWER(o.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
                "     OR LOWER(o.subdomain) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                "AND (:status IS NULL OR :status = '' OR UPPER(o.status) = UPPER(:status)) " +
                "ORDER BY o.createdAt DESC",
        countQuery = "SELECT count(o) FROM Organization o WHERE LOWER(o.subdomain) <> 'system' " +
                     "AND (:q IS NULL OR :q = '' OR LOWER(o.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
                     "     OR LOWER(o.subdomain) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                     "AND (:status IS NULL OR :status = '' OR UPPER(o.status) = UPPER(:status))"
    )
    Page<Organization> searchOrganizations(@Param("q") String q,
                                           @Param("status") String status,
                                           Pageable pageable);

    /**
     * Enterprise filter: JOINs billing profile and filters orgs where
     * customBrandingEnabled = true OR plan name contains 'enterprise'.
     * Used when the frontend selects the "Enterprise & White-Label" pill.
     */
    @Query(
        value = "SELECT DISTINCT o FROM Organization o " +
                "LEFT JOIN OrganizationBillingProfile bp ON bp.organization.id = o.id " +
                "WHERE LOWER(o.subdomain) <> 'system' " +
                "AND (:q IS NULL OR :q = '' OR LOWER(o.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
                "     OR LOWER(o.subdomain) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                "AND (bp.customBrandingEnabled = true OR LOWER(bp.subscriptionPlanName) LIKE '%enterprise%') " +
                "ORDER BY o.createdAt DESC",
        countQuery = "SELECT count(DISTINCT o) FROM Organization o " +
                     "LEFT JOIN OrganizationBillingProfile bp ON bp.organization.id = o.id " +
                     "WHERE LOWER(o.subdomain) <> 'system' " +
                     "AND (:q IS NULL OR :q = '' OR LOWER(o.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
                     "     OR LOWER(o.subdomain) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                     "AND (bp.customBrandingEnabled = true OR LOWER(bp.subscriptionPlanName) LIKE '%enterprise%')"
    )
    Page<Organization> searchEnterpriseOrganizations(@Param("q") String q, Pageable pageable);

    @Query("SELECT COUNT(o) FROM Organization o WHERE LOWER(o.subdomain) <> 'system'")
    long countNonSystemOrganizations();

    @Query("SELECT COUNT(o) FROM Organization o WHERE LOWER(o.subdomain) <> 'system' AND UPPER(o.status) = UPPER(:status)")
    long countNonSystemOrganizationsByStatus(@Param("status") String status);
}
