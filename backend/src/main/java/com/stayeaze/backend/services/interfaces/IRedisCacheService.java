package com.stayeaze.backend.services.interfaces;

/**
 * Service contract for Redis and Level-2 cache evictions and invalidations.
 */
public interface IRedisCacheService {

    /**
     * Clears an entire named cache region.
     *
     * @param cacheName the name of the cache region (e.g., "properties", "rooms", "analytics")
     */
    void evictCache(String cacheName);

    /**
     * Clears multiple named cache regions.
     *
     * @param cacheNames array of cache region names to clear
     */
    void evictCaches(String... cacheNames);

    /**
     * Evicts a specific key from a named cache without clearing the entire region.
     *
     * @param cacheName target cache region
     * @param key the cache entry key
     */
    void evictCacheKey(String cacheName, Object key);

    /**
     * Clears all system-wide caching regions in one operation.
     */
    void evictAllCaches();
}
