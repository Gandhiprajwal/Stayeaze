package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Property;

import java.io.Serializable;
import java.util.UUID;

public class MinimalPropertyDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private String code;
    private String type;
    private String city;
    private String status;
    private String email;
    private String manager;
    private UUID orgId;
    private Integer totalBeds;
    private Integer occupiedBeds;

    public MinimalPropertyDTO() {
    }

    public MinimalPropertyDTO(UUID id, String name, String code, String type, String city, String status, String email, String manager, UUID orgId, Integer totalBeds, Integer occupiedBeds) {
        this.id = id;
        this.name = name;
        this.code = code;
        this.type = type;
        this.city = city;
        this.status = status;
        this.email = email;
        this.manager = manager;
        this.orgId = orgId;
        this.totalBeds = totalBeds;
        this.occupiedBeds = occupiedBeds;
    }

    public static MinimalPropertyDTO fromEntity(Property p) {
        if (p == null) return null;
        UUID orgId = null;
        try {
            if (p.getOrganization() != null) {
                orgId = p.getOrganization().getId();
            }
        } catch (Exception e) {
            // ignore uninitialized proxy
        }
        return new MinimalPropertyDTO(
                p.getId(),
                p.getName(),
                p.getCode(),
                p.getType(),
                p.getCity(),
                p.getStatus(),
                p.getEmail(),
                p.getManager(),
                orgId,
                p.getTotalBeds(),
                p.getOccupiedBeds()
        );
    }

    public static MinimalPropertyDTO fromProjection(com.stayeaze.backend.projection.MinimalPropertyView v) {
        if (v == null) return null;
        return new MinimalPropertyDTO(
                v.getId(),
                v.getName(),
                v.getCode(),
                v.getType(),
                v.getCity(),
                v.getStatus(),
                v.getEmail(),
                v.getManager(),
                v.getOrgId(),
                v.getTotalBeds(),
                v.getOccupiedBeds()
        );
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getManager() { return manager; }
    public void setManager(String manager) { this.manager = manager; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public Integer getTotalBeds() { return totalBeds; }
    public void setTotalBeds(Integer totalBeds) { this.totalBeds = totalBeds; }

    public Integer getOccupiedBeds() { return occupiedBeds; }
    public void setOccupiedBeds(Integer occupiedBeds) { this.occupiedBeds = occupiedBeds; }
}
