package com.stayeaze.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collection;

@Service
public class RedisCacheService {

    private static final Logger logger = LoggerFactory.getLogger(RedisCacheService.class);

    @Autowired
    private CacheManager cacheManager;

    /**
     * Clears a single cache by name.
     */
    public void evictCache(String cacheName) {
        if (cacheManager == null || cacheName == null) return;
        try {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.clear();
                logger.debug("Redis/L2 Cache evicted successfully: [{}]", cacheName);
            }
        } catch (Exception e) {
            logger.warn("Error evicting cache [{}]: {}", cacheName, e.getMessage());
        }
    }

    /**
     * Clears multiple caches by name.
     */
    public void evictCaches(String... cacheNames) {
        if (cacheNames == null) return;
        for (String name : cacheNames) {
            evictCache(name);
        }
    }

    /**
     * Flushes all active application caches in Redis and memory.
     */
    public void evictAllCaches() {
        if (cacheManager == null) return;
        try {
            Collection<String> names = cacheManager.getCacheNames();
            for (String name : names) {
                evictCache(name);
            }
            logger.info("All Redis & in-memory caches flushed successfully.");
        } catch (Exception e) {
            logger.warn("Error flushing all caches: {}", e.getMessage());
        }
    }

    /**
     * Evicts all tenant and occupancy related caches.
     */
    public void evictTenantCaches() {
        evictCaches("tenants", "minimalTenants", "beds", "beds_v3", "rooms", "rooms_v3");
    }

    /**
     * Evicts all property and location related caches.
     */
    public void evictPropertyCaches() {
        evictCaches("properties", "propertyDtos", "minimalProperties");
    }

    /**
     * Evicts all building, floor, room, and bed inventory caches.
     */
    public void evictRoomBedCaches() {
        evictCaches("buildings", "floors", "floors_v2", "rooms", "rooms_v3", "beds", "beds_v3");
    }

    /**
     * Evicts booking, check-in, check-out, and associated occupancy caches.
     */
    public void evictBookingCheckInCaches() {
        evictCaches("bookings", "checkIns", "checkOuts", "beds", "beds_v3", "rooms", "rooms_v3", "tenants", "minimalTenants");
    }

    /**
     * Evicts financial, invoice, and payment caches.
     */
    public void evictInvoicePaymentCaches() {
        evictCaches("invoices", "payments");
    }

    /**
     * Evicts complaints and maintenance task caches.
     */
    public void evictComplaintMaintenanceCaches() {
        evictCaches("complaints", "maintenance");
    }

    /**
     * Evicts visitor and guest caches.
     */
    public void evictVisitorCaches() {
        evictCaches("visitors");
    }

    /**
     * Evicts organization profiles and settings caches.
     */
    public void evictOrganizationCaches() {
        evictCaches("organizationProfiles");
    }

    /**
     * Direct key-value cache update.
     */
    public void putCacheValue(String cacheName, Object key, Object value) {
        if (cacheManager == null || cacheName == null || key == null) return;
        try {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.put(key, value);
                logger.debug("Cache key updated: [{}] key=[{}]", cacheName, key);
            }
        } catch (Exception e) {
            logger.warn("Error updating cache [{}] for key [{}]: {}", cacheName, key, e.getMessage());
        }
    }
}
