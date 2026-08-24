package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Property;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

public class PropertySummaryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private String code;
    private String city;
    private String state;
    private Integer totalBeds;
    private Integer occupiedBeds;
    private Double occupancyPercent;
    private BigDecimal monthlyRevenue;
    private Integer activeTenantsCount;

    public PropertySummaryDTO() {}

    public PropertySummaryDTO(UUID id, String name, String code, String city, String state,
                              Integer totalBeds, Integer occupiedBeds, Double occupancyPercent,
                              BigDecimal monthlyRevenue, Integer activeTenantsCount) {
        this.id = id;
        this.name = name;
        this.code = code;
        this.city = city;
        this.state = state;
        this.totalBeds = totalBeds;
        this.occupiedBeds = occupiedBeds;
        this.occupancyPercent = occupancyPercent;
        this.monthlyRevenue = monthlyRevenue;
        this.activeTenantsCount = activeTenantsCount;
    }

    public static PropertySummaryDTO fromEntity(Property p) {
        if (p == null) return null;
        int total = p.getTotalBeds() != null ? p.getTotalBeds() : 0;
        int occupied = p.getOccupiedBeds() != null ? p.getOccupiedBeds() : 0;
        double occPct = total > 0 ? Math.round(((double) occupied / total) * 1000.0) / 10.0 : 0.0;

        return new PropertySummaryDTO(
                p.getId(),
                p.getName(),
                p.getCode(),
                p.getCity(),
                p.getState(),
                total,
                occupied,
                occPct,
                BigDecimal.ZERO,
                occupied
        );
    }

    public static PropertySummaryDTO fromDTO(PropertyDTO dto) {
        if (dto == null) return null;
        int total = dto.getTotalBeds() != null ? dto.getTotalBeds() : 0;
        int occupied = dto.getOccupiedBeds() != null ? dto.getOccupiedBeds() : 0;
        double occPct = total > 0 ? Math.round(((double) occupied / total) * 1000.0) / 10.0 : 0.0;

        return new PropertySummaryDTO(
                dto.getId(),
                dto.getName(),
                dto.getCode(),
                dto.getCity(),
                dto.getState(),
                total,
                occupied,
                occPct,
                BigDecimal.ZERO,
                occupied
        );
    }

    public static PropertySummaryDTO fromEntityWithStats(Property p, BigDecimal monthlyRevenue, Integer activeTenantsCount) {
        PropertySummaryDTO dto = fromEntity(p);
        if (dto != null) {
            if (monthlyRevenue != null) dto.setMonthlyRevenue(monthlyRevenue);
            if (activeTenantsCount != null) dto.setActiveTenantsCount(activeTenantsCount);
        }
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public Integer getTotalBeds() { return totalBeds; }
    public void setTotalBeds(Integer totalBeds) { this.totalBeds = totalBeds; }

    public Integer getOccupiedBeds() { return occupiedBeds; }
    public void setOccupiedBeds(Integer occupiedBeds) { this.occupiedBeds = occupiedBeds; }

    public Double getOccupancyPercent() { return occupancyPercent; }
    public void setOccupancyPercent(Double occupancyPercent) { this.occupancyPercent = occupancyPercent; }

    public BigDecimal getMonthlyRevenue() { return monthlyRevenue; }
    public void setMonthlyRevenue(BigDecimal monthlyRevenue) { this.monthlyRevenue = monthlyRevenue; }

    public Integer getActiveTenantsCount() { return activeTenantsCount; }
    public void setActiveTenantsCount(Integer activeTenantsCount) { this.activeTenantsCount = activeTenantsCount; }
}
