package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SubscriptionEnforcementService {

    public static final int GRACE_PERIOD_DAYS = 3;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private UserRepository userRepository;

    public SaaSPlan getActiveSaaSPlan(Organization organization) {
        if (organization == null) return null;
        Optional<OrganizationBillingProfile> profileOpt = billingProfileRepository.findByOrganization(organization);
        if (profileOpt.isEmpty()) return null;

        OrganizationBillingProfile profile = profileOpt.get();
        String planName = profile.getSubscriptionPlanName();
        if (planName != null && !planName.isBlank()) {
            Optional<SaaSPlan> planOpt = saasPlanRepository.findByNameIgnoreCase(planName);
            if (planOpt.isPresent()) return planOpt.get();
            
            if (planName.toLowerCase().contains("pro")) {
                return saasPlanRepository.findByPlanKey("PROFESSIONAL").orElse(null);
            } else if (planName.toLowerCase().contains("enterprise")) {
                return saasPlanRepository.findByPlanKey("ENTERPRISE").orElse(null);
            } else {
                return saasPlanRepository.findByPlanKey("STARTER").orElse(null);
            }
        }
        return saasPlanRepository.findByPlanKey("STARTER").orElse(null);
    }

    /**
     * Checks if the organization's subscription has ended AND the 3-day grace period has elapsed.
     * When true, only Owners and Admins are permitted to log in for renewal.
     */
    public boolean isPostGraceLockout(Organization organization) {
        if (organization == null) return false;
        String orgStatus = organization.getStatus() != null ? organization.getStatus().toUpperCase() : "ACTIVE";
        if ("SUSPENDED".equals(orgStatus) || "EXPIRED".equals(orgStatus)) {
            return true;
        }

        Optional<OrganizationBillingProfile> profileOpt = billingProfileRepository.findByOrganization(organization);
        if (profileOpt.isPresent()) {
            OrganizationBillingProfile profile = profileOpt.get();
            String subStatus = profile.getSubscriptionStatus() != null ? profile.getSubscriptionStatus().toUpperCase() : orgStatus;
            if ("SUSPENDED".equals(subStatus) || "EXPIRED".equals(subStatus)) {
                return true;
            }
            if (profile.getSubscriptionEndDate() != null) {
                OffsetDateTime graceDeadline = profile.getSubscriptionEndDate().plusDays(GRACE_PERIOD_DAYS);
                return OffsetDateTime.now().isAfter(graceDeadline);
            }
        }
        return false;
    }

    /**
     * Checks if the subscription is currently in the 3-day grace period (subscriptionEndDate < now <= subscriptionEndDate + 3 days).
     */
    public boolean isGracePeriodActive(Organization organization) {
        if (organization == null) return false;
        Optional<OrganizationBillingProfile> profileOpt = billingProfileRepository.findByOrganization(organization);
        if (profileOpt.isPresent()) {
            OrganizationBillingProfile profile = profileOpt.get();
            if (profile.getSubscriptionEndDate() != null) {
                OffsetDateTime now = OffsetDateTime.now();
                OffsetDateTime endDate = profile.getSubscriptionEndDate();
                OffsetDateTime graceDeadline = endDate.plusDays(GRACE_PERIOD_DAYS);
                return now.isAfter(endDate) && !now.isAfter(graceDeadline);
            }
        }
        return false;
    }

    /**
     * Validates whether operational mutations (POST/PUT/PATCH/DELETE) are allowed for the organization.
     * Throws IllegalStateException if the workspace is in PAYMENT_LOCKED, SUSPENDED, EXPIRED, or past its subscription end date.
     */
    public void validateOperationalAccess(Organization organization) {
        if (organization == null) return;
        String orgStatus = organization.getStatus() != null ? organization.getStatus().toUpperCase() : "ACTIVE";
        
        Optional<OrganizationBillingProfile> profileOpt = billingProfileRepository.findByOrganization(organization);
        if (profileOpt.isPresent()) {
            OrganizationBillingProfile profile = profileOpt.get();
            String subStatus = profile.getSubscriptionStatus() != null ? profile.getSubscriptionStatus().toUpperCase() : orgStatus;

            if ("PAYMENT_LOCKED".equals(subStatus) || "PAYMENT_LOCKED".equals(orgStatus)) {
                throw new IllegalStateException("Payment Required: Your organization subscription is in Read-Only mode due to a pending payment. Please renew your subscription to perform this action.");
            }
            if ("SUSPENDED".equals(subStatus) || "SUSPENDED".equals(orgStatus)) {
                throw new IllegalStateException("Access Denied: Your organization workspace is suspended. Please contact platform support.");
            }
            if ("EXPIRED".equals(subStatus) || "EXPIRED".equals(orgStatus) || "CANCELLED".equals(subStatus) || "CANCELLED".equals(orgStatus)) {
                throw new IllegalStateException("Subscription Expired: Your organization subscription has ended. Please renew or reactivate your subscription to perform this action.");
            }
            if (profile.getSubscriptionEndDate() != null && profile.getSubscriptionEndDate().isBefore(OffsetDateTime.now())) {
                throw new IllegalStateException("Subscription Expired: Your subscription expired on " + profile.getSubscriptionEndDate().toLocalDate() + ". Please renew your plan to continue.");
            }
        } else {
            if ("PAYMENT_LOCKED".equals(orgStatus)) {
                throw new IllegalStateException("Payment Required: Your organization subscription is in Read-Only mode due to a pending payment. Please renew your subscription to perform this action.");
            }
            if ("SUSPENDED".equals(orgStatus)) {
                throw new IllegalStateException("Access Denied: Your organization workspace is suspended. Please contact platform support.");
            }
            if ("EXPIRED".equals(orgStatus) || "CANCELLED".equals(orgStatus)) {
                throw new IllegalStateException("Subscription Expired: Your organization subscription has ended. Please renew or reactivate your subscription to perform this action.");
            }
        }
    }

    public void validatePropertyCreation(Organization organization) {
        if (organization == null) return;
        validateOperationalAccess(organization);

        SaaSPlan plan = getActiveSaaSPlan(organization);
        if (plan == null) return;

        List<Property> existingProps = propertyRepository.findByOrganization(organization);
        int currentCount = existingProps != null ? existingProps.size() : 0;
        if (currentCount >= plan.getMaxProperties()) {
            throw new IllegalArgumentException("Subscription Limit Reached: Your current plan (" + plan.getName() 
                + ") allows up to " + plan.getMaxProperties() + " property workspace(s). Please upgrade your subscription plan to add more properties.");
        }
    }

    public void validateBedCreation(Organization organization, int additionalBedsCount) {
        if (organization == null) return;
        validateOperationalAccess(organization);

        SaaSPlan plan = getActiveSaaSPlan(organization);
        if (plan == null) return;

        List<Property> props = propertyRepository.findByOrganization(organization);
        int currentBeds = (props != null) ? props.stream().mapToInt(Property::getTotalBeds).sum() : 0;
        
        if ((currentBeds + additionalBedsCount) > plan.getMaxBeds()) {
            throw new IllegalArgumentException("Subscription Limit Reached: Your current plan (" + plan.getName() 
                + ") allows up to " + plan.getMaxBeds() + " total beds across your workspace (currently using " + currentBeds 
                + " beds). Please upgrade your subscription plan to add more beds.");
        }
    }

    public void validateStaffUserCreation(Organization organization) {
        if (organization == null) return;
        validateOperationalAccess(organization);

        SaaSPlan plan = getActiveSaaSPlan(organization);
        if (plan == null) return;

        List<User> users = userRepository.findByOrganizationId(organization.getId());
        long staffCount = (users != null) ? users.stream().filter(u -> u.getRoles() != null && u.getRoles().stream().anyMatch(r -> r.getName() != null && !r.getName().contains("TENANT"))).count() : 0;

        if (staffCount >= plan.getMaxStaffUsers()) {
            throw new IllegalArgumentException("Subscription Limit Reached: Your current plan (" + plan.getName() 
                + ") allows up to " + plan.getMaxStaffUsers() + " staff user accounts. Please upgrade your subscription plan to invite more team members.");
        }
    }

    public void validateWhatsAppAccess(Organization organization) {
        if (organization == null) return;
        validateOperationalAccess(organization);

        SaaSPlan plan = getActiveSaaSPlan(organization);
        if (plan != null && Boolean.FALSE.equals(plan.getAllowWhatsApp())) {
            throw new IllegalArgumentException("Feature Restricted: Automated WhatsApp notifications are only available on the Professional & Enterprise subscription plans. Please upgrade to enable automated WhatsApp alerts.");
        }
    }
}
