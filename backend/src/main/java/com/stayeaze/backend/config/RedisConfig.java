package com.stayeaze.backend.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

@Configuration
@EnableCaching
public class RedisConfig {

    private static final Logger logger = LoggerFactory.getLogger(RedisConfig.class);
    private static final Random random = new Random();

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @Bean
    @Primary
    public CacheManager cacheManager() {
        SystemIntegrationSettings settings = null;
        try {
            settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        } catch (Exception e) {
            logger.warn("Could not query SystemIntegrationSettings for Redis connection: {}", e.getMessage());
        }

        if (settings != null && Boolean.TRUE.equals(settings.getRedisEnabled())) {
            try {
                String host = settings.getRedisHost() != null ? settings.getRedisHost() : "localhost";
                int port = settings.getRedisPort() != null ? settings.getRedisPort() : 6379;
                String password = settings.getRedisPassword();

                logger.info("Initializing Lettuce Redis Client Connection to {}:{}...", host, port);

                RedisStandaloneConfiguration redisConfig = new RedisStandaloneConfiguration(host, port);
                if (password != null && !password.isBlank()) {
                    redisConfig.setPassword(RedisPassword.of(password));
                }

                LettuceConnectionFactory connectionFactory = new LettuceConnectionFactory(redisConfig);
                connectionFactory.afterPropertiesSet();

                // Custom ObjectMapper with JSR-310 (JavaTimeModule) & Hibernate6Module for proxy-safe Redis JSON
                ObjectMapper objectMapper = new ObjectMapper();
                objectMapper.registerModule(new JavaTimeModule());
                objectMapper.registerModule(new com.fasterxml.jackson.datatype.hibernate6.Hibernate6Module());
                objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
                objectMapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
                objectMapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
                objectMapper.activateDefaultTyping(
                        LaissezFaireSubTypeValidator.instance,
                        ObjectMapper.DefaultTyping.NON_FINAL,
                        JsonTypeInfo.As.PROPERTY
                );

                GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(objectMapper);

                // Base Jackson JSON serializer configuration (allows caching null values for Cache Penetration Protection)
                RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                        .entryTtl(Duration.ofMinutes(10))
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));




                // Staggered / Jittered Expiration TTLs for Anti-Stampede Protection
                Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();

                // Properties cache: 15 min + jitter (rarely changes)
                cacheConfigurations.put("properties", defaultConfig.entryTtl(Duration.ofMinutes(15).plusSeconds(random.nextInt(60))));
                cacheConfigurations.put("propertyDtos", defaultConfig.entryTtl(Duration.ofMinutes(15).plusSeconds(random.nextInt(60))));
                cacheConfigurations.put("minimalProperties", defaultConfig.entryTtl(Duration.ofMinutes(15).plusSeconds(random.nextInt(60))));

                // Organization Profiles cache: 30 min + jitter (very rarely changes)
                cacheConfigurations.put("organizationProfiles", defaultConfig.entryTtl(Duration.ofMinutes(30).plusSeconds(random.nextInt(120))));

                // Buildings/Floors/Rooms/Beds: 10 min + jitter (structure changes infrequently)
                cacheConfigurations.put("buildings", defaultConfig.entryTtl(Duration.ofMinutes(10).plusSeconds(random.nextInt(60))));
                cacheConfigurations.put("floors", defaultConfig.entryTtl(Duration.ofMinutes(10).plusSeconds(random.nextInt(60))));
                cacheConfigurations.put("rooms", defaultConfig.entryTtl(Duration.ofMinutes(10).plusSeconds(random.nextInt(60))));
                cacheConfigurations.put("beds", defaultConfig.entryTtl(Duration.ofMinutes(5).plusSeconds(random.nextInt(30))));

                // Tenants cache: 5 min + jitter
                cacheConfigurations.put("tenants", defaultConfig.entryTtl(Duration.ofMinutes(5).plusSeconds(random.nextInt(30))));
                cacheConfigurations.put("minimalTenants", defaultConfig.entryTtl(Duration.ofMinutes(5).plusSeconds(random.nextInt(30))));

                // Bookings/CheckIns/CheckOuts: 3 min + jitter (transactional, changes frequently)
                cacheConfigurations.put("bookings", defaultConfig.entryTtl(Duration.ofMinutes(3).plusSeconds(random.nextInt(20))));
                cacheConfigurations.put("checkIns", defaultConfig.entryTtl(Duration.ofMinutes(3).plusSeconds(random.nextInt(20))));
                cacheConfigurations.put("checkOuts", defaultConfig.entryTtl(Duration.ofMinutes(3).plusSeconds(random.nextInt(20))));

                // Invoices cache: 3 min + jitter
                cacheConfigurations.put("invoices", defaultConfig.entryTtl(Duration.ofMinutes(3).plusSeconds(random.nextInt(20))));

                // Payments cache: 2 min + jitter
                cacheConfigurations.put("payments", defaultConfig.entryTtl(Duration.ofMinutes(2).plusSeconds(random.nextInt(15))));

                // Complaints/Maintenance/Visitors: 5 min + jitter
                cacheConfigurations.put("complaints", defaultConfig.entryTtl(Duration.ofMinutes(5).plusSeconds(random.nextInt(30))));
                cacheConfigurations.put("maintenance", defaultConfig.entryTtl(Duration.ofMinutes(5).plusSeconds(random.nextInt(30))));
                cacheConfigurations.put("visitors", defaultConfig.entryTtl(Duration.ofMinutes(2).plusSeconds(random.nextInt(15))));

                // Audit logs: 10 min + jitter (append-only, read rarely)
                cacheConfigurations.put("auditLogs", defaultConfig.entryTtl(Duration.ofMinutes(10).plusSeconds(random.nextInt(60))));

                logger.info("Redis L2 Cache Manager initialized successfully with JavaTimeModule & Anti-Stampede Jitter.");
                return RedisCacheManager.builder(connectionFactory)
                        .cacheDefaults(defaultConfig)
                        .withInitialCacheConfigurations(cacheConfigurations)
                        .build();

            } catch (Exception ex) {
                logger.error("Failed to connect to Redis instance at {}:{} ({}) - Falling back to ConcurrentMapCacheManager",
                        settings.getRedisHost(), settings.getRedisPort(), ex.getMessage());
            }
        } else {
            logger.info("Redis Caching is disabled or credentials not configured. Using In-Memory ConcurrentMapCacheManager.");
        }

        // Fallback in-memory cache manager
        return new ConcurrentMapCacheManager(
                "properties", "propertyDtos", "minimalProperties",
                "organizationProfiles",
                "buildings", "floors", "rooms", "beds",
                "tenants", "minimalTenants",
                "bookings", "checkIns", "checkOuts",
                "invoices", "payments",
                "complaints", "maintenance", "visitors", "auditLogs"
        );
    }

    @Bean
    public org.springframework.boot.ApplicationRunner clearCacheOnStartup(CacheManager cacheManager) {
        return args -> {
            if (cacheManager != null) {
                logger.info("Flushing all Redis & In-Memory Application Caches on Application Startup...");
                for (String name : cacheManager.getCacheNames()) {
                    org.springframework.cache.Cache cache = cacheManager.getCache(name);
                    if (cache != null) {
                        cache.clear();
                    }
                }
                logger.info("All application caches flushed cleanly.");
            }
        };
    }
}
