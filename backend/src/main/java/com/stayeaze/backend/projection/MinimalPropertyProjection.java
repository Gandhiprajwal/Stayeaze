package com.stayeaze.backend.projection;

import java.util.UUID;

public interface MinimalPropertyProjection {
    UUID getId();
    String getName();
    String getCode();
}
