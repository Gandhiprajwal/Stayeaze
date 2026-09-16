package com.stayeaze.backend.security;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class SecurityUtils {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    /**
     * Safely retrieves the currently authenticated User entity, or null if unauthenticated.
     */
    public User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof UserDetailsImpl userDetails) {
            if (userDetails.getId() != null) {
                return userRepository.findById(userDetails.getId()).orElse(null);
            }
            if (userDetails.getEmail() != null) {
                return userRepository.findByEmail(userDetails.getEmail()).orElse(null);
            }
        }

        String username = auth.getName();
        if (username != null && !username.isBlank() && !"anonymousUser".equalsIgnoreCase(username)) {
            return userRepository.findByEmail(username).orElseGet(() ->
                    userRepository.findByMobile(username).orElse(null));
        }

        return null;
    }

    /**
     * Safely retrieves the currently authenticated user's Organization.
     */
    public Organization getCurrentOrganization() {
        User user = getCurrentUser();
        if (user != null && user.getOrganization() != null) {
            return user.getOrganization();
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl userDetails && userDetails.getOrgId() != null) {
            return organizationRepository.findById(userDetails.getOrgId()).orElse(null);
        }

        return null;
    }

    /**
     * Returns true if the user is a Super Admin.
     */
    public boolean isSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_SUPER_ADMIN".equalsIgnoreCase(a.getAuthority()) ||
                "SUPER_ADMIN".equalsIgnoreCase(a.getAuthority()));
    }

    /**
     * Returns true if the user is an Organization Owner or Admin.
     */
    public boolean isOwnerOrAdmin() {
        if (isSuperAdmin()) return true;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_OWNER".equalsIgnoreCase(a.getAuthority()) ||
                "OWNER".equalsIgnoreCase(a.getAuthority()) ||
                "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()) ||
                "ADMIN".equalsIgnoreCase(a.getAuthority()));
    }

    /**
     * Returns the Set of property IDs this user is authorized to manage.
     * Returns NULL if the user has unrestricted organization-wide access (Owner/Admin or unassigned staff).
     * Returns a non-null Set if the user is constrained to specific properties.
     */
    public Set<UUID> getAssignedPropertyIds() {
        if (isSuperAdmin()) {
            return null; // Unrestricted access
        }

        // If user is Owner / Admin, they have unrestricted org access
        if (isOwnerOrAdmin()) {
            return null;
        }

        User user = getCurrentUser();
        if (user == null) {
            return null;
        }

        // Check if user has explicit assigned property IDs (e.g. Property Manager, Staff)
        if (user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
            return new HashSet<>(user.getPropertyIds());
        }

        return null;
    }

    /**
     * Checks if a given propertyId is accessible by the current user.
     */
    public boolean isPropertyAccessible(UUID propertyId) {
        if (propertyId == null) {
            return true;
        }
        Set<UUID> assigned = getAssignedPropertyIds();
        if (assigned == null) {
            return true; // Unrestricted
        }
        return assigned.contains(propertyId);
    }

    /**
     * Enforces that the user has write/mutation access to the target property.
     * Throws AccessDeniedException (HTTP 403) if unauthorized.
     */
    public void validatePropertyAccess(UUID propertyId) {
        if (propertyId != null && !isPropertyAccessible(propertyId)) {
            throw new AccessDeniedException("Access Denied: You do not have permission to access or operate on this property.");
        }
    }
}
