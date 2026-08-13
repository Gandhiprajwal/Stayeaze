package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.TenantRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.MinimalTenantDTO;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private CheckInRepository checkInRepository;

    private Organization getLoggedUserOrg() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return organizationRepository.findById(userDetails.getOrgId())
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createTenant(@Valid @RequestBody TenantRequest request) {
        Organization organization = getLoggedUserOrg();

        // Mobile uniqueness scoped to the same organization
        boolean mobileExists = tenantRepository.findByOrganization(organization).stream()
                .anyMatch(t -> request.getMobile() != null && request.getMobile().equalsIgnoreCase(t.getMobile()));
        if (mobileExists) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number already registered to an existing tenant!"));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank()) {

            // Bed occupied = any non-checked-out tenant in the same bed (ACTIVE, PENDING_CHECKIN, PENDING, RESERVED, etc.)
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts);
                return !isCheckedOut &&
                    request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                    request.getBedNumber().equalsIgnoreCase(t.getBedNumber());
            });
            if (bedOccupied) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " in Room " + request.getRoomNumber() + " is already occupied!"));
            }

            // Check if room or building/floor/bed is archived/unavailable
            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            Room room = orgRooms.stream().filter(r -> request.getRoomNumber().equalsIgnoreCase(r.getRoomNumber())).findFirst().orElse(null);
            if (room != null) {
                String rStatus = room.getStatus();
                if (rStatus != null && ("ARCHIVED".equalsIgnoreCase(rStatus) || "MAINTENANCE".equalsIgnoreCase(rStatus) || "BLOCKED".equalsIgnoreCase(rStatus))) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Error: Room " + request.getRoomNumber() + " is " + rStatus.toLowerCase() + " and cannot be assigned!"));
                }
                if (room.getFloor() != null) {
                    String fStatus = room.getFloor().getStatus();
                    if (fStatus != null && "ARCHIVED".equalsIgnoreCase(fStatus)) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: The floor for Room " + request.getRoomNumber() + " is archived!"));
                    }
                    if (room.getFloor().getBuilding() != null && "ARCHIVED".equalsIgnoreCase(room.getFloor().getBuilding().getStatus())) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: The building for Room " + request.getRoomNumber() + " is archived!"));
                    }
                }
                List<Bed> rBeds = bedRepository.findByRoom(room);
                Bed bed = rBeds.stream().filter(b -> request.getBedNumber().equalsIgnoreCase(b.getBedNumber())).findFirst().orElse(null);
                if (bed != null && bed.getStatus() != null) {
                    String bStatus = bed.getStatus();
                    if ("ARCHIVED".equalsIgnoreCase(bStatus) || "MAINTENANCE".equalsIgnoreCase(bStatus) || "BLOCKED".equalsIgnoreCase(bStatus)) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " is " + bStatus.toLowerCase() + " and cannot be assigned!"));
                    }
                }
            }
        }

        Tenant tenant = new Tenant(organization, request.getFirstName(), request.getLastName(), request.getMobile());
        tenant.setEmail(request.getEmail());
        tenant.setGender(request.getGender());
        tenant.setEmergencyContactName(request.getEmergencyContactName());
        tenant.setEmergencyContactMobile(request.getEmergencyContactMobile());
        
        tenant.setDob(request.getDob());
        tenant.setOccupation(request.getOccupation());
        tenant.setIdType(request.getIdType());
        tenant.setIdNumber(request.getIdNumber());
        tenant.setRent(request.getRent());
        tenant.setDeposit(request.getDeposit());
        tenant.setLeaseStart(request.getLeaseStart());
        tenant.setLeaseEnd(request.getLeaseEnd());
        tenant.setPropertyId(request.getPropertyId());
        tenant.setRoomNumber(request.getRoomNumber());
        tenant.setBedNumber(request.getBedNumber());
        tenant.setStatus(request.getStatus() != null ? request.getStatus().toUpperCase() : "PENDING_CHECKIN");

        Tenant saved = tenantRepository.save(tenant);

        // Auto-create CheckIn record
        try {
            CheckIn checkIn = new CheckIn();
            checkIn.setOrganization(organization);
            checkIn.setTenantName(saved.getFirstName() + " " + saved.getLastName());
            UUID propId = saved.getPropertyId();
            if (propId == null) {
                List<Property> props = propertyRepository.findByOrganization(organization);
                if (props != null && !props.isEmpty()) propId = props.get(0).getId();
                else propId = UUID.randomUUID();
            }
            checkIn.setPropertyId(propId);
            checkIn.setRoomNumber(saved.getRoomNumber() != null ? saved.getRoomNumber() : "101");
            checkIn.setBedNumber(saved.getBedNumber() != null ? saved.getBedNumber() : "B1");
            checkIn.setRent(saved.getRent());
            checkIn.setDepositPaid(saved.getDeposit());
            if (saved.getLeaseStart() != null && !saved.getLeaseStart().isBlank()) {
                try { checkIn.setCheckInDate(java.time.LocalDate.parse(saved.getLeaseStart())); } catch(Exception ignored){ checkIn.setCheckInDate(java.time.LocalDate.now()); }
            } else {
                checkIn.setCheckInDate(java.time.LocalDate.now());
            }
            if (saved.getLeaseEnd() != null && !saved.getLeaseEnd().isBlank()) {
                try { checkIn.setLeaseEnd(java.time.LocalDate.parse(saved.getLeaseEnd())); } catch(Exception ignored){}
            }
            if ("ACTIVE".equalsIgnoreCase(saved.getStatus()) || "CHECKED_IN".equalsIgnoreCase(saved.getStatus()) || "COMPLETED".equalsIgnoreCase(saved.getStatus())) {
                checkIn.setStatus("completed");
            } else {
                checkIn.setStatus("pending");
            }
            checkIn.setCode("CI-" + (System.currentTimeMillis() % 100000000L));
            checkInRepository.save(checkIn);
        } catch(Exception e) {
            System.err.println("Failed to auto-create CheckIn: " + e.getMessage());
            e.printStackTrace();
        }

        occupancySyncService.syncStatsAndEvictCaches(null);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<?> getAllTenants(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = getLoggedUserOrg();
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));

        User user = !isSuperAdmin ? userRepository.findById(userDetails.getId()).orElse(null) : null;
        if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
            List<MinimalTenantDTO> dtos = tenantRepository.findByOrganization(organization).stream()
                    .filter(t -> t.getPropertyId() != null && user.getPropertyIds().contains(t.getPropertyId()))
                    .map(MinimalTenantDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(dtos, page, pageSize));
        }

        org.springframework.data.domain.Page<Tenant> pageResult = isSuperAdmin
                ? tenantRepository.findAll(pageable)
                : tenantRepository.findByOrganization(organization, pageable);

        org.springframework.data.domain.Page<MinimalTenantDTO> dtoPage = pageResult.map(MinimalTenantDTO::fromEntity);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.ofPage(dtoPage));
    }

    @GetMapping("/minimal")
    public ResponseEntity<?> getMinimalTenants() {
        Organization organization = getLoggedUserOrg();
        List<Tenant> tenants = tenantRepository.findByOrganization(organization);
        List<MinimalTenantDTO> dtos = tenants.stream()
                .map(MinimalTenantDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTenantById(@PathVariable UUID id) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Tenant tenant;
        if (isSuperAdmin) {
            tenant = tenantRepository.findById(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        }

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        populateBuildingName(tenant);
        return ResponseEntity.ok(tenant);
    }

    private void populateBuildingName(Tenant tenant) {
        if (tenant == null || tenant.getRoomNumber() == null || tenant.getRoomNumber().isBlank()) return;
        try {
            List<Room> rooms;
            if (tenant.getOrganization() != null) {
                rooms = roomRepository.findByOrganizationId(tenant.getOrganization().getId());
            } else {
                rooms = roomRepository.findAll();
            }
            Room room = rooms.stream()
                .filter(r -> r.getRoomNumber() != null && r.getRoomNumber().equalsIgnoreCase(tenant.getRoomNumber()))
                .findFirst().orElse(null);
            if (room != null && room.getFloor() != null && room.getFloor().getBuilding() != null) {
                tenant.setBuildingName(room.getFloor().getBuilding().getName());
            }
        } catch (Exception ignored) {}
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateTenant(@PathVariable UUID id, @Valid @RequestBody TenantRequest request) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Tenant tenant;
        Organization organization = null;
        if (isSuperAdmin) {
            tenant = tenantRepository.findById(id).orElse(null);
            if (tenant != null) organization = tenant.getOrganization();
        } else {
            organization = getLoggedUserOrg();
            tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        }

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        String reqMobile = request.getMobile();
        if (reqMobile != null && !reqMobile.isBlank() && organization != null) {
            boolean mobileTakenByOther = tenantRepository.findByOrganization(organization).stream()
                .anyMatch(t -> !t.getId().equals(id) && reqMobile.equalsIgnoreCase(t.getMobile()));
            if (mobileTakenByOther) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number already registered to another tenant!"));
            }
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank()) {
            // Bed occupied = any non-checked-out OTHER tenant in the same bed
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts);
                return !t.getId().equals(id) && !isCheckedOut &&
                    request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                    request.getBedNumber().equalsIgnoreCase(t.getBedNumber());
            });
            if (bedOccupied) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " in Room " + request.getRoomNumber() + " is already occupied!"));
            }

            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            Room room = orgRooms.stream().filter(r -> request.getRoomNumber().equalsIgnoreCase(r.getRoomNumber())).findFirst().orElse(null);
            if (room != null) {
                String rStatus = room.getStatus();
                if (rStatus != null && ("ARCHIVED".equalsIgnoreCase(rStatus) || "MAINTENANCE".equalsIgnoreCase(rStatus) || "BLOCKED".equalsIgnoreCase(rStatus))) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Error: Room " + request.getRoomNumber() + " is " + rStatus.toLowerCase() + " and cannot be assigned!"));
                }
                if (room.getFloor() != null) {
                    String fStatus = room.getFloor().getStatus();
                    if (fStatus != null && "ARCHIVED".equalsIgnoreCase(fStatus)) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: The floor for Room " + request.getRoomNumber() + " is archived!"));
                    }
                    if (room.getFloor().getBuilding() != null && "ARCHIVED".equalsIgnoreCase(room.getFloor().getBuilding().getStatus())) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: The building for Room " + request.getRoomNumber() + " is archived!"));
                    }
                }
                List<Bed> rBeds = bedRepository.findByRoom(room);
                Bed bed = rBeds.stream().filter(b -> request.getBedNumber().equalsIgnoreCase(b.getBedNumber())).findFirst().orElse(null);
                if (bed != null && bed.getStatus() != null) {
                    String bStatus = bed.getStatus();
                    if ("ARCHIVED".equalsIgnoreCase(bStatus) || "MAINTENANCE".equalsIgnoreCase(bStatus) || "BLOCKED".equalsIgnoreCase(bStatus)) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " is " + bStatus.toLowerCase() + " and cannot be assigned!"));
                    }
                }
            }
        }

        tenant.setFirstName(request.getFirstName());
        tenant.setLastName(request.getLastName());
        tenant.setEmail(request.getEmail());
        tenant.setMobile(request.getMobile());
        tenant.setGender(request.getGender());
        tenant.setEmergencyContactName(request.getEmergencyContactName());
        tenant.setEmergencyContactMobile(request.getEmergencyContactMobile());
        
        tenant.setDob(request.getDob());
        tenant.setOccupation(request.getOccupation());
        tenant.setIdType(request.getIdType());
        tenant.setIdNumber(request.getIdNumber());
        tenant.setRent(request.getRent());
        tenant.setDeposit(request.getDeposit());
        tenant.setLeaseStart(request.getLeaseStart());
        tenant.setLeaseEnd(request.getLeaseEnd());
        tenant.setPropertyId(request.getPropertyId());
        tenant.setRoomNumber(request.getRoomNumber());
        tenant.setBedNumber(request.getBedNumber());
        if (request.getStatus() != null) {
            tenant.setStatus(request.getStatus().toUpperCase());
        }

        Tenant updated = tenantRepository.save(tenant);
        if ("ACTIVE".equalsIgnoreCase(updated.getStatus()) || "CHECKED_IN".equalsIgnoreCase(updated.getStatus()) || "COMPLETED".equalsIgnoreCase(updated.getStatus())) {
            final String tenantFullName = (updated.getFirstName() + " " + updated.getLastName()).trim();
            final UUID targetOrgId = organization != null ? organization.getId() : null;
            List<CheckIn> tenantCheckIns = checkInRepository.findAll().stream()
                .filter(c -> c.getOrganization() != null && targetOrgId != null && c.getOrganization().getId().equals(targetOrgId))
                .filter(c -> (c.getTenantName() != null && c.getTenantName().equalsIgnoreCase(tenantFullName)) ||
                             (updated.getRoomNumber() != null && !updated.getRoomNumber().isBlank() && updated.getRoomNumber().equalsIgnoreCase(c.getRoomNumber()) &&
                              updated.getBedNumber() != null && !updated.getBedNumber().isBlank() && updated.getBedNumber().equalsIgnoreCase(c.getBedNumber())))
                .collect(Collectors.toList());
            for (CheckIn ci : tenantCheckIns) {
                if ("pending".equalsIgnoreCase(ci.getStatus())) {
                    ci.setStatus("completed");
                    checkInRepository.save(ci);
                }
            }
        }
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteTenant(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        tenantRepository.delete(tenant);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Tenant successfully deleted."));
    }
}
