package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.SecurityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/front-desk")
public class FrontDeskShiftController {

    @Autowired
    private FrontDeskShiftHandoverRepository shiftHandoverRepository;

    @Autowired
    private KeyLoanRepository keyLoanRepository;

    @Autowired
    private LostAndFoundItemRepository lostAndFoundItemRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private CheckOutRepository checkOutRepository;

    @Autowired
    private ParcelRepository parcelRepository;

    @Autowired
    private VisitorRepository visitorRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst().orElse(null);
    }

    // ==========================================
    // 1. FRONT DESK LIVE OVERVIEW COUNTERS
    // ==========================================
    @GetMapping("/overview")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getFrontDeskOverview(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.ok(Collections.emptyMap());
        }

        LocalDate today = LocalDate.now();

        // 1. Arrivals (Check-ins scheduled or completed today)
        List<CheckIn> checkIns = checkInRepository.findByOrganization(org);
        long todayArrivals = checkIns.stream()
                .filter(c -> c.getCheckInDate() != null && c.getCheckInDate().equals(today))
                .count();

        // 2. Departures (Check-outs scheduled or completed today)
        List<CheckOut> checkOuts = checkOutRepository.findByOrganization(org);
        long todayDepartures = checkOuts.stream()
                .filter(c -> c.getCheckOutDate() != null && c.getCheckOutDate().equals(today))
                .count();

        // 3. Inward Parcels currently in custody
        List<Parcel> parcels = parcelRepository.findByOrganization(org);
        long pendingParcels = parcels.stream()
                .filter(p -> "IN_CUSTODY".equalsIgnoreCase(p.getStatus()) || "PENDING".equalsIgnoreCase(p.getStatus()))
                .count();

        // 4. Active Visitors currently on premises
        List<Visitor> visitors = visitorRepository.findByOrganizationId(org.getId());
        long activeVisitors = visitors.stream()
                .filter(v -> "ACTIVE".equalsIgnoreCase(v.getStatus()) || "INSIDE".equalsIgnoreCase(v.getStatus()))
                .count();

        // 5. Active Key Loans
        List<KeyLoan> keyLoans = shiftHandoverRepository != null ? keyLoanRepository.findByOrganizationOrderByCreatedAtDesc(org) : Collections.emptyList();
        long activeKeyLoans = keyLoans.stream()
                .filter(k -> "ACTIVE_LOAN".equalsIgnoreCase(k.getStatus()))
                .count();

        // 6. Unclaimed Lost & Found items
        List<LostAndFoundItem> lostItems = lostAndFoundItemRepository.findByOrganizationOrderByCreatedAtDesc(org);
        long unclaimedLostItems = lostItems.stream()
                .filter(l -> "UNCLAIMED".equalsIgnoreCase(l.getStatus()))
                .count();

        // 7. Pending Shift Cash Handovers awaiting Manager Verification
        List<FrontDeskShiftHandover> shifts = shiftHandoverRepository.findByOrganizationOrderByCreatedAtDesc(org);
        long pendingShiftVerifications = shifts.stream()
                .filter(s -> "PENDING_VERIFICATION".equalsIgnoreCase(s.getStatus()))
                .count();

        BigDecimal pendingCashAmount = shifts.stream()
                .filter(s -> "PENDING_VERIFICATION".equalsIgnoreCase(s.getStatus()))
                .map(FrontDeskShiftHandover::getCashCollected)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("todayArrivals", todayArrivals);
        metrics.put("todayDepartures", todayDepartures);
        metrics.put("pendingParcels", pendingParcels);
        metrics.put("activeVisitors", activeVisitors);
        metrics.put("activeKeyLoans", activeKeyLoans);
        metrics.put("unclaimedLostItems", unclaimedLostItems);
        metrics.put("pendingShiftVerifications", pendingShiftVerifications);
        metrics.put("pendingCashAmount", pendingCashAmount);

        return ResponseEntity.ok(metrics);
    }

    // ==========================================
    // 2. SHIFT CASH HANDOVER (RECEPTIONIST ➔ MANAGER ➔ OWNER)
    // ==========================================
    @PostMapping("/shift-handover")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER')")
    @Transactional
    public ResponseEntity<?> submitShiftHandover(@RequestBody Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        if (org == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Organization context missing"));
        }

        FrontDeskShiftHandover handover = new FrontDeskShiftHandover();
        handover.setOrganization(org);

        if (payload.get("propertyId") != null && !payload.get("propertyId").toString().isBlank()) {
            try {
                UUID propId = UUID.fromString(payload.get("propertyId").toString());
                propertyRepository.findById(propId).ifPresent(handover::setProperty);
            } catch (Exception ignored) {}
        }

        String staffName = payload.get("receptionistName") != null ? payload.get("receptionistName").toString() : "Front Desk Officer";
        handover.setReceptionistName(staffName);
        handover.setShiftType(payload.get("shiftType") != null ? payload.get("shiftType").toString() : "MORNING");
        handover.setShiftDate(LocalDate.now());

        try {
            if (payload.get("tokenAdvances") != null) handover.setTokenAdvances(new BigDecimal(payload.get("tokenAdvances").toString()));
            if (payload.get("keyDeposits") != null) handover.setKeyDeposits(new BigDecimal(payload.get("keyDeposits").toString()));
            if (payload.get("guestMealTokens") != null) handover.setGuestMealTokens(new BigDecimal(payload.get("guestMealTokens").toString()));
            if (payload.get("cashCollected") != null) {
                handover.setCashCollected(new BigDecimal(payload.get("cashCollected").toString()));
            } else {
                handover.setCashCollected(handover.getTokenAdvances().add(handover.getKeyDeposits()).add(handover.getGuestMealTokens()));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Invalid cash numbers provided"));
        }

        handover.setIncomingStaffName(payload.get("incomingStaffName") != null ? payload.get("incomingStaffName").toString() : "");
        handover.setNotes(payload.get("notes") != null ? payload.get("notes").toString() : "");
        handover.setStatus("PENDING_VERIFICATION");

        FrontDeskShiftHandover saved = shiftHandoverRepository.save(handover);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/shift-handovers")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getShiftHandovers(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) return ResponseEntity.ok(Collections.emptyList());

        List<FrontDeskShiftHandover> list;
        if (propertyId != null) {
            list = shiftHandoverRepository.findByOrganizationAndPropertyIdOrderByCreatedAtDesc(org, propertyId);
        } else {
            list = shiftHandoverRepository.findByOrganizationOrderByCreatedAtDesc(org);
        }
        return ResponseEntity.ok(list);
    }

    @PutMapping("/shift-handover/{id}/verify")
    @PreAuthorize("hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<?> verifyShiftHandover(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        FrontDeskShiftHandover handover = shiftHandoverRepository.findById(id).orElse(null);
        if (handover == null || (org != null && !handover.getOrganization().getId().equals(org.getId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Shift handover record not found"));
        }

        String verifierName = payload != null && payload.get("managerName") != null ? payload.get("managerName").toString() : "Property Manager";
        handover.setStatus("VERIFIED_DEPOSITED");
        handover.setVerifiedByManagerName(verifierName);
        handover.setVerifiedAt(OffsetDateTime.now());
        if (payload != null && payload.get("notes") != null) {
            handover.setNotes(handover.getNotes() + "\n[Manager Verification Note]: " + payload.get("notes").toString());
        }

        FrontDeskShiftHandover updated = shiftHandoverRepository.save(handover);
        return ResponseEntity.ok(updated);
    }

    // ==========================================
    // 3. MASTER KEY LOANS & TRACKING
    // ==========================================
    @PostMapping("/key-loans")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER')")
    @Transactional
    public ResponseEntity<?> issueKeyLoan(@RequestBody Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        if (org == null) return ResponseEntity.badRequest().body(new MessageResponse("Organization context missing"));

        KeyLoan loan = new KeyLoan();
        loan.setOrganization(org);

        if (payload.get("propertyId") != null && !payload.get("propertyId").toString().isBlank()) {
            try {
                UUID propId = UUID.fromString(payload.get("propertyId").toString());
                propertyRepository.findById(propId).ifPresent(loan::setProperty);
            } catch (Exception ignored) {}
        }

        loan.setRoomNumber(payload.get("roomNumber") != null ? payload.get("roomNumber").toString() : "N/A");
        loan.setBedNumber(payload.get("bedNumber") != null ? payload.get("bedNumber").toString() : "");
        loan.setTenantName(payload.get("tenantName") != null ? payload.get("tenantName").toString() : "Resident");
        loan.setTenantPhone(payload.get("tenantPhone") != null ? payload.get("tenantPhone").toString() : "");
        loan.setLoanReason(payload.get("loanReason") != null ? payload.get("loanReason").toString() : "LOCKED_OUT");
        loan.setIssuedByName(payload.get("issuedByName") != null ? payload.get("issuedByName").toString() : "Front Desk");
        loan.setLoanTime(OffsetDateTime.now());
        loan.setExpectedReturnTime(OffsetDateTime.now().plusMinutes(30)); // 30 min expected return window
        loan.setStatus("ACTIVE_LOAN");
        loan.setNotes(payload.get("notes") != null ? payload.get("notes").toString() : "");

        KeyLoan saved = keyLoanRepository.save(loan);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/key-loans")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getKeyLoans(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) return ResponseEntity.ok(Collections.emptyList());

        List<KeyLoan> list;
        if (propertyId != null) {
            list = keyLoanRepository.findByOrganizationAndPropertyIdOrderByCreatedAtDesc(org, propertyId);
        } else {
            list = keyLoanRepository.findByOrganizationOrderByCreatedAtDesc(org);
        }
        return ResponseEntity.ok(list);
    }

    @PutMapping("/key-loans/{id}/return")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER')")
    @Transactional
    public ResponseEntity<?> returnKeyLoan(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        KeyLoan loan = keyLoanRepository.findById(id).orElse(null);
        if (loan == null || (org != null && !loan.getOrganization().getId().equals(org.getId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Key loan record not found"));
        }

        boolean isLost = payload != null && Boolean.TRUE.equals(payload.get("isLost"));
        if (isLost) {
            loan.setStatus("LOST_REPLACED");
            loan.setReplacementFee(new BigDecimal("200.00"));
            if (payload.get("fee") != null) {
                try { loan.setReplacementFee(new BigDecimal(payload.get("fee").toString())); } catch (Exception ignored) {}
            }
        } else {
            loan.setStatus("RETURNED");
        }
        loan.setActualReturnTime(OffsetDateTime.now());
        if (payload != null && payload.get("notes") != null) {
            loan.setNotes((loan.getNotes() != null ? loan.getNotes() + "\n" : "") + payload.get("notes").toString());
        }

        KeyLoan updated = keyLoanRepository.save(loan);
        return ResponseEntity.ok(updated);
    }

    // ==========================================
    // 4. LOST & FOUND ITEMS
    // ==========================================
    @PostMapping("/lost-and-found")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER')")
    @Transactional
    public ResponseEntity<?> logLostAndFound(@RequestBody Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        if (org == null) return ResponseEntity.badRequest().body(new MessageResponse("Organization context missing"));

        LostAndFoundItem item = new LostAndFoundItem();
        item.setOrganization(org);

        if (payload.get("propertyId") != null && !payload.get("propertyId").toString().isBlank()) {
            try {
                UUID propId = UUID.fromString(payload.get("propertyId").toString());
                propertyRepository.findById(propId).ifPresent(item::setProperty);
            } catch (Exception ignored) {}
        }

        item.setItemName(payload.get("itemName") != null ? payload.get("itemName").toString() : "Found Item");
        item.setCategory(payload.get("category") != null ? payload.get("category").toString() : "ELECTRONICS");
        item.setFoundLocation(payload.get("foundLocation") != null ? payload.get("foundLocation").toString() : "Lobby Area");
        item.setFoundDate(LocalDate.now());
        item.setFoundByName(payload.get("foundByName") != null ? payload.get("foundByName").toString() : "Front Desk");
        item.setStorageRack(payload.get("storageRack") != null ? payload.get("storageRack").toString() : "Front Desk Cabinet");
        item.setPhotoUrl(payload.get("photoUrl") != null ? payload.get("photoUrl").toString() : null);
        item.setStatus("UNCLAIMED");
        item.setNotes(payload.get("notes") != null ? payload.get("notes").toString() : "");

        LostAndFoundItem saved = lostAndFoundItemRepository.save(item);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/lost-and-found")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER') or hasRole('SUPER_ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getLostAndFoundItems(@RequestParam(required = false) UUID propertyId) {
        Organization org = getLoggedUserOrg();
        if (org == null) return ResponseEntity.ok(Collections.emptyList());

        List<LostAndFoundItem> list;
        if (propertyId != null) {
            list = lostAndFoundItemRepository.findByOrganizationAndPropertyIdOrderByCreatedAtDesc(org, propertyId);
        } else {
            list = lostAndFoundItemRepository.findByOrganizationOrderByCreatedAtDesc(org);
        }
        return ResponseEntity.ok(list);
    }

    @PutMapping("/lost-and-found/{id}/claim")
    @PreAuthorize("hasRole('RECEPTIONIST') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('OWNER')")
    @Transactional
    public ResponseEntity<?> claimLostItem(@PathVariable UUID id, @RequestBody Map<String, Object> payload) {
        Organization org = getLoggedUserOrg();
        LostAndFoundItem item = lostAndFoundItemRepository.findById(id).orElse(null);
        if (item == null || (org != null && !item.getOrganization().getId().equals(org.getId()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Item not found"));
        }

        item.setStatus("CLAIMED");
        item.setClaimedByName(payload.get("claimedByName") != null ? payload.get("claimedByName").toString() : "Verified Resident");
        item.setClaimedByPhone(payload.get("claimedByPhone") != null ? payload.get("claimedByPhone").toString() : "");
        item.setClaimedAt(OffsetDateTime.now());
        if (payload.get("notes") != null) {
            item.setNotes((item.getNotes() != null ? item.getNotes() + "\n" : "") + payload.get("notes").toString());
        }

        LostAndFoundItem updated = lostAndFoundItemRepository.save(item);
        return ResponseEntity.ok(updated);
    }
}
