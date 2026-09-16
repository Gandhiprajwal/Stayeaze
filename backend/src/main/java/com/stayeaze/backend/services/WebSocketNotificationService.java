package com.stayeaze.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import com.stayeaze.backend.services.interfaces.IWebSocketNotificationService;

@Service
public class WebSocketNotificationService implements IWebSocketNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketNotificationService.class);

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    @Override
    public void sendUserNotification(UUID userId, String title, String message, String type) {
        if (messagingTemplate == null || userId == null) {
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", UUID.randomUUID().toString());
        payload.put("title", title);
        payload.put("message", message);
        payload.put("type", type != null ? type : "INFO");
        payload.put("timestamp", System.currentTimeMillis());

        try {
            messagingTemplate.convertAndSend("/topic/notifications/" + userId, payload);
            logger.info("📡 STOMP notification sent to user {}: {}", userId, title);
        } catch (Exception e) {
            logger.warn("⚠️ Failed to dispatch STOMP notification to user {}: {}", userId, e.getMessage());
        }
    }

    @Override
    public void broadcastTopic(String topic, Object payload) {
        if (messagingTemplate == null) {
            return;
        }

        try {
            messagingTemplate.convertAndSend(topic, payload);
            logger.info("📡 STOMP broadcast sent to topic {}: {}", topic, payload);
        } catch (Exception e) {
            logger.warn("⚠️ Failed to broadcast STOMP payload to topic {}: {}", topic, e.getMessage());
        }
    }
}
