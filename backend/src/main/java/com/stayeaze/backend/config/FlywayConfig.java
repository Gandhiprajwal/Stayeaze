package com.stayeaze.backend.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Custom Flyway migration strategy that automatically repairs dirty or failed schema history
 * entries prior to running migrations. Prevents startup blocks caused by schema repair state.
 */
@Configuration
public class FlywayConfig {

    private static final Logger logger = LoggerFactory.getLogger(FlywayConfig.class);

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return (Flyway flyway) -> {
            try {
                logger.info("Executing Flyway repair to ensure clean schema history...");
                flyway.repair();
            } catch (Exception e) {
                logger.warn("Flyway repair encountered non-critical exception: {}", e.getMessage());
            }
            logger.info("Executing Flyway migration...");
            flyway.migrate();
            logger.info("Flyway migration completed successfully.");
        };
    }
}
