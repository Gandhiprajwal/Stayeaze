package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationBillingProfileRepository extends JpaRepository<OrganizationBillingProfile, UUID> {
    Optional<OrganizationBillingProfile> findByOrganization(Organization organization);
    Optional<OrganizationBillingProfile> findByOrganizationId(UUID orgId);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM organization_billing_profiles WHERE org_id = :orgId LIMIT 1", nativeQuery = true)
    Optional<OrganizationBillingProfile> findByOrgIdNative(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query(value = "SELECT * FROM organization_billing_profiles ORDER BY updated_at DESC NULLS LAST LIMIT 1", nativeQuery = true)
    Optional<OrganizationBillingProfile> findFirstNative();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(p) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system' AND (p.customBrandingEnabled = true OR LOWER(p.subscriptionPlanName) LIKE '%enterprise%')")
    long countEnterpriseProfiles();

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(p.subscriptionPlanPrice), 0) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system' AND UPPER(p.subscriptionStatus) = 'ACTIVE'")
    java.math.BigDecimal sumActiveMonthlyRevenue();

    Optional<OrganizationBillingProfile> findByRefundId(String refundId);
    Optional<OrganizationBillingProfile> findBySubscriptionPaymentId(String paymentId);
    java.util.List<OrganizationBillingProfile> findByRefundStatusIsNotNull();

    @org.springframework.data.jpa.repository.Query("SELECT bp FROM OrganizationBillingProfile bp WHERE bp.organization.id IN (:orgIds)")
    java.util.List<OrganizationBillingProfile> findByOrganizationIds(@org.springframework.data.repository.query.Param("orgIds") java.util.List<UUID> orgIds);

    @org.springframework.data.jpa.repository.Query("SELECT bp FROM OrganizationBillingProfile bp JOIN FETCH bp.organization o WHERE LOWER(o.subdomain) <> 'system'")
    java.util.List<OrganizationBillingProfile> findAllNonSystemProfilesWithOrganization();

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(p.refundAmount), 0) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system'")
    java.math.BigDecimal sumTotalRefunded();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(p) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system' AND UPPER(p.refundStatus) IN ('PROCESSING_BY_BANK', 'INITIATED')")
    long countPendingSettlements();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(p) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system' AND UPPER(p.refundStatus) IN ('SETTLED_TO_SOURCE', 'REFUNDED_VIA_RAZORPAY')")
    long countSettledToSource();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(p) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system' AND UPPER(p.refundStatus) IN ('REFUND_FAILED', 'MANUAL_REQUIRED')")
    long countFailedRefunds();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(p) FROM OrganizationBillingProfile p JOIN p.organization o WHERE LOWER(o.subdomain) <> 'system' AND (p.subscriptionPaymentId IS NOT NULL OR p.refundId IS NOT NULL OR p.refundStatus IS NOT NULL)")
    long countTotalRefundRecords();
}
