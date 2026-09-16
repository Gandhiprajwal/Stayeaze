package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.OmniSearchResultDTO;
import com.stayeaze.backend.payload.response.OmniSearchResultDTO.SearchItem;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.SecurityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SecurityUtils securityUtils;

    @GetMapping("/omni")
    public ResponseEntity<OmniSearchResultDTO> omniSearch(@RequestParam(required = false, defaultValue = "") String q) {
        OmniSearchResultDTO result = new OmniSearchResultDTO();
        if (q == null || q.trim().isEmpty()) {
            return ResponseEntity.ok(result);
        }
        String query = q.trim().toLowerCase();
        boolean isSuperAdmin = securityUtils.isSuperAdmin();
        Organization org = securityUtils.getCurrentOrganization();
        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();

        // 1. Properties
        try {
            List<Property> props = propertyRepository.findAllSuperAdmin();

            props.stream()
                    .filter(p -> assignedProps == null || assignedProps.contains(p.getId()))
                    .filter(p -> (p.getName() != null && p.getName().toLowerCase().contains(query))
                            || (p.getAddress() != null && p.getAddress().toLowerCase().contains(query))
                            || (p.getCity() != null && p.getCity().toLowerCase().contains(query)))
                    .limit(5)
                    .forEach(p -> result.getProperties().add(new SearchItem(
                            p.getId(),
                            p.getName(),
                            (p.getAddress() != null ? p.getAddress() : "") + (p.getCity() != null ? ", " + p.getCity() : ""),
                            "Property",
                            "/properties/" + p.getId()
                    )));
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Tenants
        try {
            List<Tenant> tenants = tenantRepository.findAllSuperAdmin();
            tenants.stream()
                    .filter(t -> assignedProps == null || t.getPropertyId() == null || assignedProps.contains(t.getPropertyId()))
                    .filter(t -> (t.getFirstName() != null && t.getFirstName().toLowerCase().contains(query))
                            || (t.getLastName() != null && t.getLastName().toLowerCase().contains(query))
                            || (t.getName() != null && t.getName().toLowerCase().contains(query))
                            || (t.getEmail() != null && t.getEmail().toLowerCase().contains(query))
                            || (t.getMobile() != null && t.getMobile().contains(query))
                            || (t.getRoomNumber() != null && t.getRoomNumber().toLowerCase().contains(query)))
                    .limit(5)
                    .forEach(t -> {
                        String fullName = t.getName() != null ? t.getName() : ((t.getFirstName() != null ? t.getFirstName() : "") + (t.getLastName() != null ? " " + t.getLastName() : ""));
                        result.getTenants().add(new SearchItem(
                                t.getId(),
                                fullName,
                                "Room " + (t.getRoomNumber() != null ? t.getRoomNumber() : "—") + (t.getBedNumber() != null ? " (" + t.getBedNumber() + ")" : "") + " • " + (t.getMobile() != null ? t.getMobile() : ""),
                                "Tenant",
                                "/tenants/" + t.getId()
                        ));
                    });
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 3. Rooms
        try {
            List<Room> rooms = org != null ? roomRepository.findByOrganizationId(org.getId()) : roomRepository.findAll();
            rooms.stream()
                    .filter(r -> {
                        UUID propId = null;
                        try {
                            if (r.getFloor() != null && r.getFloor().getBuilding() != null && r.getFloor().getBuilding().getProperty() != null) {
                                propId = r.getFloor().getBuilding().getProperty().getId();
                            }
                        } catch (Exception ignored) {}
                        return assignedProps == null || propId == null || assignedProps.contains(propId);
                    })
                    .filter(r -> (r.getRoomNumber() != null && r.getRoomNumber().toLowerCase().contains(query))
                            || (r.getSharingType() != null && r.getSharingType().toLowerCase().contains(query)))
                    .limit(5)
                    .forEach(r -> {
                        String bld = (r.getFloor() != null && r.getFloor().getBuilding() != null) ? r.getFloor().getBuilding().getName() : "Building";
                        result.getRooms().add(new SearchItem(
                                r.getId(),
                                "Room " + r.getRoomNumber(),
                                bld + " • " + (r.getSharingType() != null ? r.getSharingType() : "Room") + " • " + (r.getOccupied()) + "/" + (r.getBeds()) + " occupied",
                                "Room",
                                "/rooms"
                        ));
                    });
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 4. Invoices
        try {
            List<Invoice> invoices = org != null ? invoiceRepository.findByOrganizationId(org.getId()) : invoiceRepository.findAll();
            invoices.stream()
                    .filter(i -> {
                        if (i.getTenant() == null) return false;
                        if (assignedProps != null && i.getTenant().getPropertyId() != null && !assignedProps.contains(i.getTenant().getPropertyId())) {
                            return false;
                        }
                        return true;
                    })
                    .filter(i -> (i.getInvoiceNumber() != null && i.getInvoiceNumber().toLowerCase().contains(query))
                            || (i.getTenant() != null && i.getTenant().getName() != null && i.getTenant().getName().toLowerCase().contains(query)))
                    .limit(5)
                    .forEach(i -> result.getInvoices().add(new SearchItem(
                                i.getId(),
                                i.getInvoiceNumber(),
                                (i.getTenant() != null ? i.getTenant().getName() : "Tenant") + " • ₹" + (i.getAmountDue() != null ? i.getAmountDue() : 0) + " • " + (i.getStatus() != null ? i.getStatus() : ""),
                                "Invoice",
                                "/billing"
                        )));
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 5. Users (Only if SuperAdmin or Admin)
        if (isSuperAdmin || org != null) {
            try {
                List<User> users = (isSuperAdmin || org == null) ? userRepository.findAll() : userRepository.findByOrganizationId(org.getId());
                users.stream()
                        .filter(u -> (u.getFirstName() != null && u.getFirstName().toLowerCase().contains(query))
                                || (u.getEmail() != null && u.getEmail().toLowerCase().contains(query)))
                        .limit(5)
                        .forEach(u -> result.getUsers().add(new SearchItem(
                                u.getId(),
                                (u.getFirstName() != null ? u.getFirstName() : u.getEmail()),
                                u.getEmail(),
                                "User",
                                "/users"
                        )));
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        return ResponseEntity.ok(result);
    }
}
