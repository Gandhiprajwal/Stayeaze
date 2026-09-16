package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Bed;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.BedDTO;
import com.stayeaze.backend.repository.BedRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BedService {

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    @Autowired
    private com.stayeaze.backend.repository.BookingRepository bookingRepository;

    @Cacheable(value = "beds_v4", key = "#organization != null ? #organization.id : 'all'")
    @Transactional(readOnly = true)
    public List<BedDTO> getBedsByOrg(Organization organization) {
        List<Bed> list = organization == null ? bedRepository.findAllSuperAdmin()
                : bedRepository.findByOrganizationId(organization.getId());
        if (list == null || list.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        // 1. Batch preload all tenants for this organization in 1 single query
        List<com.stayeaze.backend.models.Tenant> allTenants = java.util.Collections.emptyList();
        try {
            allTenants = organization != null ? tenantRepository.findByOrganization(organization) : tenantRepository.findAll();
        } catch (Exception ignored) {}
        if (allTenants == null) allTenants = java.util.Collections.emptyList();

        java.util.Map<UUID, com.stayeaze.backend.models.Tenant> tenantById = new java.util.HashMap<>();
        java.util.Map<String, com.stayeaze.backend.models.Tenant> tenantByLocationKey = new java.util.HashMap<>();
        java.util.Map<String, com.stayeaze.backend.models.Tenant> tenantByRoomAndBed = new java.util.HashMap<>();

        for (com.stayeaze.backend.models.Tenant t : allTenants) {
            if (t == null) continue;
            if (t.getId() != null) tenantById.put(t.getId(), t);
            String ts = t.getStatus();
            boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
            if (!isCheckedOut && t.getRoomNumber() != null && t.getBedNumber() != null) {
                String rClean = clean(t.getRoomNumber());
                String bClean = clean(t.getBedNumber());
                
                tenantByRoomAndBed.put(rClean + "_" + bClean, t);
                if (t.getPropertyId() != null) {
                    tenantByLocationKey.put(t.getPropertyId() + "_" + rClean + "_" + bClean, t);
                }
            }
        }

        // 2. Batch preload all bookings for this organization in 1 single query
        List<com.stayeaze.backend.models.Booking> activeBookings = java.util.Collections.emptyList();
        try {
            activeBookings = organization != null ? bookingRepository.findByOrganizationId(organization.getId()) : bookingRepository.findAll();
        } catch (Exception ignored) {}
        if (activeBookings == null) activeBookings = java.util.Collections.emptyList();

        java.util.Map<UUID, com.stayeaze.backend.models.Booking> bookingByBedId = new java.util.HashMap<>();
        java.util.Map<String, com.stayeaze.backend.models.Booking> bookingByRoomAndBed = new java.util.HashMap<>();
        for (com.stayeaze.backend.models.Booking b : activeBookings) {
            if (b == null) continue;
            try {
                boolean statusOk = b.getStatus() == null
                        || "CONFIRMED".equalsIgnoreCase(b.getStatus())
                        || "CHECKED_IN".equalsIgnoreCase(b.getStatus())
                        || "PENDING".equalsIgnoreCase(b.getStatus());
                if (statusOk) {
                    if (b.getBed() != null && b.getBed().getId() != null) {
                        bookingByBedId.put(b.getBed().getId(), b);
                    }
                    if (b.getRoomNumber() != null && b.getBedNumber() != null) {
                        String rClean = clean(b.getRoomNumber());
                        String bClean = clean(b.getBedNumber());
                        bookingByRoomAndBed.put(rClean + "_" + bClean, b);
                    }
                }
            } catch (Exception ignored) {}
        }

        // 3. Populate bed details in-memory with 0 database roundtrips
        return list.stream()
                .map(b -> BedDTO.fromEntity(populateBedDetailsFast(b, tenantById, tenantByLocationKey, tenantByRoomAndBed, bookingByBedId, bookingByRoomAndBed)))
                .collect(Collectors.toList());
    }

    private String clean(String str) {
        if (str == null) return "";
        return str.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private Bed populateBedDetailsFast(
            Bed bed,
            java.util.Map<UUID, com.stayeaze.backend.models.Tenant> tenantById,
            java.util.Map<String, com.stayeaze.backend.models.Tenant> tenantByLocationKey,
            java.util.Map<String, com.stayeaze.backend.models.Tenant> tenantByRoomAndBed,
            java.util.Map<UUID, com.stayeaze.backend.models.Booking> bookingByBedId,
            java.util.Map<String, com.stayeaze.backend.models.Booking> bookingByRoomAndBed) {
        if (bed == null) return bed;
        String roomNum = null;
        UUID propId = null;
        try {
            if (bed.getRoom() != null) {
                roomNum = bed.getRoom().getRoomNumber();
                if (bed.getRoom().getFloor() != null && bed.getRoom().getFloor().getBuilding() != null && bed.getRoom().getFloor().getBuilding().getProperty() != null) {
                    propId = bed.getRoom().getFloor().getBuilding().getProperty().getId();
                }
            }
        } catch (Exception ignored) {}

        String rClean = clean(roomNum);
        String bClean = clean(bed.getBedNumber());

        // Fast path 1: Match by direct Bed ID in active bookings
        com.stayeaze.backend.models.Booking directBooking = bed.getId() != null ? bookingByBedId.get(bed.getId()) : null;
        if (directBooking != null) {
            if ("CHECKED_IN".equalsIgnoreCase(directBooking.getStatus())) {
                bed.setStatus("OCCUPIED");
            } else {
                bed.setStatus("RESERVED");
            }
            try {
                if (directBooking.getTenant() != null) {
                    com.stayeaze.backend.models.Tenant t = tenantById.get(directBooking.getTenant().getId());
                    if (t != null) {
                        bed.setTenantId(t.getId().toString());
                        bed.setTenantName(t.getName());
                        return bed;
                    }
                }
            } catch (Exception ignored) {}
            if (directBooking.getTenantName() != null && !directBooking.getTenantName().isBlank()) {
                bed.setTenantName(directBooking.getTenantName());
                return bed;
            }
        }

        // Fast path 2: if bed has a stored tenantId, look up that tenant directly
        if (bed.getTenantId() != null && !bed.getTenantId().isBlank()) {
            try {
                UUID tenantUUID = UUID.fromString(bed.getTenantId());
                com.stayeaze.backend.models.Tenant directTenant = tenantById.get(tenantUUID);
                if (directTenant != null) {
                    String ts = directTenant.getStatus();
                    boolean checkedOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
                    if (!checkedOut) {
                        bed.setTenantName(directTenant.getName());
                        bed.setTenantId(directTenant.getId().toString());
                        bed.setStatus("OCCUPIED");
                        return bed;
                    }
                }
            } catch (Exception ignored) {}
        }

        // Fast path 3: Match active tenant by (property + room + bed) key
        if (propId != null && !rClean.isEmpty() && !bClean.isEmpty()) {
            com.stayeaze.backend.models.Tenant matchedTenant = tenantByLocationKey.get(propId + "_" + rClean + "_" + bClean);
            if (matchedTenant != null) {
                bed.setStatus("OCCUPIED");
                bed.setTenantId(matchedTenant.getId().toString());
                bed.setTenantName(matchedTenant.getName());
                return bed;
            }
        }

        // Fast path 4: Match active tenant by (room + bed) key
        if (!rClean.isEmpty() && !bClean.isEmpty()) {
            com.stayeaze.backend.models.Tenant matchedTenant = tenantByRoomAndBed.get(rClean + "_" + bClean);
            if (matchedTenant != null) {
                bed.setStatus("OCCUPIED");
                bed.setTenantId(matchedTenant.getId().toString());
                bed.setTenantName(matchedTenant.getName());
                return bed;
            }
        }

        // Fast path 5: Match booking by room + bed key
        if (!rClean.isEmpty() && !bClean.isEmpty()) {
            com.stayeaze.backend.models.Booking b = bookingByRoomAndBed.get(rClean + "_" + bClean);
            if (b != null) {
                if ("CHECKED_IN".equalsIgnoreCase(b.getStatus())) {
                    bed.setStatus("OCCUPIED");
                } else {
                    bed.setStatus("RESERVED");
                }
                try {
                    if (b.getTenant() != null) {
                        com.stayeaze.backend.models.Tenant t = tenantById.get(b.getTenant().getId());
                        if (t != null) {
                            bed.setTenantId(t.getId().toString());
                            bed.setTenantName(t.getName());
                            return bed;
                        }
                    }
                } catch (Exception ignored) {}
                if (b.getTenantName() != null && !b.getTenantName().isBlank()) {
                    bed.setTenantName(b.getTenantName());
                }
                return bed;
            }
        }

        // No active tenant or booking found — if bed is stale "OCCUPIED" or "RESERVED", reset to available
        if ("OCCUPIED".equalsIgnoreCase(bed.getStatus()) || "RESERVED".equalsIgnoreCase(bed.getStatus())) {
            bed.setStatus("AVAILABLE");
            bed.setTenantId(null);
            bed.setTenantName(null);
        }
        return bed;
    }

    public Bed populateBedDetails(Bed bed, Organization organization) {
        return populateBedDetailsFast(bed, java.util.Collections.emptyMap(), java.util.Collections.emptyMap(), java.util.Collections.emptyMap(), java.util.Collections.emptyMap(), java.util.Collections.emptyMap());
    }

    @Caching(evict = {
        @CacheEvict(value = "beds_v4", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "rooms_v4", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "building_floors", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true)
    })
    public Bed saveBed(Bed bed) {
        return bedRepository.save(bed);
    }

    @Caching(evict = {
        @CacheEvict(value = "beds_v4", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "rooms_v4", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "building_floors", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true)
    })
    public void deleteBed(UUID id) {
        bedRepository.deleteById(id);
    }
}
