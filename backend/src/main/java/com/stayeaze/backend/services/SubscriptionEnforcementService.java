package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class SubscriptionEnforcementService {

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

    public void validatePropertyCreation(Organization organization) {
        if (organization == null) return;
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
        SaaSPlan plan = getActiveSaaSPlan(organization);
        if (plan != null && Boolean.FALSE.equals(plan.getAllowWhatsApp())) {
            throw new IllegalArgumentException("Feature Restricted: Automated WhatsApp notifications are only available on the Professional & Enterprise subscription plans. Please upgrade to enable automated WhatsApp alerts.");
        }
    }
}
