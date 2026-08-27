package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/check-outs")
public class CheckOutController {

    @Autowired
    private CheckOutRepository checkOutRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElse(null);
    }

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    private void processCheckOutCompletion(CheckOut checkOut, Organization organization) {
        checkOut.setRefundStatus("PENDING_APPROVAL");
        checkOut.setNetRefundAmount(checkOut.getNetRefundAmount());

        // 1. Find matching Tenant and archive (do NOT delete!)
        List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
        Tenant tenant = orgTenants.stream().filter(t ->
            (t.getFirstName() + " " + t.getLastName()).equalsIgnoreCase(checkOut.getTenantName()) ||
            (checkOut.getRoomNumber() != null && checkOut.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
             checkOut.getBedNumber() != null && checkOut.getBedNumber().equalsIgnoreCase(t.getBedNumber()))
        ).findFirst().orElse(null);

        if (tenant != null) {
            tenant.setStatus("ARCHIVED");
            if (checkOut.getCheckOutDate() != null) {
                tenant.setLeaseEnd(checkOut.getCheckOutDate().toString());
            }
            tenant.setRoomNumber(null);
            tenant.setBedNumber(null);
            tenantRepository.save(tenant);

            // Sync associated booking status if present
            try {
                List<Booking> tenantBookings = bookingRepository.findByTenant(tenant);
                for (Booking b : tenantBookings) {
                    if ("CONFIRMED".equalsIgnoreCase(b.getStatus()) || "CHECKED_IN".equalsIgnoreCase(b.getStatus()) || "PENDING".equalsIgnoreCase(b.getStatus())) {
                        b.setStatus("CHECKED_OUT");
                        b.setCheckoutDate(checkOut.getCheckOutDate() != null ? checkOut.getCheckOutDate() : java.time.LocalDate.now());
                        bookingRepository.save(b);
                    }
                }
            } catch (Exception ignored) {}
        }

        // 2. Release Bed back to AVAILABLE
        Room matchedRoom = null;
        if (checkOut.getRoomNumber() != null && checkOut.getBedNumber() != null) {
            try {
                List<Bed> orgBeds = bedRepository.findByOrganizationId(organization.getId());
                Bed bed = orgBeds.stream().filter(b ->
                    checkOut.getBedNumber().equalsIgnoreCase(b.getBedNumber()) &&
                    b.getRoom() != null &&
                    checkOut.getRoomNumber().equalsIgnoreCase(b.getRoom().getRoomNumber())
                ).findFirst().orElse(null);

                if (bed != null) {
                    bed.setStatus("AVAILABLE");
                    bed.setTenantId(null);
                    bed.setTenantName(null);
                    bedRepository.save(bed);
                    matchedRoom = bed.getRoom();
                }
            } catch (Exception ignored) {}
        }

        if (matchedRoom != null) {
            occupancySyncService.syncStatsForRoom(matchedRoom);
        }
        occupancySyncService.syncAllStatsForOrg(organization);
    }

    @GetMapping
    public ResponseEntity<?> getAllCheckOuts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        if (organization == null) {
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(new java.util.ArrayList<>(), page, pageSize));
        }

        org.springframework.data.domain.Sort.Direction direction = "asc".equalsIgnoreCase(sortOrder)
                ? org.springframework.data.domain.Sort.Direction.ASC
                : org.springframework.data.domain.Sort.Direction.DESC;
        String sortProperty = (sortBy != null && !sortBy.isBlank() && !sortBy.equalsIgnoreCase("netRefund") && !sortBy.equalsIgnoreCase("actions")) ? sortBy : "createdAt";

        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize),
                        org.springframework.data.domain.Sort.by(direction, sortProperty));

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null || propertyId != null) {
            List<CheckOut> allCheckOuts = checkOutRepository.findAll().stream()
                    .filter(c -> c.getOrganization() != null && c.getOrganization().getId().equals(organization.getId()))
                    .filter(c -> c.getPropertyId() != null)
                    .filter(c -> assignedProps == null || assignedProps.contains(c.getPropertyId()))
                    .filter(c -> propertyId == null || propertyId.equals(c.getPropertyId()))
                    .collect(java.util.stream.Collectors.toList());

            if (search != null && !search.trim().isEmpty()) {
                String q = search.trim().toLowerCase();
                allCheckOuts = allCheckOuts.stream().filter(c ->
                        (c.getTenantName() != null && c.getTenantName().toLowerCase().contains(q)) ||
                        (c.getCode() != null && c.getCode().toLowerCase().contains(q)) ||
                        (c.getRoomNumber() != null && c.getRoomNumber().toLowerCase().contains(q))
                ).collect(java.util.stream.Collectors.toList());
            }

            List<com.stayeaze.backend.payload.response.CheckOutDTO> dtos = allCheckOuts.stream()
                    .map(com.stayeaze.backend.payload.response.CheckOutDTO::fromEntity)
                    .collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(dtos, page, pageSize));
        }

        org.springframework.data.domain.Page<CheckOut> pageResult;
        if (search != null && !search.trim().isEmpty()) {
            pageResult = checkOutRepository.searchByOrganizationId(organization.getId(), search.trim(), pageable);
        } else {
            pageResult = checkOutRepository.findByOrganizationId(organization.getId(), pageable);
        }

        org.springframework.data.domain.Page<com.stayeaze.backend.payload.response.CheckOutDTO> dtoPage =
                pageResult.map(com.stayeaze.backend.payload.response.CheckOutDTO::fromEntity);
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.ofPage(dtoPage));
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createCheckOut(@Valid @RequestBody CheckOut request) {
        Organization organization = getLoggedUserOrg();
        request.setOrganization(organization);

        if (request.getPropertyId() == null) {
            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            if (orgRooms != null && !orgRooms.isEmpty() && orgRooms.get(0).getFloor() != null && orgRooms.get(0).getFloor().getBuilding() != null) {
                request.setPropertyId(orgRooms.get(0).getFloor().getBuilding().getId());
            } else {
                request.setPropertyId(organization.getId());
            }
        }

        if (request.getCode() == null || request.getCode().isEmpty()) {
            request.setCode("CO-" + String.valueOf(System.currentTimeMillis()).substring(8));
        }

        // Auto-map security deposit and refund payout destination from tenant record
        List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
        Tenant tenant = orgTenants.stream().filter(t ->
            (t.getFirstName() + " " + t.getLastName()).equalsIgnoreCase(request.getTenantName()) ||
            (t.getName() != null && t.getName().equalsIgnoreCase(request.getTenantName())) ||
            (request.getRoomNumber() != null && request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
             request.getBedNumber() != null && request.getBedNumber().equalsIgnoreCase(t.getBedNumber()))
        ).findFirst().orElse(null);

        if (tenant != null) {
            if ((request.getDepositRefund() == null || request.getDepositRefund().compareTo(BigDecimal.ZERO) == 0) &&
                tenant.getDeposit() != null && tenant.getDeposit().compareTo(BigDecimal.ZERO) > 0) {
                request.setDepositRefund(tenant.getDeposit());
            }
            if (request.getBeneficiaryUpi() == null || request.getBeneficiaryUpi().isBlank()) {
                request.setBeneficiaryUpi(tenant.getRefundUpi());
            }
            if (request.getBeneficiaryAccount() == null || request.getBeneficiaryAccount().isBlank()) {
                request.setBeneficiaryAccount(tenant.getRefundAccountNumber());
            }
            if (request.getBeneficiaryIfsc() == null || request.getBeneficiaryIfsc().isBlank()) {
                request.setBeneficiaryIfsc(tenant.getRefundIfsc());
            }
            if (request.getBeneficiaryBank() == null || request.getBeneficiaryBank().isBlank()) {
                request.setBeneficiaryBank(tenant.getRefundBankName());
            }
        }

        // Compute net refund amount after deductions
        BigDecimal dep = request.getDepositRefund() != null ? request.getDepositRefund() : BigDecimal.ZERO;
        BigDecimal ded = request.getDeductions() != null ? request.getDeductions() : BigDecimal.ZERO;
        request.setNetRefundAmount(dep.subtract(ded).max(BigDecimal.ZERO));

        if ("completed".equalsIgnoreCase(request.getStatus())) {
            processCheckOutCompletion(request, organization);
        }

        CheckOut saved = checkOutRepository.save(request);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> updateCheckOut(@PathVariable UUID id, @Valid @RequestBody CheckOut request) {
        return ResponseEntity.badRequest().body(new MessageResponse("Check-out records are immutable and cannot be edited."));
    }

    @PostMapping("/{id}/mark-completed")
    @Transactional
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> markCheckOutCompleted(@PathVariable UUID id, @RequestBody(required = false) CheckOut payload) {
        try {
            Organization organization = getLoggedUserOrg();
            CheckOut checkOut = checkOutRepository.findById(id).orElse(null);
            if (checkOut == null || !checkOut.getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-out record not found."));
            }

            if ("completed".equalsIgnoreCase(checkOut.getStatus())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Check-out is already completed."));
            }

            if (payload != null) {
                if (payload.getCheckOutDate() != null) checkOut.setCheckOutDate(payload.getCheckOutDate());
                if (payload.getDepositRefund() != null) checkOut.setDepositRefund(payload.getDepositRefund());
                if (payload.getDeductions() != null) checkOut.setDeductions(payload.getDeductions());
                if (payload.getReason() != null) checkOut.setReason(payload.getReason());
            }

            // Always calculate net refund amount after deductions
            BigDecimal depComplete = checkOut.getDepositRefund() != null ? checkOut.getDepositRefund() : BigDecimal.ZERO;
            BigDecimal dedComplete = checkOut.getDeductions() != null ? checkOut.getDeductions() : BigDecimal.ZERO;
            checkOut.setNetRefundAmount(depComplete.subtract(dedComplete).max(BigDecimal.ZERO));

            checkOut.setStatus("completed");
            processCheckOutCompletion(checkOut, organization);
            CheckOut updated = checkOutRepository.save(checkOut);
            return ResponseEntity.ok(updated);
        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new MessageResponse("Check-out completion error: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> deleteCheckOut(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        CheckOut checkOut = checkOutRepository.findById(id).orElse(null);
        if (checkOut == null || !checkOut.getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-out record not found."));
        }

        checkOutRepository.delete(checkOut);
        return ResponseEntity.ok(new MessageResponse("Check-out record successfully deleted."));
    }

    @PostMapping("/{id}/approve-refund")
    @Transactional
    @PreAuthorize("hasRole('ACCOUNTANT') or hasRole('ADMIN') or hasRole('OWNER')")
    public ResponseEntity<?> approveSecurityDepositRefund(
            @PathVariable UUID id,
            @RequestBody(required = false) java.util.Map<String, Object> req
    ) {
        try {
            Organization organization = getLoggedUserOrg();
            CheckOut checkOut = checkOutRepository.findById(id).orElse(null);
            if (checkOut == null || !checkOut.getOrganization().getId().equals(organization.getId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Check-out record not found."));
            }

            // Notice Period protection: Only completed move-outs can be refunded
            if (!"completed".equalsIgnoreCase(checkOut.getStatus())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Security deposit refund can only be approved after successful move-out check-out (not allowed during notice period)."));
            }

            if ("REFUNDED".equalsIgnoreCase(checkOut.getRefundStatus())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: This security deposit refund has already been settled and approved."));
            }

            UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            User approver = userRepository.findById(userDetails.getId()).orElse(null);
            String approverName = approver != null && approver.getFirstName() != null ? approver.getFirstName() : userDetails.getUsername();

            String paymentMode = "BANK_TRANSFER";
            String transactionRef = null;
            String notes = null;

            if (req != null) {
                if (req.get("paymentMode") != null) paymentMode = req.get("paymentMode").toString();
                if (req.get("transactionRef") != null) transactionRef = req.get("transactionRef").toString();
                if (req.get("notes") != null) notes = req.get("notes").toString();
                if (req.get("beneficiaryUpi") != null) checkOut.setBeneficiaryUpi(req.get("beneficiaryUpi").toString());
                if (req.get("beneficiaryBank") != null) checkOut.setBeneficiaryBank(req.get("beneficiaryBank").toString());
                if (req.get("beneficiaryAccount") != null) checkOut.setBeneficiaryAccount(req.get("beneficiaryAccount").toString());
                if (req.get("beneficiaryIfsc") != null) checkOut.setBeneficiaryIfsc(req.get("beneficiaryIfsc").toString());
            }

            // Net refund calculation after deductions
            BigDecimal depRefund = checkOut.getDepositRefund() != null ? checkOut.getDepositRefund() : BigDecimal.ZERO;
            BigDecimal dedRefund = checkOut.getDeductions() != null ? checkOut.getDeductions() : BigDecimal.ZERO;
            BigDecimal netRefundFinal = depRefund.subtract(dedRefund).max(BigDecimal.ZERO);
            checkOut.setNetRefundAmount(netRefundFinal);

            checkOut.setRefundStatus("REFUNDED");
            checkOut.setRefundApprovedBy(approverName);
            checkOut.setRefundApprovedAt(java.time.OffsetDateTime.now());
            checkOut.setRefundPaymentMode(paymentMode);
            checkOut.setRefundTransactionRef(transactionRef);
            checkOut.setRefundNotes(notes);

            CheckOut saved = checkOutRepository.save(checkOut);

            // Send notification email to tenant if email exists
            try {
                List<Tenant> orgTenants = tenantRepository.findByOrganization(organization);
                Tenant tenant = orgTenants.stream().filter(t ->
                    (t.getFirstName() + " " + t.getLastName()).equalsIgnoreCase(checkOut.getTenantName()) ||
                    (t.getName() != null && t.getName().equalsIgnoreCase(checkOut.getTenantName()))
                ).findFirst().orElse(null);

                String tenantEmail = tenant != null ? tenant.getEmail() : null;
                if (tenantEmail != null && !tenantEmail.isBlank()) {
                    Property prop = null;
                    if (checkOut.getPropertyId() != null) {
                        prop = propertyRepository.findById(checkOut.getPropertyId()).orElse(null);
                    }
                    String propName = prop != null ? prop.getName() : "StayEaze Residency";
                    emailService.sendDepositRefundReceiptEmail(
                        tenantEmail,
                        checkOut.getTenantName(),
                        checkOut.getCode(),
                        propName,
                        checkOut.getDepositRefund(),
                        checkOut.getDeductions(),
                        checkOut.getNetRefundAmount(),
                        paymentMode,
                        transactionRef,
                        java.time.LocalDate.now().toString()
                    );
                }
            } catch (Exception ignored) {}

            return ResponseEntity.ok(com.stayeaze.backend.payload.response.CheckOutDTO.fromEntity(saved));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new MessageResponse("Refund approval failed: " + ex.getMessage()));
        }
    }

    @Autowired
    private com.stayeaze.backend.services.CheckoutSettlementService checkoutSettlementService;

    @PostMapping("/settlement-preview/{tenantId}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getSettlementPreview(@PathVariable UUID tenantId, @RequestBody(required = false) java.util.Map<String, Object> params) {
        try {
            if (params == null) params = java.util.Collections.emptyMap();
            com.stayeaze.backend.services.CheckoutSettlementService.SettlementPreview preview = checkoutSettlementService.calculatePreview(tenantId, params);
            return ResponseEntity.ok(preview);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }

    @PostMapping("/execute-settlement/{tenantId}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> executeSettlement(@PathVariable UUID tenantId, @RequestBody(required = false) java.util.Map<String, Object> params) {
        try {
            if (params == null) params = java.util.Collections.emptyMap();
            java.util.Map<String, Object> result = checkoutSettlementService.executeSettlement(tenantId, params);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        }
    }
}
