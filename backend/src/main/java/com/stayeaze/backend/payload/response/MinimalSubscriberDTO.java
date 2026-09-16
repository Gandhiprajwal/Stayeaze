package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Organization;

import java.io.Serializable;
import java.util.UUID;

public class MinimalSubscriberDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private String subdomain;
    private String planName;
    private String status;

    public MinimalSubscriberDTO() {}

    public static MinimalSubscriberDTO fromEntity(Organization org) {
        if (org == null) return null;
        MinimalSubscriberDTO dto = new MinimalSubscriberDTO();
        dto.setId(org.getId());
        dto.setName(org.getName());
        dto.setSubdomain(org.getSubdomain());
        dto.setPlanName("Professional Plan");
        dto.setStatus(org.getStatus() != null ? org.getStatus().toLowerCase() : "active");
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSubdomain() { return subdomain; }
    public void setSubdomain(String subdomain) { this.subdomain = subdomain; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
