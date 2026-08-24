package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Complaint;
import com.stayeaze.backend.models.ComplaintChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface ComplaintChatMessageRepository extends JpaRepository<ComplaintChatMessage, UUID> {
    List<ComplaintChatMessage> findByComplaintOrderByCreatedAtAsc(Complaint complaint);

    @Query(value = "SELECT * FROM complaint_chat_messages WHERE complaint_id = CAST(:complaintId AS uuid) ORDER BY created_at ASC", nativeQuery = true)
    List<ComplaintChatMessage> findByComplaintIdNative(@Param("complaintId") UUID complaintId);
}
