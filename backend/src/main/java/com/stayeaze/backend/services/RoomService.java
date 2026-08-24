package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Room;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.payload.response.RoomDTO;
import com.stayeaze.backend.repository.RoomRepository;
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
public class RoomService {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.repository.BedRepository bedRepository;

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    private Room populateRoomStats(Room room, Organization organization) {
        if (room == null) return null;
        List<com.stayeaze.backend.models.Bed> beds = bedRepository.findByRoom(room);

        if (beds.isEmpty() && room.getSharing() != null && room.getSharing() > 0) {
            for (int i = 1; i <= room.getSharing(); i++) {
                com.stayeaze.backend.models.Bed b = new com.stayeaze.backend.models.Bed(room, "B" + i);
                bedRepository.save(b);
            }
            beds = bedRepository.findByRoom(room);
        }

        room.setBeds(beds.size());

        List<com.stayeaze.backend.models.Tenant> activeTenants = null;
        try {
            activeTenants = organization != null ? tenantRepository.findByOrganization(organization) : tenantRepository.findAll();
        } catch (Exception ignored) {}

        int occ = 0;
        int res = 0;
        for (com.stayeaze.backend.models.Bed b : beds) {
            boolean isOccupied = "OCCUPIED".equalsIgnoreCase(b.getStatus());
            boolean isReserved = "RESERVED".equalsIgnoreCase(b.getStatus()) || "BOOKED".equalsIgnoreCase(b.getStatus());

            if (!isOccupied && activeTenants != null) {
                for (com.stayeaze.backend.models.Tenant t : activeTenants) {
                    boolean statusOk = t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus());
                    if (statusOk && room.getRoomNumber() != null && room.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) 
                            && b.getBedNumber() != null && b.getBedNumber().equalsIgnoreCase(t.getBedNumber())) {
                        isOccupied = true;
                        b.setStatus("OCCUPIED");
                        bedRepository.save(b);
                        break;
                    }
                }
            }

            if (isOccupied) occ++;
            else if (isReserved) res++;
        }
        room.setOccupied(occ);

        String currStatus = room.getStatus();
        if (currStatus == null || (!"MAINTENANCE".equalsIgnoreCase(currStatus) && !"BLOCKED".equalsIgnoreCase(currStatus) && !"ARCHIVED".equalsIgnoreCase(currStatus))) {
            int totalBeds = beds.size();
            if (totalBeds > 0) {
                if (occ == totalBeds) room.setStatus("occupied");
                else if (res == totalBeds) room.setStatus("reserved");
                else if (occ > 0) room.setStatus("partially_occupied");
                else if (res > 0) room.setStatus("partially_reserved");
                else room.setStatus("available");
            }
        }
        return room;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "rooms_v3", key = "#organization != null ? #organization.id.toString() : 'all_super_admin'")
    public List<RoomDTO> getRoomsByOrg(Organization organization) {
        List<Room> list = organization == null ? roomRepository.findAllSuperAdmin()
                : roomRepository.findByOrganizationId(organization.getId(), org.springframework.data.domain.Pageable.unpaged()).getContent();
        return list.stream()
                .map(r -> RoomDTO.fromEntity(populateRoomStats(r, organization)))
                .collect(Collectors.toList());
    }

    @Caching(evict = {
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "tenants", allEntries = true),
        @CacheEvict(value = "buildings", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "properties-minimal", allEntries = true),
        @CacheEvict(value = "tenants-minimal", allEntries = true)
    })
    public Room saveRoom(Room room) {
        Room saved = roomRepository.save(room);
        if (saved != null) {
            int max = saved.getSharing() != null && saved.getSharing() > 0 ? saved.getSharing() : 1;
            for (int i = 1; i <= max; i++) {
                String bedNo = "B" + i;
                if (!Boolean.TRUE.equals(bedRepository.existsByRoomIdAndBedNumber(saved.getId(), bedNo))) {
                    com.stayeaze.backend.models.Bed b = new com.stayeaze.backend.models.Bed(saved, bedNo);
                    b.setStatus("AVAILABLE");
                    try { bedRepository.save(b); } catch (Exception ignored) {}
                }
            }
        }
        return saved;
    }

    @Caching(evict = {
        @CacheEvict(value = "floors_v2", allEntries = true),
        @CacheEvict(value = "rooms_v3", allEntries = true),
        @CacheEvict(value = "beds_v3", allEntries = true),
        @CacheEvict(value = "tenants", allEntries = true),
        @CacheEvict(value = "buildings", allEntries = true),
        @CacheEvict(value = "propertyDtos", allEntries = true),
        @CacheEvict(value = "minimalProperties", allEntries = true),
        @CacheEvict(value = "properties-minimal", allEntries = true),
        @CacheEvict(value = "tenants-minimal", allEntries = true)
    })
    public void deleteRoom(UUID id) {
        roomRepository.deleteById(id);
    }
}
