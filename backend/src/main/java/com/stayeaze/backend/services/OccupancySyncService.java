package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OccupancySyncService {

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private FloorService floorService;

    @Transactional
    public void syncStatsAndEvictCaches(Floor floor) {
        if (floor == null) {
            floorService.evictCaches();
            return;
        }

        Building building = floor.getBuilding();
        if (building != null) {
            List<Floor> activeFloors = floorRepository.findByBuilding(building).stream()
                    .filter(f -> f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus()))
                    .collect(Collectors.toList());

            int bldRooms = 0, bldBeds = 0, bldOcc = 0;
            for (Floor f : activeFloors) {
                List<Room> fRooms = roomRepository.findByFloor(f).stream()
                        .filter(r -> r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus()))
                        .collect(Collectors.toList());
                bldRooms += fRooms.size();
                for (Room r : fRooms) {
                    List<Bed> rBeds = bedRepository.findByRoom(r).stream()
                            .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                            .collect(Collectors.toList());
                    bldBeds += rBeds.size();
                    bldOcc += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                }
            }
            building.setRooms(bldRooms);
            building.setBeds(bldBeds);
            building.setOccupied(bldOcc);
            buildingRepository.save(building);

            Property property = building.getProperty();
            if (property != null) {
                List<Building> pBuildings = buildingRepository.findByProperty(property);
                int propRooms = pBuildings.stream().mapToInt(Building::getRooms).sum();
                int propBeds = pBuildings.stream().mapToInt(Building::getBeds).sum();
                int propOcc = pBuildings.stream().mapToInt(Building::getOccupied).sum();
                property.setTotalRooms(propRooms);
                property.setTotalBeds(propBeds);
                property.setOccupiedBeds(propOcc);
                propertyRepository.save(property);
            }
        }
        floorService.evictCaches();
    }

    @Transactional
    public void syncAllStatsForOrg(Organization organization) {
        if (organization == null) return;
        try {
            List<Building> buildings = buildingRepository.findByOrganization(organization);
            for (Building building : buildings) {
                List<Floor> activeFloors = floorRepository.findByBuilding(building).stream()
                        .filter(f -> f.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(f.getStatus()))
                        .collect(Collectors.toList());

                int bldRooms = 0, bldBeds = 0, bldOcc = 0;
                for (Floor f : activeFloors) {
                    List<Room> fRooms = roomRepository.findByFloor(f).stream()
                            .filter(r -> r.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(r.getStatus()))
                            .collect(Collectors.toList());
                    bldRooms += fRooms.size();
                    for (Room r : fRooms) {
                        List<Bed> rBeds = bedRepository.findByRoom(r).stream()
                                .filter(b -> b.getStatus() == null || !"ARCHIVED".equalsIgnoreCase(b.getStatus()))
                                .collect(Collectors.toList());
                        bldBeds += rBeds.size();
                        bldOcc += (int) rBeds.stream().filter(b -> "OCCUPIED".equalsIgnoreCase(b.getStatus())).count();
                    }
                }
                building.setRooms(bldRooms);
                building.setBeds(bldBeds);
                building.setOccupied(bldOcc);
                buildingRepository.save(building);

                Property property = building.getProperty();
                if (property != null) {
                    List<Building> pBuildings = buildingRepository.findByProperty(property);
                    int propRooms = pBuildings.stream().mapToInt(Building::getRooms).sum();
                    int propBeds = pBuildings.stream().mapToInt(Building::getBeds).sum();
                    int propOcc = pBuildings.stream().mapToInt(Building::getOccupied).sum();
                    property.setTotalRooms(propRooms);
                    property.setTotalBeds(propBeds);
                    property.setOccupiedBeds(propOcc);
                    propertyRepository.save(property);
                }
            }
        } catch (Exception e) {
            System.err.println("Error syncing organization stats: " + e.getMessage());
        }
        floorService.evictCaches();
    }

    @Transactional
    public void syncStatsForRoom(Room room) {
        if (room != null && room.getFloor() != null) {
            syncStatsAndEvictCaches(room.getFloor());
        } else {
            floorService.evictCaches();
        }
    }
}
