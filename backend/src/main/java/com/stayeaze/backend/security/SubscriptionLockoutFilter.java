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

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // 1. Bypass public, auth, subscription payment, super-admin, and static asset routes
        if (path.startsWith("/api/v1/auth/") ||
            path.startsWith("/api/v1/subscription/") ||
            path.startsWith("/api/v1/organization-billing-profile/") ||
            path.startsWith("/api/v1/super-admin/") ||
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

        Optional<OrganizationBillingProfile> profileOpt = profileRepository.findByOrganizationId(orgId);
        if (profileOpt.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        OrganizationBillingProfile profile = profileOpt.get();
        OffsetDateTime endDate = profile.getSubscriptionEndDate();
        
        // If end date is set and has passed
        if (endDate != null) {
            OffsetDateTime gracePeriodEnd = endDate.plusDays(3);
            OffsetDateTime now = OffsetDateTime.now();

            // 3. Grace period has expired! (t > endDate + 3 Days)
            if (now.isAfter(gracePeriodEnd)) {
                boolean isAdminOrOwner = auth.getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_ADMIN"));

                // Non-admin users are 100% BLOCKED from workspace access
                if (!isAdminOrOwner) {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getOutputStream(), new MessageResponse(
                        "Workspace Suspended: Your property workspace subscription expired on " 
                        + endDate.toLocalDate() + " and the 3-day grace period has ended. Please contact your administrator to renew."
                    ));
                    return;
                }

                // Admins/Owners can ONLY perform GET (read-only) or call subscription payment APIs.
                // Block POST, PUT, DELETE, PATCH on operational resources!
                String method = request.getMethod().toUpperCase();
                if ("POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method) || "PATCH".equals(method)) {
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getOutputStream(), new MessageResponse(
                        "Workspace Access Locked: Your 3-day subscription grace period expired on " 
                        + gracePeriodEnd.toLocalDate() + ". Operational features are locked. Please renew your subscription to resume creating or modifying property resources."
                    ));
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
