package com.stayeaze.backend.services.interfaces;

import java.util.UUID;

/**
 * Service contract for real-time STOMP / WebSocket notification broadcasts.
 */
public interface IWebSocketNotificationService {

    /**
     * Dispatches a private notification payload to a specific user's STOMP queue.
     *
     * @param userId unique user identifier
     * @param title alert title
     * @param message notification body
     * @param type alert type (INFO, WARNING, ERROR, SUCCESS)
     */
    void sendUserNotification(UUID userId, String title, String message, String type);

    /**
     * Broadcasts an arbitrary payload to a global or multi-subscriber STOMP topic.
     *
     * @param topic target STOMP destination path (e.g. /topic/super-admin/onboarding)
     * @param payload object payload to serialize and broadcast
     */
    void broadcastTopic(String topic, Object payload);
}
