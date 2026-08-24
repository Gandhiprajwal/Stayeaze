package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SubscriptionExtensionRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SubscriptionExtensionRequestRepository extends JpaRepository<SubscriptionExtensionRequest, UUID> {

    List<SubscriptionExtensionRequest> findByStatusOrderByCreatedAtDesc(String status);

    List<SubscriptionExtensionRequest> findByOrganizationOrderByCreatedAtDesc(Organization organization);

    Page<SubscriptionExtensionRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT r FROM SubscriptionExtensionRequest r WHERE " +
           "(:status IS NULL OR :status = '' OR UPPER(r.status) = UPPER(:status)) AND " +
           "(:search IS NULL OR :search = '' OR " +
           "LOWER(r.organization.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(r.organization.subdomain) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(r.requestedBy.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(r.reason) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY r.createdAt DESC")
    Page<SubscriptionExtensionRequest> searchRequests(
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable);

    long countByStatus(String status);
}
