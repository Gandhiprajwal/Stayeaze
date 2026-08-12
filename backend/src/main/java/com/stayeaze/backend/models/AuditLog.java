package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "audit_logs")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "org_id", nullable = false)
    private Organization organization;

    @Column(nullable = false, length = 150)
    private String username;

    @Column(nullable = false, length = 255)
    private String action;

    @Column(nullable = false)
    private OffsetDateTime timestamp = OffsetDateTime.now();

    @Column(name = "client_ip", length = 50)
    private String clientIp;

    public AuditLog() {
    }

    public AuditLog(Organization organization, String username, String action, String clientIp) {
        this.organization = organization;
        this.username = username;
        this.action = action;
        this.clientIp = clientIp;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public OffsetDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(OffsetDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }
}
