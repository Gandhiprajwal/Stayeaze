package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.TenantRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
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

        if (tenantRepository.existsByMobile(request.getMobile())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number already registered to an existing tenant!"));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank()) {

            // Check if bed is already occupied by active tenant
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t ->
                (t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus())) &&
                request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                request.getBedNumber().equalsIgnoreCase(t.getBedNumber())
            );
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
            checkIn.setStatus("pending");
            checkIn.setCode("CI-" + (System.currentTimeMillis() % 100000000L));
            checkInRepository.save(checkIn);
        } catch(Exception e) {
            System.err.println("Failed to auto-create CheckIn: " + e.getMessage());
            e.printStackTrace();
        }

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Tenant>> getAllTenants() {
        Organization organization = getLoggedUserOrg();
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        List<Tenant> tenants;
        if (isSuperAdmin) {
            tenants = tenantRepository.findByOrganization(organization);
        } else {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
                tenants = tenantRepository.findByOrganization(organization).stream()
                        .filter(t -> t.getPropertyId() != null && user.getPropertyIds().contains(t.getPropertyId()))
                        .collect(Collectors.toList());
            } else {
                tenants = tenantRepository.findByOrganization(organization);
            }
        }
        return ResponseEntity.ok(tenants);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTenantById(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        return ResponseEntity.ok(tenant);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateTenant(@PathVariable UUID id, @Valid @RequestBody TenantRequest request) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        if (!tenant.getMobile().equals(request.getMobile()) && tenantRepository.existsByOrganizationAndMobile(organization, request.getMobile())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number already registered to another tenant!"));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank()) {
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t ->
                !t.getId().equals(id) &&
                (t.getStatus() == null || "ACTIVE".equalsIgnoreCase(t.getStatus())) &&
                request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                request.getBedNumber().equalsIgnoreCase(t.getBedNumber())
            );
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
        return ResponseEntity.ok(new MessageResponse("Tenant successfully deleted."));
    }
}
