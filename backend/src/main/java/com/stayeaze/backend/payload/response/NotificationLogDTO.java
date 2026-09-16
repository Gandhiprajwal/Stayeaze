package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.NotificationLog;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

public class NotificationLogDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID orgId;
    private String organizationName;
    private String recipient;
    private String type;
    private String messageContent;
    private String status;
    private OffsetDateTime createdAt;

    public NotificationLogDTO() {
    }

    public static NotificationLogDTO fromEntity(NotificationLog log) {
        if (log == null) return null;
        NotificationLogDTO dto = new NotificationLogDTO();
        dto.setId(log.getId());
        dto.setRecipient(log.getRecipient());
        dto.setType(log.getType());
        dto.setMessageContent(log.getMessageContent());
        dto.setStatus(log.getStatus());
        dto.setCreatedAt(log.getCreatedAt());

        try {
            if (log.getOrganization() != null) {
                dto.setOrgId(log.getOrganization().getId());
                dto.setOrganizationName(log.getOrganization().getName());
            }
        } catch (Exception ignored) {
            // gracefully protect against lazy proxy initialization outside session
        }

        return dto;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOrgId() {
        return orgId;
    }

    public void setOrgId(UUID orgId) {
        this.orgId = orgId;
    }

    public String getOrganizationName() {
        return organizationName;
    }

    public void setOrganizationName(String organizationName) {
        this.organizationName = organizationName;
    }

    public String getRecipient() {
        return recipient;
    }

    public void setRecipient(String recipient) {
        this.recipient = recipient;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessageContent() {
        return messageContent;
    }

    public void setMessageContent(String messageContent) {
        this.messageContent = messageContent;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
