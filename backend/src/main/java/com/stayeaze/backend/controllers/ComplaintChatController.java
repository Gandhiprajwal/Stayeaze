package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Complaint;
import com.stayeaze.backend.models.ComplaintChatMessage;
import com.stayeaze.backend.repository.ComplaintChatMessageRepository;
import com.stayeaze.backend.repository.ComplaintRepository;
import com.stayeaze.backend.services.WebSocketNotificationService;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/complaints")
public class ComplaintChatController {

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private ComplaintChatMessageRepository chatMessageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WebSocketNotificationService webSocketNotificationService;

    // Fetch complaint ticket chat history
    @GetMapping("/{id}/messages")
    public ResponseEntity<?> getComplaintChatHistory(@PathVariable UUID id) {
        List<ComplaintChatMessage> messages = chatMessageRepository.findByComplaintIdNative(id);

        List<Map<String, Object>> response = new ArrayList<>();
        for (ComplaintChatMessage msg : messages) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", msg.getId());
            map.put("senderId", msg.getSenderId());
            map.put("senderName", msg.getSenderName());
            map.put("senderRole", msg.getSenderRole());
            map.put("message", msg.getMessage());
            map.put("createdAt", msg.getCreatedAt());
            response.add(map);
        }

        return ResponseEntity.ok(response);
    }

    // HTTP Post fallback for chat message
    @PostMapping("/{id}/messages")
    public ResponseEntity<?> sendComplaintChatMessage(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        Complaint complaint = complaintRepository.findById(id)
                .orElseGet(() -> complaintRepository.findByIdNative(id).orElse(null));
        if (complaint == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Error: Complaint ticket not found."));
        }

        String messageText = body.get("message") != null ? body.get("message").toString().trim() : "";
        if (messageText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Message text cannot be empty."));
        }

        Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                : null;
        UserDetailsImpl userDetails = (principal instanceof UserDetailsImpl) ? (UserDetailsImpl) principal : null;

        UUID senderId = userDetails != null ? userDetails.getId() : null;
        String senderName = body.get("senderName") != null ? body.get("senderName").toString() : "User";
        String senderRole = body.get("senderRole") != null ? body.get("senderRole").toString() : "TENANT";

        if (userDetails != null) {
            User sender = userRepository.findById(userDetails.getId()).orElse(null);
            if (sender != null) {
                if (sender.getFirstName() != null && !sender.getFirstName().isBlank()) {
                    senderName = sender.getFirstName();
                } else if (sender.getEmail() != null) {
                    senderName = sender.getEmail();
                }
                if (sender.getRoles() != null && !sender.getRoles().isEmpty()) {
                    com.stayeaze.backend.models.Role r = sender.getRoles().iterator().next();
                    if (r != null && r.getName() != null) {
                        senderRole = r.getName();
                    }
                }
            }
        }

        ComplaintChatMessage chatMsg = new ComplaintChatMessage(complaint, senderId, senderName, senderRole, messageText);
        ComplaintChatMessage saved = chatMessageRepository.save(chatMsg);

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", saved.getId());
        payload.put("complaintId", id);
        payload.put("senderId", saved.getSenderId());
        payload.put("senderName", saved.getSenderName());
        payload.put("senderRole", saved.getSenderRole());
        payload.put("message", saved.getMessage());
        payload.put("createdAt", saved.getCreatedAt());

        // Broadcast to general complaints channel (for unread badges & table refetch)
        webSocketNotificationService.broadcastTopic("/topic/complaints", payload);
        webSocketNotificationService.broadcastTopic("/topic/complaints/" + id, payload);
        webSocketNotificationService.broadcastTopic("/topic/complaints/" + id + "/messages", payload);

        if (complaint.getTenant() != null && complaint.getTenant().getEmail() != null) {
            userRepository.findByEmail(complaint.getTenant().getEmail()).ifPresent(tenantUser -> {
                webSocketNotificationService.broadcastTopic("/topic/notifications/" + tenantUser.getId(), payload);
            });
        }

        return ResponseEntity.ok(payload);
    }

    // STOMP Message Handler
    @MessageMapping("/complaint/{ticketId}/chat")
    public void handleStompChatMessage(@DestinationVariable UUID ticketId, @Payload Map<String, Object> body) {
        try {
            Complaint complaint = complaintRepository.findById(ticketId)
                    .orElseGet(() -> complaintRepository.findByIdNative(ticketId).orElse(null));
            if (complaint == null) return;

            String senderName = body.get("senderName") != null ? body.get("senderName").toString() : "User";
            String senderRole = body.get("senderRole") != null ? body.get("senderRole").toString() : "TENANT";
            String messageText = body.get("message") != null ? body.get("message").toString() : "";
            UUID senderId = null;
            if (body.get("senderId") != null) {
                try { senderId = UUID.fromString(body.get("senderId").toString()); } catch (Exception ignored) {}
            }

            ComplaintChatMessage chatMsg = new ComplaintChatMessage(complaint, senderId, senderName, senderRole, messageText);
            ComplaintChatMessage saved = chatMessageRepository.save(chatMsg);

            Map<String, Object> payload = new HashMap<>();
            payload.put("id", saved.getId());
            payload.put("complaintId", ticketId);
            payload.put("senderId", saved.getSenderId());
            payload.put("senderName", saved.getSenderName());
            payload.put("senderRole", saved.getSenderRole());
            payload.put("message", saved.getMessage());
            payload.put("createdAt", saved.getCreatedAt());

            webSocketNotificationService.broadcastTopic("/topic/complaints", payload);
            webSocketNotificationService.broadcastTopic("/topic/complaints/" + ticketId, payload);
            webSocketNotificationService.broadcastTopic("/topic/complaints/" + ticketId + "/messages", payload);

            if (complaint.getTenant() != null && complaint.getTenant().getEmail() != null) {
                userRepository.findByEmail(complaint.getTenant().getEmail()).ifPresent(tenantUser -> {
                    webSocketNotificationService.broadcastTopic("/topic/notifications/" + tenantUser.getId(), payload);
                });
            }
        } catch (Exception ignored) {}
    }
}
