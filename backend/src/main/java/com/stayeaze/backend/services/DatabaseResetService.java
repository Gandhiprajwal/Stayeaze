package com.stayeaze.backend.services;

import com.stayeaze.backend.models.ERole;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Service
public class DatabaseResetService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private CacheManager cacheManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private com.stayeaze.backend.security.services.TokenBlacklistService tokenBlacklistService;

    private static final String[] ALL_OPERATIONAL_TABLES = new String[]{
        "user_properties",
        "user_roles",
        "lead_notes",
        "onboarding_leads",
        "complaint_chat_messages",
        "complaint_chats",
        "complaint_messages",
        "complaints",
        "expenses",
        "property_amenities",
        "room_amenities",
        "tenant_documents",
        "checkout_audits",
        "checkin_checklists",
        "check_outs",
        "check_ins",
        "agreements",
        "meter_readings",
        "safety_incidents",
        "parcels",
        "visitors",
        "notification_logs",
        "inquiries",
        "saas_invoices",
        "saas_plans",
        "billing_plans",
        "penalties_discounts",
        "system_configs",
        "system_integration_settings",
        "organization_billing_profiles",
        "subscription_billing",
        "subscriptions",
        "subscription_plans",
        "invoice_items",
        "payments",
        "invoices",
        "maintenance",
        "bookings",
        "tenants",
        "beds",
        "rooms",
        "floors",
        "buildings",
        "properties",
        "refresh_tokens",
        "refreshtoken",
        "audit_logs"
    };

    public void resetAllTables() {
        // 1. Attempt TRUNCATE / DELETE table-by-table so missing tables don't break execution
        for (String table : ALL_OPERATIONAL_TABLES) {
            try {
                jdbcTemplate.execute("TRUNCATE TABLE " + table + " RESTART IDENTITY CASCADE");
            } catch (Exception e) {
                try {
                    jdbcTemplate.execute("DELETE FROM " + table);
                } catch (Exception ignored) {}
            }
        }

        // 2. Wipe non-system users and non-system organizations
        try {
            jdbcTemplate.execute("DELETE FROM users WHERE email <> 'superadmin@stayeaze.com'");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("DELETE FROM organizations WHERE subdomain <> 'system'");
        } catch (Exception ignored) {}

        // 3. Ensure System Organization exists
        Organization systemOrg = organizationRepository.findBySubdomain("system")
                .orElseGet(() -> {
                    Organization org = new Organization("StayEaze SaaS System", "system");
                    return organizationRepository.save(org);
                });

        // 4. Re-seed Core System Roles
        seedRoleIfNotFound(ERole.SUPER_ADMIN, "[\"ALL\"]");
        seedRoleIfNotFound(ERole.SUPPORT, "[\"SUPPORT_READ\", \"SUPPORT_WRITE\", \"TICKET_MANAGE\"]");
        seedRoleIfNotFound(ERole.OWNER, "[\"ALL\"]");
        seedRoleIfNotFound(ERole.PROPERTY_MANAGER, "[\"PROPERTY_WRITE\", \"PROPERTY_READ\"]");
        seedRoleIfNotFound(ERole.RECEPTIONIST, "[\"TENANT_WRITE\", \"TENANT_READ\", \"VISITOR_WRITE\"]");
        seedRoleIfNotFound(ERole.ACCOUNTANT, "[\"BILLING_WRITE\", \"BILLING_READ\"]");
        seedRoleIfNotFound(ERole.SECURITY_GUARD, "[\"SECURITY_WRITE\", \"SECURITY_READ\"]");
        seedRoleIfNotFound(ERole.STAFF, "[\"MAINTENANCE_WRITE\", \"CLEANING_WRITE\"]");
        seedRoleIfNotFound(ERole.TENANT, "[\"COMPLAINT_WRITE\"]");

        // 5. Ensure Super Admin user is fully provisioned
        try {
            Optional<Role> superAdminRoleOpt = roleRepository.findByName(ERole.SUPER_ADMIN);
            if (superAdminRoleOpt.isPresent()) {
                Role superAdminRole = superAdminRoleOpt.get();
                User superAdmin = userRepository.findByEmail("superadmin@stayeaze.com")
                        .orElseGet(() -> new User(
                                systemOrg,
                                "superadmin@stayeaze.com",
                                passwordEncoder.encode("Friend@2010"),
                                "0000000000"
                        ));

                superAdmin.setOrganization(systemOrg);
                superAdmin.setEmail("superadmin@stayeaze.com");
                superAdmin.setFirstName("Super Admin");
                superAdmin.setPassword(passwordEncoder.encode("Friend@2010"));

                if (superAdmin.getRoles() == null) {
                    superAdmin.setRoles(new HashSet<>());
                } else {
                    superAdmin.getRoles().clear();
                }
                superAdmin.getRoles().add(superAdminRole);
                userRepository.save(superAdmin);
            }
        } catch (Exception ignored) {}

        // 6. Clear in-memory revoked tokens
        if (tokenBlacklistService != null) {
            try {
                tokenBlacklistService.cleanupExpired();
            } catch (Exception ignored) {}
        }

        // 7. Flush all application & Redis caches
        clearAllCaches();
    }

    private void seedRoleIfNotFound(ERole roleName, String permissions) {
        if (!roleRepository.findByName(roleName).isPresent()) {
            Role role = new Role(roleName, permissions);
            roleRepository.save(role);
        }
    }

    @Autowired(required = false)
    private org.springframework.data.redis.connection.RedisConnectionFactory redisConnectionFactory;

    public void clearAllCaches() {
        if (cacheManager != null) {
            for (String cacheName : cacheManager.getCacheNames()) {
                Cache cache = cacheManager.getCache(cacheName);
                if (cache != null) {
                    cache.clear();
                }
            }
        }
        if (redisConnectionFactory != null) {
            try (org.springframework.data.redis.connection.RedisConnection connection = redisConnectionFactory.getConnection()) {
                connection.serverCommands().flushDb();
            } catch (Exception ignored) {}
        }
    }
}
