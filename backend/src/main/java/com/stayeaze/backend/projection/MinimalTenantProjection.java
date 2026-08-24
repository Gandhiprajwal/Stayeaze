package com.stayeaze.backend.projection;

import java.util.UUID;

public interface MinimalTenantProjection {
    UUID getId();
    String getFullName();
    String getPhone();
    String getRoomNumber();
}
