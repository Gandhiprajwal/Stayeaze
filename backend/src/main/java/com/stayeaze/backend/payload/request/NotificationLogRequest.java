package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;

public class NotificationLogRequest {
    @NotBlank
    private String recipient;

    @NotBlank
    private String type; // SMS, EMAIL, WHATSAPP

    @NotBlank
    private String messageContent;

    public NotificationLogRequest() {
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
}
