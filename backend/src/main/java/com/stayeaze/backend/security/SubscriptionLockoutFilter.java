package com.stayeaze.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Component
public class SubscriptionLockoutFilter extends OncePerRequestFilter {

    @Autowired
    private OrganizationBillingProfileRepository profileRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private static class CacheEntry {
        final boolean isLocked;
        final OffsetDateTime gracePeriodEnd;
        final OffsetDateTime endDate;
        final long cachedTimestamp;

        CacheEntry(boolean isLocked, OffsetDateTime gracePeriodEnd, OffsetDateTime endDate) {
            this.isLocked = isLocked;
            this.gracePeriodEnd = gracePeriodEnd;
            this.endDate = endDate;
            this.cachedTimestamp = System.currentTimeMillis();
        }

        boolean isExpired() {
            return (System.currentTimeMillis() - cachedTimestamp) > 60_000L; // 60s TTL
        }
    }

    private final java.util.concurrent.ConcurrentMap<UUID, CacheEntry> statusCache = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Instantly evicts the cached lockout status for an organization.
     * Call this when a subscription is renewed, upgraded, or unlocked.
     */
    public void evictCache(UUID orgId) {
        if (orgId != null) {
            statusCache.remove(orgId);
        }
    }

    /**
     * Clears all cached lockout statuses.
     */
    public void clearCache() {
        statusCache.clear();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // 1. Bypass public, auth, saas plans, branding, actuator, websockets, telemetry, subscription payment, super-admin, webhooks, and static asset routes
        if (path.startsWith("/api/v1/auth") ||
            path.startsWith("/api/v1/public") ||
            path.startsWith("/api/v1/saas") ||
            path.startsWith("/api/v1/branding") ||
            path.startsWith("/actuator") ||
            path.startsWith("/ws-stayeaze") ||
            path.startsWith("/api/v1/telemetry") ||
            path.startsWith("/api/v1/subscription") ||
            path.startsWith("/api/v1/organization-billing-profile") ||
            path.startsWith("/api/v1/super-admin") ||
            path.startsWith("/api/v1/webhooks") ||
            path.startsWith("/uploads/") ||
            path.startsWith("/error") ||
            "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof UserDetailsImpl userDetails)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Super Admins are always exempt from workspace subscription lockouts
        boolean isSuperAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        if (isSuperAdmin) {
            filterChain.doFilter(request, response);
            return;
        }

        UUID orgId = userDetails.getOrgId();
        if (orgId == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Fast L2 in-memory cache lookup (60s TTL)
        CacheEntry entry = statusCache.compute(orgId, (id, oldVal) -> {
            if (oldVal != null && !oldVal.isExpired()) {
                return oldVal;
            }
            Optional<OrganizationBillingProfile> profileOpt = profileRepository.findByOrganizationId(id);
            if (profileOpt.isEmpty()) {
                return new CacheEntry(false, null, null);
            } else {
                OrganizationBillingProfile profile = profileOpt.get();
                OffsetDateTime endDate = profile.getSubscriptionEndDate();
                if (endDate != null) {
                    OffsetDateTime gracePeriodEnd = endDate.plusDays(3);
                    boolean isLocked = OffsetDateTime.now().isAfter(gracePeriodEnd);
                    return new CacheEntry(isLocked, gracePeriodEnd, endDate);
                } else {
                    return new CacheEntry(false, null, null);
                }
            }
        });

        // 4. Lockout evaluation if locked
        if (entry.isLocked && entry.endDate != null) {
            boolean isAdminOrOwner = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_ADMIN"));

            // Non-admin users are 100% BLOCKED from workspace access
            if (!isAdminOrOwner) {
                response.setStatus(HttpStatus.FORBIDDEN.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getOutputStream(), new MessageResponse(
                    "Workspace Suspended: Your property workspace subscription expired on " 
                    + entry.endDate.toLocalDate() + " and the 3-day grace period has ended. Please contact your administrator to renew."
                ));
                return;
            }

            // Admins/Owners can ONLY perform GET (read-only) or call subscription payment APIs.
            String method = request.getMethod().toUpperCase();
            if ("POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method) || "PATCH".equals(method)) {
                response.setStatus(HttpStatus.FORBIDDEN.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getOutputStream(), new MessageResponse(
                    "Workspace Access Locked: Your 3-day subscription grace period expired on " 
                    + (entry.gracePeriodEnd != null ? entry.gracePeriodEnd.toLocalDate() : entry.endDate.toLocalDate()) 
                    + ". Operational features are locked. Please renew your subscription to resume creating or modifying property resources."
                ));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
