package com.stayeaze.backend.projection;

import java.util.UUID;

/**
 * Native interface-based Spring Data projection for ultra-fast minimal property queries.
 * Selects only 11 scalar columns, completely bypassing full entity hydration,
 * @ManyToOne(fetch = FetchType.EAGER) joins, and @ElementCollection N+1 queries.
 */
public interface MinimalPropertyView {
    UUID getId();
    String getName();
    String getCode();
    String getType();
    String getCity();
    String getStatus();
    String getEmail();
    String getManager();
    UUID getOrgId();
    Integer getTotalBeds();
    Integer getOccupiedBeds();
}
