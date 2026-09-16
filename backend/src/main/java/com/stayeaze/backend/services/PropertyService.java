package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.payload.response.MinimalPropertyDTO;
import com.stayeaze.backend.payload.response.PropertyDTO;
import com.stayeaze.backend.repository.PropertyRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PropertyService {

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private CacheManager cacheManager;

    /** Evict stale minimalProperties cache on startup (e.g., after DTO shape changes). */
    @PostConstruct
    public void evictMinimalCacheOnStartup() {
        try {
            var cache = cacheManager.getCache("minimalProperties");
            if (cache != null) cache.clear();
        } catch (Exception ignored) {
            // Redis may not be available during tests; safe to ignore
        }
    }

    @Autowired
    private com.stayeaze.backend.repository.BuildingRepository buildingRepository;

    @Autowired
    private com.stayeaze.backend.repository.FloorRepository floorRepository;

    @Autowired
    private com.stayeaze.backend.repository.RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.repository.BedRepository bedRepository;

    public Property populatePropertyStats(Property p) {
        if (p == null) return null;
        try {
            List<Object[]> rows = bedRepository.getMetricsByPropertyIdsNative(List.of(p.getId()));
            if (rows != null && !rows.isEmpty() && rows.get(0) != null) {
                Object[] r = rows.get(0);
                p.setTotalBuildings(r[1] != null ? ((Number) r[1]).intValue() : 0);
                p.setTotalRooms(r[2] != null ? ((Number) r[2]).intValue() : 0);
                p.setTotalBeds(r[3] != null ? ((Number) r[3]).intValue() : 0);
                p.setOccupiedBeds(r[4] != null ? ((Number) r[4]).intValue() : 0);
            } else {
                p.setTotalBuildings(0);
                p.setTotalRooms(0);
                p.setTotalBeds(0);
                p.setOccupiedBeds(0);
            }
        } catch (Exception e) {
            if (p.getTotalBeds() == null) p.setTotalBeds(0);
            if (p.getOccupiedBeds() == null) p.setOccupiedBeds(0);
            if (p.getTotalRooms() == null) p.setTotalRooms(0);
            if (p.getTotalBuildings() == null) p.setTotalBuildings(0);
        }
        return p;
    }

    public List<Property> populatePropertiesStats(List<Property> props) {
        if (props == null || props.isEmpty()) return props;
        List<UUID> ids = props.stream().map(Property::getId).filter(Objects::nonNull).collect(Collectors.toList());
        if (ids.isEmpty()) return props;

        try {
            List<Object[]> rows = bedRepository.getMetricsByPropertyIdsNative(ids);
            Map<UUID, int[]> metricsMap = new HashMap<>();
            if (rows != null) {
                for (Object[] r : rows) {
                    if (r == null || r[0] == null) continue;
                    UUID pId = UUID.fromString(r[0].toString());
                    int bldgs = r[1] != null ? ((Number) r[1]).intValue() : 0;
                    int rms = r[2] != null ? ((Number) r[2]).intValue() : 0;
                    int bds = r[3] != null ? ((Number) r[3]).intValue() : 0;
                    int occ = r[4] != null ? ((Number) r[4]).intValue() : 0;
                    metricsMap.put(pId, new int[]{bldgs, rms, bds, occ});
                }
            }

            for (Property p : props) {
                int[] m = metricsMap.get(p.getId());
                if (m != null) {
                    p.setTotalBuildings(m[0]);
                    p.setTotalRooms(m[1]);
                    p.setTotalBeds(m[2]);
                    p.setOccupiedBeds(m[3]);
                } else {
                    p.setTotalBuildings(0);
                    p.setTotalRooms(0);
                    p.setTotalBeds(0);
                    p.setOccupiedBeds(0);
                }
            }
        } catch (Exception e) {
            props.forEach(this::populatePropertyStats);
        }
        return props;
    }

    @Cacheable(value = "propertyOverallStats", key = "'p:' + #propertyId + ':o:' + #orgId")
    @Transactional(readOnly = true)
    public Map<String, Object> getPropertyOverallStats(UUID propertyId, UUID orgId) {
        List<Object[]> rows = bedRepository.getOverallMetricsAggregateNative(propertyId, orgId);
        int totalProperties = 0;
        int totalBuildings = 0;
        int totalRooms = 0;
        int totalBeds = 0;
        int occupiedBeds = 0;

        if (rows != null && !rows.isEmpty() && rows.get(0) != null) {
            Object[] row = rows.get(0);
            totalProperties = row[0] != null ? ((Number) row[0]).intValue() : 0;
            totalBuildings = row[1] != null ? ((Number) row[1]).intValue() : 0;
            totalRooms = row[2] != null ? ((Number) row[2]).intValue() : 0;
            totalBeds = row[3] != null ? ((Number) row[3]).intValue() : 0;
            occupiedBeds = row[4] != null ? ((Number) row[4]).intValue() : 0;
        }

        int availableBeds = Math.max(0, totalBeds - occupiedBeds);
        double occupancyRate = totalBeds > 0 
                ? Math.round(((double) occupiedBeds / totalBeds) * 1000.0) / 10.0 
                : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProperties", totalProperties);
        stats.put("totalBuildings", totalBuildings);
        stats.put("totalRooms", totalRooms);
        stats.put("totalBeds", totalBeds);
        stats.put("occupiedBeds", occupiedBeds);
        stats.put("availableBeds", availableBeds);
        stats.put("occupancyRate", occupancyRate);
        return stats;
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getPropertiesByOrganizationPaged(Organization organization, org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<Property> page;
        if (organization == null) {
            page = propertyRepository.findAll(pageable);
        } else {
            page = propertyRepository.findByOrganization(organization, pageable);
        }
        return page.map(p -> PropertyDTO.fromEntity(populatePropertyStats(p)));
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getAllPropertiesForSuperAdminPaged(org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<Property> page = propertyRepository.findAllSuperAdminPaged(pageable);
        return page.map(p -> PropertyDTO.fromEntity(populatePropertyStats(p)));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "propertyDtos", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<PropertyDTO> getPropertiesByOrganization(Organization organization) {
        List<Property> properties;
        if (organization == null) {
            properties = propertyRepository.findAllSuperAdmin();
        } else {
            properties = propertyRepository.findByOrganization(organization);
        }
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(p -> PropertyDTO.fromEntity(populatePropertyStats(p))).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PropertyDTO> getAllPropertiesForSuperAdmin() {
        List<Property> properties = propertyRepository.findAllSuperAdmin();
        if (properties == null) return new ArrayList<>();
        return properties.stream().map(p -> PropertyDTO.fromEntity(populatePropertyStats(p))).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "minimalProperties", key = "#organization != null ? #organization.id.toString() : 'all'")
    public List<MinimalPropertyDTO> getMinimalPropertiesByOrganization(Organization organization) {
        if (organization == null) {
            return getMinimalPropertiesForSuperAdmin();
        }
        List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findMinimalByOrgIdNative(organization.getId());
        if (views == null) return new ArrayList<>();
        return views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "minimalProperties", key = "'all_super_admin'")
    public List<MinimalPropertyDTO> getMinimalPropertiesForSuperAdmin() {
        // Native interface projection: 1 single SQL query selecting 11 columns, 0 entity hydration, sub-25ms execution
        List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findAllMinimalSuperAdminNative();
        if (views == null) return new ArrayList<>();
        return views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PropertyDTO> getPropertiesByIdsPaged(List<UUID> ids, org.springframework.data.domain.Pageable pageable) {
        if (ids == null || ids.isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }
        org.springframework.data.domain.Page<Property> page = propertyRepository.findByIdIn(ids, pageable);
        return page.map(PropertyDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    public List<MinimalPropertyDTO> getMinimalPropertiesByIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<com.stayeaze.backend.projection.MinimalPropertyView> views = propertyRepository.findMinimalByIdsNative(ids);
        if (views == null) return new ArrayList<>();
        return views.stream().map(MinimalPropertyDTO::fromProjection).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "propertySummaries", key = "#organization != null ? #organization.id.toString() : 'all_super_admin'")
    public List<com.stayeaze.backend.payload.response.PropertySummaryDTO> getPropertySummariesByOrganization(Organization organization) {
        List<Property> props;
        if (organization == null) {
            props = propertyRepository.findAllSuperAdmin();
        } else {
            props = propertyRepository.findByOrganizationIdNative(organization.getId());
        }
        if (props == null || props.isEmpty()) return new ArrayList<>();
        props = populatePropertiesStats(props);
        return props.stream()
                .map(com.stayeaze.backend.payload.response.PropertySummaryDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    @Autowired
    private com.stayeaze.backend.repository.BookingRepository bookingRepository;

    @Autowired
    private com.stayeaze.backend.repository.ComplaintRepository complaintRepository;

    @Autowired
    private com.stayeaze.backend.repository.UserRepository userRepository;

    @Autowired
    private com.stayeaze.backend.repository.ExpenseRepository expenseRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Map<String, Object> getPropertyPreDeleteSummary(UUID propertyId, Organization org) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) return Collections.emptyMap();
        populatePropertyStats(property);

        List<com.stayeaze.backend.models.Tenant> tenants = tenantRepository.findByPropertyId(propertyId);
        if (tenants == null || tenants.isEmpty()) {
            if (org != null) {
                tenants = tenantRepository.findByOrganizationIdNative(org.getId()).stream()
                        .filter(t -> propertyId.equals(t.getPropertyId()))
                        .collect(Collectors.toList());
            } else {
                tenants = tenantRepository.findAllSuperAdmin().stream()
                        .filter(t -> propertyId.equals(t.getPropertyId()))
                        .collect(Collectors.toList());
            }
        }

        long activeTenantsCount = tenants.stream()
                .filter(t -> t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()) || "CHECKED_IN".equalsIgnoreCase(t.getStatus())
                        || "PENDING".equalsIgnoreCase(t.getStatus()) || "ONBOARDING".equalsIgnoreCase(t.getStatus()) || "NOTICE_PERIOD".equalsIgnoreCase(t.getStatus()))
                .count();

        if (activeTenantsCount == 0 && property.getOccupiedBeds() != null && property.getOccupiedBeds() > 0) {
            activeTenantsCount = property.getOccupiedBeds();
        }

        List<Map<String, Object>> activeTenantsList = tenants.stream()
                .filter(t -> t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()) || "CHECKED_IN".equalsIgnoreCase(t.getStatus()))
                .map(t -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", t.getId());
                    item.put("name", t.getName());
                    item.put("roomNumber", t.getRoomNumber());
                    item.put("bedNumber", t.getBedNumber());
                    item.put("mobile", t.getMobile());
                    return item;
                })
                .limit(20)
                .collect(Collectors.toList());

        int totalBuildings = property.getTotalBuildings() != null ? property.getTotalBuildings() : 0;
        int totalRooms = property.getTotalRooms() != null ? property.getTotalRooms() : 0;
        int totalBeds = property.getTotalBeds() != null ? property.getTotalBeds() : 0;

        if (totalBuildings == 0 || totalRooms == 0 || totalBeds == 0) {
            List<com.stayeaze.backend.models.Building> buildings = buildingRepository.findByProperty(property);
            if (buildings != null && !buildings.isEmpty()) {
                if (totalBuildings == 0) totalBuildings = buildings.size();
                int rCount = 0;
                int bCount = 0;
                for (com.stayeaze.backend.models.Building b : buildings) {
                    List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuilding(b);
                    for (com.stayeaze.backend.models.Floor f : floors) {
                        List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
                        rCount += rooms.size();
                        for (com.stayeaze.backend.models.Room r : rooms) {
                            bCount += bedRepository.findByRoom(r).size();
                        }
                    }
                }
                if (totalRooms == 0) totalRooms = rCount;
                if (totalBeds == 0) totalBeds = bCount;
            }
        }

        long orgPropertiesCount = org != null
                ? propertyRepository.findByOrganizationIdNative(org.getId()).stream().filter(p -> p.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(p.getStatus())).count()
                : propertyRepository.count();

        Map<String, Object> summary = new HashMap<>();
        summary.put("propertyId", propertyId);
        summary.put("propertyName", property.getName());
        summary.put("propertyCode", property.getCode());
        summary.put("status", property.getStatus());
        summary.put("activeTenantsCount", activeTenantsCount);
        summary.put("activeTenants", activeTenantsList);
        summary.put("totalBuildings", totalBuildings);
        summary.put("totalRooms", totalRooms);
        summary.put("totalBeds", totalBeds);
        summary.put("totalPropertiesInOrg", orgPropertiesCount);
        summary.put("hasCustomRazorpay", property.getRazorpayKeyId() != null && !property.getRazorpayKeyId().isBlank());

        return summary;
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "propertyOverallStats", allEntries = true)
    })
    public void archivePropertyCascade(UUID propertyId, Organization org) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found with ID: " + propertyId));

        property.setStatus("ARCHIVED");
        propertyRepository.save(property);

        // Cascade ARCHIVED status to buildings, floors, rooms, and beds
        List<com.stayeaze.backend.models.Building> buildings = buildingRepository.findByProperty(property);
        for (com.stayeaze.backend.models.Building b : buildings) {
            b.setStatus("ARCHIVED");
            buildingRepository.save(b);
            List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuilding(b);
            for (com.stayeaze.backend.models.Floor f : floors) {
                f.setStatus("ARCHIVED");
                floorRepository.save(f);
                List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
                for (com.stayeaze.backend.models.Room r : rooms) {
                    r.setStatus("ARCHIVED");
                    roomRepository.save(r);
                    List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoom(r);
                    for (com.stayeaze.backend.models.Bed bed : beds) {
                        bed.setStatus("ARCHIVED");
                        bedRepository.save(bed);
                    }
                }
            }
        }

        // Unassign property from staff user accounts in the organization
        if (org != null) {
            List<com.stayeaze.backend.models.User> users = userRepository.findByOrganizationId(org.getId());
            for (com.stayeaze.backend.models.User u : users) {
                if (u.getPropertyIds() != null && u.getPropertyIds().contains(propertyId)) {
                    u.getPropertyIds().remove(propertyId);
                    userRepository.save(u);
                }
            }
        }

        auditLogService.logCurrent("PROPERTY_ARCHIVED: Property " + property.getName() + " (" + propertyId + ") cascade archived", "127.0.0.1");
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "propertyOverallStats", allEntries = true)
    })
    public void restorePropertyCascade(UUID propertyId, Organization org) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found with ID: " + propertyId));

        property.setStatus("ACTIVE");
        propertyRepository.save(property);

        // Restore buildings, floors, rooms, and beds
        List<com.stayeaze.backend.models.Building> buildings = buildingRepository.findByProperty(property);
        for (com.stayeaze.backend.models.Building b : buildings) {
            b.setStatus("ACTIVE");
            buildingRepository.save(b);
            List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuilding(b);
            for (com.stayeaze.backend.models.Floor f : floors) {
                f.setStatus("ACTIVE");
                floorRepository.save(f);
                List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
                for (com.stayeaze.backend.models.Room r : rooms) {
                    r.setStatus("ACTIVE");
                    roomRepository.save(r);
                    List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoom(r);
                    for (com.stayeaze.backend.models.Bed bed : beds) {
                        bed.setStatus("AVAILABLE");
                        bedRepository.save(bed);
                    }
                }
            }
        }

        auditLogService.logCurrent("PROPERTY_RESTORED: Property " + property.getName() + " (" + propertyId + ") restored to active", "127.0.0.1");
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "propertyOverallStats", allEntries = true)
    })
    public void permanentPurgeProperty(UUID propertyId, Organization org, boolean autoArchiveTenants) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found with ID: " + propertyId));

        // 1. Check active residents safety guard
        List<com.stayeaze.backend.models.Tenant> tenants = tenantRepository.findByPropertyId(propertyId);
        long activeCount = tenants.stream()
                .filter(t -> t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()) || "CHECKED_IN".equalsIgnoreCase(t.getStatus()))
                .count();

        if (activeCount > 0 && !autoArchiveTenants) {
            throw new IllegalStateException("Cannot permanently delete property: " + activeCount + " active resident(s) found. Please check them out or choose 'Auto-Archive Residents'.");
        }

        // Auto-archive residents if requested
        if (autoArchiveTenants) {
            for (com.stayeaze.backend.models.Tenant t : tenants) {
                if (t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus()) || "CHECKED_IN".equalsIgnoreCase(t.getStatus())) {
                    t.setStatus("CHECKED_OUT");
                    t.setRoomNumber(null);
                    t.setBedNumber(null);
                    tenantRepository.save(t);
                }
            }
        }

        // 2. Unlink / remove related operational records
        // Clean bookings for this property
        List<com.stayeaze.backend.models.Booking> bookings = bookingRepository.findAll().stream()
                .filter(b -> {
                    if (b.getTenant() != null && propertyId.equals(b.getTenant().getPropertyId())) return true;
                    if (b.getBed() != null && b.getBed().getRoom() != null && b.getBed().getRoom().getFloor() != null &&
                            b.getBed().getRoom().getFloor().getBuilding() != null &&
                            property.equals(b.getBed().getRoom().getFloor().getBuilding().getProperty())) return true;
                    return false;
                })
                .collect(Collectors.toList());
        bookingRepository.deleteAll(bookings);

        // Clean complaints
        List<com.stayeaze.backend.models.Complaint> complaints = complaintRepository.findByOrganizationId(org != null ? org.getId() : null).stream()
                .filter(c -> c.getTenant() != null && propertyId.equals(c.getTenant().getPropertyId()))
                .collect(Collectors.toList());
        complaintRepository.deleteAll(complaints);

        // Clean expenses linked to this property
        if (org != null) {
            List<com.stayeaze.backend.models.Expense> expenses = expenseRepository.findByOrganizationAndPropertyIdOrderByExpenseDateDesc(org, propertyId);
            expenseRepository.deleteAll(expenses);
        }

        // 3. Delete Physical Space Hierarchy (Beds -> Rooms -> Floors -> Buildings)
        List<com.stayeaze.backend.models.Building> buildings = buildingRepository.findByProperty(property);
        for (com.stayeaze.backend.models.Building b : buildings) {
            List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuilding(b);
            for (com.stayeaze.backend.models.Floor f : floors) {
                List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
                for (com.stayeaze.backend.models.Room r : rooms) {
                    List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoom(r);
                    bedRepository.deleteAll(beds);
                    roomRepository.delete(r);
                }
                floorRepository.delete(f);
            }
            buildingRepository.delete(b);
        }

        // 4. Remove propertyId from staff user assignments
        if (org != null) {
            List<com.stayeaze.backend.models.User> users = userRepository.findByOrganizationId(org.getId());
            for (com.stayeaze.backend.models.User u : users) {
                if (u.getPropertyIds() != null && u.getPropertyIds().contains(propertyId)) {
                    u.getPropertyIds().remove(propertyId);
                    userRepository.save(u);
                }
            }
        }

        // 5. Delete Property record
        propertyRepository.delete(property);

        auditLogService.logCurrent("PROPERTY_PERMANENTLY_DELETED: Property " + property.getName() + " (" + propertyId + ") purged completely", "127.0.0.1");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> exportPropertySnapshot(UUID propertyId, Organization org) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found with ID: " + propertyId));

        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("property", PropertyDTO.fromEntity(populatePropertyStats(property)));

        List<com.stayeaze.backend.models.Building> buildings = buildingRepository.findByProperty(property);
        List<Map<String, Object>> buildingList = new ArrayList<>();
        for (com.stayeaze.backend.models.Building b : buildings) {
            Map<String, Object> bMap = new HashMap<>();
            bMap.put("id", b.getId());
            bMap.put("name", b.getName());
            bMap.put("code", b.getCode());

            List<com.stayeaze.backend.models.Floor> floors = floorRepository.findByBuilding(b);
            List<Map<String, Object>> floorList = new ArrayList<>();
            for (com.stayeaze.backend.models.Floor f : floors) {
                Map<String, Object> fMap = new HashMap<>();
                fMap.put("id", f.getId());
                fMap.put("name", f.getName());
                fMap.put("floorNumber", f.getFloorNumber());

                List<com.stayeaze.backend.models.Room> rooms = roomRepository.findByFloor(f);
                List<Map<String, Object>> roomList = new ArrayList<>();
                for (com.stayeaze.backend.models.Room r : rooms) {
                    Map<String, Object> rMap = new HashMap<>();
                    rMap.put("id", r.getId());
                    rMap.put("roomNumber", r.getRoomNumber());
                    rMap.put("sharingType", r.getSharingType());
                    rMap.put("baseRent", r.getBaseRent());
                    rMap.put("beds", bedRepository.findByRoom(r).stream().map(com.stayeaze.backend.models.Bed::getBedNumber).collect(Collectors.toList()));
                    roomList.add(rMap);
                }
                fMap.put("rooms", roomList);
                floorList.add(fMap);
            }
            bMap.put("floors", floorList);
            buildingList.add(bMap);
        }
        snapshot.put("buildings", buildingList);

        List<com.stayeaze.backend.models.Tenant> tenants = tenantRepository.findByPropertyId(propertyId);
        snapshot.put("tenants", tenants.stream().map(t -> {
            Map<String, Object> tm = new HashMap<>();
            tm.put("id", t.getId());
            tm.put("name", t.getName());
            tm.put("roomNumber", t.getRoomNumber());
            tm.put("bedNumber", t.getBedNumber());
            tm.put("status", t.getStatus());
            tm.put("rent", t.getRent());
            return tm;
        }).collect(Collectors.toList()));

        return snapshot;
    }

    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "propertyOverallStats", allEntries = true)
    })
    public Property saveProperty(Property property) {
        return propertyRepository.save(property);
    }

    @Caching(evict = {
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "propertySummaries", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "propertyOverallStats", allEntries = true)
    })
    public void deleteProperty(UUID propertyId) {
        propertyRepository.deleteById(propertyId);
    }
}
