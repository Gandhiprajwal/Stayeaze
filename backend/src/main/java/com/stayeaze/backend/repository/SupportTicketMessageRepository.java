package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.SupportTicket;
import com.stayeaze.backend.models.SupportTicketMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportTicketMessageRepository extends JpaRepository<SupportTicketMessage, UUID> {

    List<SupportTicketMessage> findByTicketOrderByCreatedAtAsc(SupportTicket ticket);

    long countByTicket(SupportTicket ticket);

    Optional<SupportTicketMessage> findTopByTicketOrderByCreatedAtDesc(SupportTicket ticket);
}
