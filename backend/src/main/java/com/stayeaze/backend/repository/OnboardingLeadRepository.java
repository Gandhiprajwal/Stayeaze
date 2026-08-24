package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.OnboardingLead;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OnboardingLeadRepository extends JpaRepository<OnboardingLead, UUID> {
    List<OnboardingLead> findAllByOrderByCreatedAtDesc();
    List<OnboardingLead> findByPaymentStatusInOrderByCreatedAtDesc(List<String> statuses);
    Optional<OnboardingLead> findByOwnerEmailAndPropertyCode(String ownerEmail, String propertyCode);
    long countByStatusIgnoreCase(String status);
    long countByPaymentStatusIgnoreCase(String paymentStatus);

    @Query("SELECT l FROM OnboardingLead l WHERE " +
           "(:q IS NULL OR :q = '' OR LOWER(l.ownerName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.ownerEmail) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.propertyName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.propertyCode) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:status IS NULL OR :status = '' OR UPPER(l.status) = UPPER(:status)) " +
           "ORDER BY l.createdAt DESC")
    Page<OnboardingLead> searchLeads(@Param("q") String q,
                                     @Param("status") String status,
                                     Pageable pageable);

    @Query("SELECT COUNT(l) FROM OnboardingLead l WHERE l.paymentFailureCode IS NOT NULL OR UPPER(l.paymentStatus) IN ('PAYMENT_FAILED', 'PENDING_ONLINE_PAYMENT')")
    long countFailedCheckouts();

    @Query("SELECT l FROM OnboardingLead l WHERE " +
           "(l.paymentFailureCode IS NOT NULL OR UPPER(l.paymentStatus) IN ('PAYMENT_FAILED', 'PENDING_ONLINE_PAYMENT')) " +
           "AND (:q IS NULL OR :q = '' OR LOWER(l.ownerName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.ownerEmail) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.propertyName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.paymentFailureCode) LIKE LOWER(CONCAT('%', :q, '%')) " +
           " OR LOWER(l.propertyCode) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY l.createdAt DESC")
    Page<OnboardingLead> searchFailedCheckouts(@Param("q") String q, Pageable pageable);
}
