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
    private com.stayeaze.backend.repository.RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    @Autowired
    private com.stayeaze.backend.repository.BookingRepository bookingRepository;

    private Bed populateBedDetails(Bed bed, Organization organization) {
        if (bed == null) return bed;
        String roomNum = null;
        try {
            if (bed.getRoom() != null) {
                roomNum = bed.getRoom().getRoomNumber();
            }
        } catch (Exception ignored) {}

        try {
            // Fast path: if bed has a stored tenantId, look up that tenant directly
            if (bed.getTenantId() != null && !bed.getTenantId().isBlank()) {
                try {
                    java.util.UUID tenantUUID = java.util.UUID.fromString(bed.getTenantId());
                    com.stayeaze.backend.models.Tenant directTenant = tenantRepository.findById(tenantUUID).orElse(null);
                    if (directTenant != null) {
                        String ts = directTenant.getStatus();
                        boolean checkedOut = "CHECKED_OUT".equalsIgnoreCase(ts);
                        if (!checkedOut) {
                            bed.setTenantName(directTenant.getName());
                            bed.setTenantId(directTenant.getId().toString());
                            bed.setStatus("OCCUPIED");
                            return bed;
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Scan active tenants for room+bed match
            List<com.stayeaze.backend.models.Tenant> activeTenants = organization != null
                    ? tenantRepository.findByOrganization(organization)
                    : tenantRepository.findAll();
            for (com.stayeaze.backend.models.Tenant t : activeTenants) {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts);
                if (isCheckedOut) continue;
                boolean roomMatch = roomNum != null && roomNum.equalsIgnoreCase(t.getRoomNumber());
                boolean bedMatch = bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(t.getBedNumber());
                if (roomMatch && bedMatch) {
                    bed.setStatus("OCCUPIED");
                    bed.setTenantId(t.getId().toString());
                    bed.setTenantName(t.getName());
                    return bed;
                }
            }

            // Scan bookings for reserved/checked-in bed
            List<com.stayeaze.backend.models.Booking> activeBookings = organization != null
                    ? bookingRepository.findByOrganizationId(organization.getId())
                    : bookingRepository.findAll();
            for (com.stayeaze.backend.models.Booking b : activeBookings) {
                boolean statusOk = b.getStatus() == null
                        || "CONFIRMED".equalsIgnoreCase(b.getStatus())
                        || "CHECKED_IN".equalsIgnoreCase(b.getStatus())
                        || "PENDING".equalsIgnoreCase(b.getStatus());
                if (statusOk) {
                    boolean roomMatch = roomNum != null && roomNum.equalsIgnoreCase(b.getRoomNumber());
                    boolean bedMatch = bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(b.getBedNumber());
                    boolean directBedMatch = b.getBed() != null && b.getBed().getId().equals(bed.getId());
                    if (directBedMatch || (roomMatch && bedMatch)) {
                        if ("CHECKED_IN".equalsIgnoreCase(b.getStatus())) {
                            bed.setStatus("OCCUPIED");
                        } else {
                            bed.setStatus("RESERVED");
                        }
                        if (b.getTenant() != null) {
                            bed.setTenantId(b.getTenant().getId().toString());
                            bed.setTenantName(b.getTenant().getName());
                        } else if (b.getTenantName() != null) {
                            bed.setTenantName(b.getTenantName());
                        }
                        return bed;
                    }
                }
            }

            // No active tenant or booking found — if bed is stale "OCCUPIED", reset to available
            if ("OCCUPIED".equalsIgnoreCase(bed.getStatus()) || "RESERVED".equalsIgnoreCase(bed.getStatus())) {
                bed.setStatus("available");
                bed.setTenantId(null);
                bed.setTenantName(null);
            }
        } catch (Exception ignored) {}
        return bed;
    }

    @Transactional
    public List<BedDTO> getBedsByOrg(Organization organization) {
        try {
            List<com.stayeaze.backend.models.Room> rooms = organization == null
                    ? roomRepository.findAll()
                    : roomRepository.findByOrganizationId(organization.getId());
            if (rooms != null) {
                for (com.stayeaze.backend.models.Room r : rooms) {
                    List<Bed> existing = bedRepository.findByRoomId(r.getId());
                    if (existing == null || existing.isEmpty()) {
                        int max = r.getSharing() != null && r.getSharing() > 0 ? r.getSharing() : 1;
                        for (int i = 1; i <= max; i++) {
                            String bedNo = "B" + i;
                            if (!Boolean.TRUE.equals(bedRepository.existsByRoomAndBedNumber(r, bedNo))) {
                                Bed b = new Bed(r, bedNo);
                                b.setStatus("AVAILABLE");
                                try { bedRepository.save(b); } catch (Exception ignored) {}
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        List<Bed> list = organization == null ? bedRepository.findAllSuperAdmin()
                : bedRepository.findByOrganizationId(organization.getId(), org.springframework.data.domain.Pageable.unpaged()).getContent();
        return list.stream()
                .map(b -> BedDTO.fromEntity(populateBedDetails(b, organization)))
                .collect(Collectors.toList());
    }

    @Caching(evict = {
        @CacheEvict(value = "beds_v3", allEntries = true)
    })
    public Bed saveBed(Bed bed) {
        return bedRepository.save(bed);
    }

    @Caching(evict = {
        @CacheEvict(value = "beds_v3", allEntries = true)
    })
    public void deleteBed(UUID id) {
        bedRepository.deleteById(id);
    }
}
