package com.stayeaze.backend.services;

import com.stayeaze.backend.config.DatabaseSeeder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DatabaseResetService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private CacheManager cacheManager;

    @Autowired
    private DatabaseSeeder databaseSeeder;

    @Autowired(required = false)
    private com.stayeaze.backend.security.services.TokenBlacklistService tokenBlacklistService;

    @Autowired(required = false)
    private org.springframework.data.redis.connection.RedisConnectionFactory redisConnectionFactory;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @Autowired(required = false)
    private jakarta.persistence.EntityManagerFactory entityManagerFactory;

    // All 48+ operational tables and jointables in reverse dependency order
    private static final String[] ALL_OPERATIONAL_TABLES = new String[]{
        "lost_and_found_items",
        "key_loans",
        "front_desk_shift_handovers",
        "user_journey_audits",
        "support_ticket_messages",
        "support_tickets",
        "subscription_extension_requests",
        "onboarding_leads",
        "lead_notes",
        "safety_incidents",
        "parcels",
        "visitors",
        "notification_logs",
        "tenant_documents",
        "checkout_audits",
        "checkin_checklists",
        "check_outs",
        "check_ins",
        "agreements",
        "complaint_chat_messages",
        "complaint_chats",
        "complaint_messages",
        "complaints",
        "penalties_discounts",
        "payments",
        "invoice_items",
        "invoices",
        "meter_readings",
        "expenses",
        "inquiries",
        "maintenance",
        "bookings",
        "property_amenities",
        "room_amenities",
        "beds",
        "rooms",
        "floors",
        "buildings",
        "user_properties",
        "user_roles",
        "refresh_tokens",
        "refreshtoken",
        "tenants",
        "properties",
        "organization_billing_profiles",
        "subscription_billing",
        "subscriptions",
        "subscription_plans",
        "saas_invoices",
        "saas_plans",
        "billing_plans",
        "system_configs",
        "system_integration_settings",
        "audit_logs",
        "users",
        "organizations"
    };

    public void resetAllTables() {
        System.out.println("🔄 [DatabaseResetService] Starting full clean database reset across all 48+ tables...");

        // Disable constraint checks where possible for seamless truncate/delete
        try {
            jdbcTemplate.execute("SET session_replication_role = 'replica';"); // PostgreSQL
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0;"); // MySQL
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE;"); // H2
        } catch (Exception ignored) {}

        // 1. Truncate / Delete all operational and entity tables
        for (String table : ALL_OPERATIONAL_TABLES) {
            try {
                jdbcTemplate.execute("TRUNCATE TABLE " + table + " RESTART IDENTITY CASCADE");
            } catch (Exception e) {
                try {
                    jdbcTemplate.execute("DELETE FROM " + table);
                } catch (Exception ignored) {}
            }
        }

        // Re-enable constraint checks
        try {
            jdbcTemplate.execute("SET session_replication_role = 'origin';"); // PostgreSQL
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1;"); // MySQL
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE;"); // H2
        } catch (Exception ignored) {}

        // Flush all application & Hibernate/Redis caches before re-seeding
        clearAllCaches();
        if (entityManager != null) {
            try {
                entityManager.clear();
            } catch (Exception ignored) {}
        }

        System.out.println("🌱 [DatabaseResetService] Tables wiped clean. Re-seeding full connected relational dataset...");

        // 2. Re-seed full fresh environment with all interconnected relational records
        databaseSeeder.seedAllFresh();

        // 3. Clear in-memory revoked tokens
        if (tokenBlacklistService != null) {
            try {
                tokenBlacklistService.cleanupExpired();
            } catch (Exception ignored) {}
        }

        // 4. Flush all application & Redis caches
        clearAllCaches();

        System.out.println("✅ [DatabaseResetService] Full clean reset and relational seeding completed successfully!");
    }

    public void clearAllCaches() {
        if (entityManagerFactory != null && entityManagerFactory.getCache() != null) {
            try {
                entityManagerFactory.getCache().evictAll();
            } catch (Exception ignored) {}
        }
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

