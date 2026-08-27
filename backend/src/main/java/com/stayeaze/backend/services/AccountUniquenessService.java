package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AccountUniquenessService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TenantRepository tenantRepository;

    /**
     * Normalizes phone numbers by stripping non-digit characters and standardizing 10-digit Indian numbers.
     */
    public String normalizeMobile(String mobile) {
        if (mobile == null || mobile.isBlank()) {
            return null;
        }
        String digits = mobile.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        } else if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        return digits;
    }

    /**
     * Normalizes email addresses to lowercase and trimmed.
     */
    public String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return email.trim().toLowerCase();
    }

    private boolean isCheckedOutOrArchived(String status) {
        if (status == null) return false;
        String s = status.trim().toUpperCase();
        return "CHECKED_OUT".equals(s) || "ARCHIVED".equals(s);
    }

    private String extractPrimaryRoleName(User user) {
        if (user == null || user.getRoles() == null || user.getRoles().isEmpty()) {
            return "USER";
        }
        for (Role r : user.getRoles()) {
            if (r != null && r.getName() != null) {
                String name = r.getName().replace("ROLE_", "");
                if (!"TENANT".equalsIgnoreCase(name)) {
                    return name;
                }
            }
        }
        return "TENANT";
    }

    private boolean isStaffUser(User user) {
        if (user == null) return false;
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return user.getTenantId() == null;
        }
        for (Role r : user.getRoles()) {
            if (r != null && r.getName() != null) {
                String name = r.getName().toUpperCase();
                if (name.contains("OWNER") || name.contains("PROPERTY_MANAGER") || name.contains("MANAGER") ||
                    name.contains("RECEPTIONIST") || name.contains("ACCOUNTANT") || name.contains("SECURITY") ||
                    name.contains("ADMIN") || name.contains("SUPPORT")) {
                    return true;
                }
            }
        }
        return user.getTenantId() == null;
    }

    /**
     * Validates that an incoming Tenant email and mobile do not conflict with existing Staff accounts
     * or other Active residents in the organization.
     */
    public void validateTenantEmailAndMobile(Organization org, String rawEmail, String rawMobile, String emergencyContactMobile, UUID currentTenantId) {
        String cleanEmail = normalizeEmail(rawEmail);
        String cleanMobile = normalizeMobile(rawMobile);
        String cleanEmergency = normalizeMobile(emergencyContactMobile);

        // 1. Emergency Contact self-reference check
        if (cleanMobile != null && cleanEmergency != null && cleanMobile.equals(cleanEmergency)) {
            throw new IllegalArgumentException("Error: Emergency contact mobile number cannot be identical to the resident's primary mobile number.");
        }

        // 2. Mobile validation
        if (cleanMobile != null && !cleanMobile.isBlank()) {
            if (cleanMobile.length() < 10) {
                throw new IllegalArgumentException("Error: Mobile number must be at least 10 digits.");
            }

            // Check if mobile belongs to a Staff Member
            Optional<User> staffUserByMobile = userRepository.findByMobile(cleanMobile);
            if (staffUserByMobile.isEmpty()) {
                staffUserByMobile = userRepository.findFirstByMobile(cleanMobile);
            }
            if (staffUserByMobile.isPresent() && isStaffUser(staffUserByMobile.get())) {
                String role = extractPrimaryRoleName(staffUserByMobile.get());
                throw new IllegalArgumentException("Error: Mobile number (" + rawMobile + ") is already registered to a staff member (" + role + "). Please use a distinct resident mobile number.");
            }

            // Check if mobile belongs to an active resident in the organization
            if (org != null) {
                List<Tenant> existingTenants = tenantRepository.findByOrganization(org);
                for (Tenant t : existingTenants) {
                    if (currentTenantId != null && currentTenantId.equals(t.getId())) {
                        continue; // Skip self on edit
                    }
                    if (!isCheckedOutOrArchived(t.getStatus())) {
                        String existingMob = normalizeMobile(t.getMobile());
                        if (cleanMobile.equals(existingMob)) {
                            String rNum = t.getRoomNumber() != null ? t.getRoomNumber() : "N/A";
                            throw new IllegalArgumentException("Error: Mobile number (" + rawMobile + ") is already registered to active resident: " + t.getFirstName() + " (Room " + rNum + ").");
                        }
                    }
                }
            }
        }

        // 3. Email validation
        if (cleanEmail != null && !cleanEmail.isBlank()) {
            // Check if email belongs to a Staff Member
            Optional<User> userByEmail = userRepository.findByEmail(cleanEmail);
            if (userByEmail.isPresent()) {
                User u = userByEmail.get();
                if (isStaffUser(u)) {
                    String role = extractPrimaryRoleName(u);
                    throw new IllegalArgumentException("Error: Email address (" + cleanEmail + ") is already registered to a staff member (" + role + "). Please use a distinct resident email address.");
                }
            }

            // Check if email belongs to an active resident in the organization
            if (org != null) {
                List<Tenant> existingTenants = tenantRepository.findByOrganization(org);
                for (Tenant t : existingTenants) {
                    if (currentTenantId != null && currentTenantId.equals(t.getId())) {
                        continue; // Skip self on edit
                    }
                    if (!isCheckedOutOrArchived(t.getStatus())) {
                        String existingEmail = normalizeEmail(t.getEmail());
                        if (cleanEmail.equalsIgnoreCase(existingEmail)) {
                            String rNum = t.getRoomNumber() != null ? t.getRoomNumber() : "N/A";
                            throw new IllegalArgumentException("Error: Email address (" + cleanEmail + ") is already registered to active resident: " + t.getFirstName() + " (Room " + rNum + ").");
                        }
                    }
                }
            }
        }
    }

    /**
     * Validates that an incoming Staff user email and mobile do not conflict with existing Staff or active Residents.
     */
    public void validateStaffEmailAndMobile(Organization org, String rawEmail, String rawMobile, UUID currentUserId) {
        String cleanEmail = normalizeEmail(rawEmail);
        String cleanMobile = normalizeMobile(rawMobile);

        if (cleanEmail == null || cleanEmail.isBlank()) {
            throw new IllegalArgumentException("Error: Email address is required for staff user.");
        }

        // 1. Email uniqueness across Users
        Optional<User> existingUser = userRepository.findByEmail(cleanEmail);
        if (existingUser.isPresent()) {
            if (currentUserId == null || !existingUser.get().getId().equals(currentUserId)) {
                throw new IllegalArgumentException("Error: A user account with email \"" + cleanEmail + "\" is already registered in the system.");
            }
        }

        // 2. Email conflict with active Residents
        if (org != null) {
            List<Tenant> activeTenants = tenantRepository.findByOrganization(org);
            for (Tenant t : activeTenants) {
                if (!isCheckedOutOrArchived(t.getStatus())) {
                    String tEmail = normalizeEmail(t.getEmail());
                    if (cleanEmail.equalsIgnoreCase(tEmail)) {
                        throw new IllegalArgumentException("Error: Email address \"" + cleanEmail + "\" is currently assigned to active resident: " + t.getFirstName() + ". Staff accounts must use a distinct email address.");
                    }
                }
            }
        }

        // 3. Mobile validation
        if (cleanMobile != null && !cleanMobile.isBlank()) {
            if (cleanMobile.length() < 10) {
                throw new IllegalArgumentException("Error: Mobile number must be at least 10 digits.");
            }

            Optional<User> userByMobile = userRepository.findByMobile(cleanMobile);
            if (userByMobile.isEmpty()) {
                userByMobile = userRepository.findFirstByMobile(cleanMobile);
            }
            if (userByMobile.isPresent()) {
                if (currentUserId == null || !userByMobile.get().getId().equals(currentUserId)) {
                    throw new IllegalArgumentException("Error: A user account with mobile number \"" + rawMobile + "\" is already registered.");
                }
            }

            if (org != null) {
                List<Tenant> activeTenants = tenantRepository.findByOrganization(org);
                for (Tenant t : activeTenants) {
                    if (!isCheckedOutOrArchived(t.getStatus())) {
                        String tMobile = normalizeMobile(t.getMobile());
                        if (cleanMobile.equals(tMobile)) {
                            throw new IllegalArgumentException("Error: Mobile number \"" + rawMobile + "\" is currently assigned to active resident: " + t.getFirstName() + ". Staff accounts must use a distinct mobile number.");
                        }
                    }
                }
            }
        }
    }

    /**
     * Validates a single row during Bulk Tenant Import, checking both intra-file duplicates and DB collisions.
     */
    public void validateBulkImportRow(Organization org, String rawEmail, String rawMobile, int rowIndex, Set<String> seenEmails, Set<String> seenMobiles) {
        String cleanMobile = normalizeMobile(rawMobile);
        String cleanEmail = normalizeEmail(rawEmail);

        if (cleanMobile != null && !cleanMobile.isBlank()) {
            if (seenMobiles.contains(cleanMobile)) {
                throw new IllegalArgumentException("Row " + rowIndex + ": Duplicate mobile number \"" + rawMobile + "\" (already present in an earlier row of this file).");
            }
            seenMobiles.add(cleanMobile);
        }

        if (cleanEmail != null && !cleanEmail.isBlank()) {
            if (seenEmails.contains(cleanEmail)) {
                throw new IllegalArgumentException("Row " + rowIndex + ": Duplicate email address \"" + rawEmail + "\" (already present in an earlier row of this file).");
            }
            seenEmails.add(cleanEmail);
        }

        validateTenantEmailAndMobile(org, cleanEmail, cleanMobile, null, null);
    }
}
