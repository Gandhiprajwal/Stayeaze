package com.stayeaze.backend.security.interceptors;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.services.SubscriptionEnforcementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;
import java.util.Map;

@Component
public class SubscriptionOperationalInterceptor implements HandlerInterceptor {

    @Autowired
    private SubscriptionEnforcementService enforcementService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private static final List<String> WHITELISTED_PREFIXES = List.of(
            "/api/v1/auth",
            "/api/v1/subscription",
            "/api/v1/organization-billing-profile",
            "/api/v1/support",
            "/api/v1/super-admin",
            "/api/v1/public",
            "/actuator",
            "/ws"
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String method = request.getMethod().toUpperCase();
        // Allow all non-mutating HTTP methods for read-only access
        if ("GET".equals(method) || "OPTIONS".equals(method) || "HEAD".equals(method)) {
            return true;
        }

        String uri = request.getRequestURI();
        for (String prefix : WHITELISTED_PREFIXES) {
            if (uri.startsWith(prefix)) {
                return true;
            }
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equalsIgnoreCase(auth.getName())) {
            return true; // Let Spring Security handle unauthenticated requests
        }

        // Bypass for Super Admin / Support roles
        if (auth.getAuthorities() != null && auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN") ||
                a.getAuthority().equalsIgnoreCase("SUPER_ADMIN") ||
                a.getAuthority().equalsIgnoreCase("ROLE_SUPPORT") ||
                a.getAuthority().equalsIgnoreCase("SUPPORT"))) {
            return true;
        }

        Organization org = null;
        if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
            if (userDetails.getOrgId() != null) {
                org = organizationRepository.findById(userDetails.getOrgId()).orElse(null);
            }
            if (org == null) {
                org = userRepository.findById(userDetails.getId()).map(User::getOrganization).orElse(null);
            }
        } else {
            org = userRepository.findByEmail(auth.getName()).map(User::getOrganization).orElse(null);
        }

        if (org == null) {
            return true;
        }

        try {
            enforcementService.validateOperationalAccess(org);
            return true;
        } catch (IllegalStateException e) {
            response.setStatus(HttpStatus.PAYMENT_REQUIRED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            Map<String, Object> errorBody = Map.of(
                    "status", 402,
                    "error", "PAYMENT_REQUIRED",
                    "message", e.getMessage()
            );
            response.getWriter().write(objectMapper.writeValueAsString(errorBody));
            return false;
        }
    }
}
