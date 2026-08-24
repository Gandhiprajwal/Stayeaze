package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SupportTicket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportTicketRepository extends JpaRepository<SupportTicket, UUID> {

    Optional<SupportTicket> findByTicketNumber(String ticketNumber);

    long countByStatus(String status);
    long countByPriority(String priority);
    long countByOrganizationAndStatus(Organization organization, String status);
    long countByCreatedBy_Id(UUID userId);
    long countByCreatedBy_IdAndStatus(UUID userId, String status);
    long countByEscalated(Boolean escalated);

    @Query("SELECT t FROM SupportTicket t WHERE " +
           "(:q IS NULL OR :q = '' OR LOWER(t.ticketNumber) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(t.title) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(t.organization.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(t.createdBy.email) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:status IS NULL OR :status = '' OR UPPER(t.status) = UPPER(:status)) " +
           "AND (:category IS NULL OR :category = '' OR UPPER(t.category) = UPPER(:category)) " +
           "ORDER BY t.createdAt DESC")
    Page<SupportTicket> searchAllTickets(
            @Param("q") String q,
            @Param("status") String status,
            @Param("category") String category,
            Pageable pageable
    );

    @Query("SELECT t FROM SupportTicket t WHERE " +
           "t.createdBy.id = :userId " +
           "AND (:q IS NULL OR :q = '' OR LOWER(t.ticketNumber) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(t.title) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(t.organization.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(t.createdBy.email) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "AND (:status IS NULL OR :status = '' OR UPPER(t.status) = UPPER(:status)) " +
           "AND (:category IS NULL OR :category = '' OR UPPER(t.category) = UPPER(:category)) " +
           "ORDER BY t.createdAt DESC")
    Page<SupportTicket> searchUserTickets(
            @Param("userId") UUID userId,
            @Param("q") String q,
            @Param("status") String status,
            @Param("category") String category,
            Pageable pageable
    );
}
