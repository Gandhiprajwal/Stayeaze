package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.UserJourneyAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserJourneyAuditRepository extends JpaRepository<UserJourneyAudit, UUID>, JpaSpecificationExecutor<UserJourneyAudit> {

    Page<UserJourneyAudit> findByOrgIdOrderByCreatedAtDesc(UUID orgId, Pageable pageable);

    @Query(
        value = "SELECT u FROM UserJourneyAudit u WHERE " +
                "(:category IS NULL OR :category = '' OR UPPER(u.category) = UPPER(:category)) AND " +
                "(:status IS NULL OR :status = '' OR UPPER(u.status) = UPPER(:status)) AND " +
                "(:q IS NULL OR :q = '' OR " +
                " LOWER(u.userEmail) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.orgName) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.action) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.resourceId) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.clientIp) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                "ORDER BY u.createdAt DESC",
        countQuery = "SELECT count(u) FROM UserJourneyAudit u WHERE " +
                     "(:category IS NULL OR :category = '' OR UPPER(u.category) = UPPER(:category)) AND " +
                     "(:status IS NULL OR :status = '' OR UPPER(u.status) = UPPER(:status)) AND " +
                     "(:q IS NULL OR :q = '' OR " +
                     " LOWER(u.userEmail) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.orgName) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.action) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.resourceId) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.clientIp) LIKE LOWER(CONCAT('%', :q, '%')))"
    )
    Page<UserJourneyAudit> searchAuditsAllOrgs(
            @Param("category") String category,
            @Param("status") String status,
            @Param("q") String q,
            Pageable pageable);

    @Query(
        value = "SELECT u FROM UserJourneyAudit u WHERE " +
                "u.orgId = :orgId AND " +
                "(:category IS NULL OR :category = '' OR UPPER(u.category) = UPPER(:category)) AND " +
                "(:status IS NULL OR :status = '' OR UPPER(u.status) = UPPER(:status)) AND " +
                "(:q IS NULL OR :q = '' OR " +
                " LOWER(u.userEmail) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.orgName) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.action) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.resourceId) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                " LOWER(u.clientIp) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                "ORDER BY u.createdAt DESC",
        countQuery = "SELECT count(u) FROM UserJourneyAudit u WHERE " +
                     "u.orgId = :orgId AND " +
                     "(:category IS NULL OR :category = '' OR UPPER(u.category) = UPPER(:category)) AND " +
                     "(:status IS NULL OR :status = '' OR UPPER(u.status) = UPPER(:status)) AND " +
                     "(:q IS NULL OR :q = '' OR " +
                     " LOWER(u.userEmail) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.orgName) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.action) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.resourceId) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
                     " LOWER(u.clientIp) LIKE LOWER(CONCAT('%', :q, '%')))"
    )
    Page<UserJourneyAudit> searchAuditsByOrg(
            @Param("orgId") UUID orgId,
            @Param("category") String category,
            @Param("status") String status,
            @Param("q") String q,
            Pageable pageable);

    default Page<UserJourneyAudit> searchAudits(UUID orgId, String category, String status, String q, Pageable pageable) {
        if (orgId != null) {
            return searchAuditsByOrg(orgId, category, status, q, pageable);
        } else {
            return searchAuditsAllOrgs(category, status, q, pageable);
        }
    }

    @Query("SELECT u FROM UserJourneyAudit u WHERE " +
           "u.status IN ('WARNING', 'CRITICAL') OR " +
           "u.action LIKE '%ANOMALY%' OR " +
           "u.action LIKE '%FAILED%' " +
           "ORDER BY u.createdAt DESC")
    List<UserJourneyAudit> findTopAnomalies(Pageable pageable);

    @Query("SELECT u FROM UserJourneyAudit u WHERE " +
           "LOWER(u.userEmail) = LOWER(:email) OR " +
           "(:userId IS NOT NULL AND u.userId = :userId) " +
           "ORDER BY u.createdAt DESC")
    List<UserJourneyAudit> findUserTimeline(
            @Param("email") String email,
            @Param("userId") UUID userId,
            Pageable pageable);

    Optional<UserJourneyAudit> findFirstByResourceIdOrderByCreatedAtDesc(String resourceId);

    List<UserJourneyAudit> findByResourceIdOrderByCreatedAtDesc(String resourceId);

    @Query("SELECT COUNT(u) FROM UserJourneyAudit u")
    long countTotalEvents();

    @Query("SELECT COUNT(u) FROM UserJourneyAudit u WHERE u.category IN ('SAAS_BILLING', 'TENANT_RENT') AND u.status = 'FAILURE'")
    long countPaymentFailures();

    @Query("SELECT COUNT(u) FROM UserJourneyAudit u WHERE u.status = 'CRITICAL' OR u.action LIKE '%ANOMALY%'")
    long countCriticalAnomalies();

    @Query("SELECT COUNT(u) FROM UserJourneyAudit u WHERE u.category = 'AUTH' AND u.status = 'FAILURE'")
    long countAuthFailures();
}
