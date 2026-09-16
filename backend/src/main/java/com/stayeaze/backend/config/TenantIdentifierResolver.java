package com.stayeaze.backend.config;

import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Resolves the active Tenant ID (Organization ID) for Hibernate 6 @TenantId multi-tenancy.
 * Dynamically extracts org_id from the authenticated user's SecurityContext.
 * Returns a fallback DEFAULT_TENANT_ID during system bootstrap and non-user requests.
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<UUID> {

    public static final UUID DEFAULT_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");
    private static final ThreadLocal<UUID> currentTenant = new ThreadLocal<>();

    public static void setCurrentTenant(UUID tenantId) {
        if (tenantId != null) {
            currentTenant.set(tenantId);
        } else {
            currentTenant.remove();
        }
    }

    public static UUID getCurrentTenant() {
        return currentTenant.get();
    }

    public static void clear() {
        currentTenant.remove();
    }

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        UUID explicit = currentTenant.get();
        if (explicit != null) {
            return explicit;
        }
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl userDetails) {
                if (userDetails.getOrgId() != null) {
                    return userDetails.getOrgId();
                }
            }
        } catch (Exception ignored) {}
        return DEFAULT_TENANT_ID;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}
