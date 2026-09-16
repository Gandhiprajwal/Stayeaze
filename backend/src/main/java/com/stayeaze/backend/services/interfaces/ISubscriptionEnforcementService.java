package com.stayeaze.backend.services.interfaces;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.SaaSPlan;

/**
 * Service contract for SaaS subscription lifecycle, tier capacity checks, and grace-period enforcement.
 */
public interface ISubscriptionEnforcementService {

    /**
     * Resolves the active SaaS plan associated with an organization.
     *
     * @param organization target organization
     * @return active SaaSPlan configuration, or fallback plan
     */
    SaaSPlan getActiveSaaSPlan(Organization organization);

    /**
     * Determines whether an organization has exceeded its subscription end date plus the 3-day grace period.
     *
     * @param organization target organization
     * @return true if non-admin login must be locked out
     */
    boolean isPostGraceLockout(Organization organization);

    /**
     * Checks if the organization is currently within the 3-day post-expiry grace period.
     *
     * @param organization target organization
     * @return true if grace period is active
     */
    boolean isGracePeriodActive(Organization organization);

    /**
     * Validates whether operational mutations (POST/PUT/PATCH/DELETE) are allowed for the workspace.
     *
     * @param organization target organization
     */
    void validateOperationalAccess(Organization organization);

    /**
     * Validates that creating a property does not exceed plan limits.
     *
     * @param organization target organization
     */
    void validatePropertyCreation(Organization organization);

    /**
     * Validates that adding beds does not exceed plan limits.
     *
     * @param organization target organization
     * @param additionalBedsCount count of beds being added
     */
    void validateBedCreation(Organization organization, int additionalBedsCount);

    /**
     * Validates that adding staff accounts does not exceed user seats.
     *
     * @param organization target organization
     */
    void validateStaffUserCreation(Organization organization);

    /**
     * Validates whether automated WhatsApp notifications are enabled in current plan.
     *
     * @param organization target organization
     */
    void validateWhatsAppAccess(Organization organization);

    /**
     * Validates whether 1-click bulk monthly rent generation is enabled in current plan.
     *
     * @param organization target organization
     */
    void validateBulkRentRunAccess(Organization organization);

    /**
     * Validates whether white-label custom branding is enabled in current plan.
     *
     * @param organization target organization
     */
    void validateCustomBrandingAccess(Organization organization);
}
