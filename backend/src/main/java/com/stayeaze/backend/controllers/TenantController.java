package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.TenantRequest;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.MinimalTenantDTO;
import com.stayeaze.backend.repository.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.stayeaze.backend.services.RoomTransferReconciliationService;

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
    private com.stayeaze.backend.services.AuditLogService auditLogService;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private TenantDocumentRepository tenantDocumentRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.services.SmsService smsService;

    @Autowired
    private com.stayeaze.backend.services.SubscriptionEnforcementService enforcementService;


    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.services.CredentialService credentialService;

    @Autowired
    private com.stayeaze.backend.services.AccountUniquenessService accountUniquenessService;

    @Autowired
    private com.stayeaze.backend.services.RoomTransferReconciliationService roomTransferReconciliationService;

    @Autowired
    private com.stayeaze.backend.services.TenantNoticePeriodService tenantNoticePeriodService;

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    @PostMapping("/onboarding-order")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN')")
    public ResponseEntity<?> createOnboardingOrder(@RequestBody java.util.Map<String, Object> req) {
        Organization organization = getLoggedUserOrg();
        UUID propertyId = null;
        if (req.get("propertyId") != null && !req.get("propertyId").toString().isBlank()) {
            try { propertyId = UUID.fromString(req.get("propertyId").toString()); } catch (Exception ignored) {}
        }

        String tEmail = req.get("tenantEmail") != null ? req.get("tenantEmail").toString() : null;
        String tPhone = req.get("tenantPhone") != null ? req.get("tenantPhone").toString() : null;
        if (tEmail != null || tPhone != null) {
            try {
                accountUniquenessService.validateTenantEmailAndMobile(organization, tEmail, tPhone, null, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
            }
        }
        
        java.math.BigDecimal rent = java.math.BigDecimal.ZERO;
        java.math.BigDecimal deposit = java.math.BigDecimal.ZERO;
        if (req.get("rent") != null) {
            try { rent = new java.math.BigDecimal(req.get("rent").toString()); } catch (Exception ignored) {}
        }
        if (req.get("deposit") != null) {
            try { deposit = new java.math.BigDecimal(req.get("deposit").toString()); } catch (Exception ignored) {}
        }
        java.math.BigDecimal totalAmount = rent.add(deposit);

        if (totalAmount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Total initial onboarding amount (Rent + Deposit) must be greater than zero."));
        }

        Property property = null;
        if (propertyId != null) {
            property = propertyRepository.findById(propertyId).orElse(null);
        }
        
        String activeKeyId = null;
        String activeKeySecret = null;

        if (property != null && property.getRazorpayKeyId() != null && !property.getRazorpayKeyId().isBlank()) {
            activeKeyId = property.getRazorpayKeyId().trim();
            if (property.getRazorpayKeySecret() != null && !property.getRazorpayKeySecret().isBlank()) {
                activeKeySecret = property.getRazorpayKeySecret().trim();
            }
        }

        if (activeKeyId == null || activeKeyId.isBlank()) {
            java.util.Optional<OrganizationBillingProfile> bpOpt = organizationBillingProfileRepository.findByOrganization(organization);
            if (bpOpt.isPresent() && bpOpt.get().getRazorpayKeyId() != null && !bpOpt.get().getRazorpayKeyId().isBlank()) {
                activeKeyId = bpOpt.get().getRazorpayKeyId().trim();
                if (bpOpt.get().getRazorpayKeySecret() != null && !bpOpt.get().getRazorpayKeySecret().isBlank()) {
                    activeKeySecret = bpOpt.get().getRazorpayKeySecret().trim();
                }
            }
        }

        if (activeKeyId == null || activeKeyId.isBlank() || activeKeySecret == null || activeKeySecret.isBlank()) {
            String propName = property != null ? property.getName() : "this property";
            return ResponseEntity.badRequest().body(new MessageResponse("Online Razorpay payment is disabled for " + propName + ". Razorpay API credentials have not been configured for this property or organization."));
        }

        long amountInPaise = totalAmount.multiply(new java.math.BigDecimal(100)).longValue();
        String orderId = "order_onb_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);

        if (activeKeyId.startsWith("rzp_") && !activeKeyId.contains("MockKey")
                && activeKeySecret != null && !activeKeySecret.contains("mockSecret")) {
            try {
                com.razorpay.RazorpayClient razorpayClient = new com.razorpay.RazorpayClient(activeKeyId, activeKeySecret);
                org.json.JSONObject orderReq = new org.json.JSONObject();
                orderReq.put("amount", amountInPaise);
                orderReq.put("currency", "INR");
                orderReq.put("receipt", "ONB-" + (System.currentTimeMillis() % 1000000L));
                com.razorpay.Order order = razorpayClient.orders.create(orderReq);
                if (order.has("id")) {
                    orderId = order.get("id");
                }
            } catch (Exception e) {
                System.err.println("Razorpay client error during onboarding order creation: " + e.getMessage());
            }
        }

        java.util.Map<String, Object> orderPayload = new java.util.HashMap<>();
        orderPayload.put("orderId", orderId);
        orderPayload.put("keyId", activeKeyId);
        orderPayload.put("amount", amountInPaise);
        orderPayload.put("amountFormatted", totalAmount);
        orderPayload.put("currency", "INR");
        orderPayload.put("tenantName", req.get("tenantName") != null ? req.get("tenantName").toString() : "New Tenant");
        orderPayload.put("tenantEmail", req.get("tenantEmail") != null ? req.get("tenantEmail").toString() : "tenant@stayeaze.com");
        orderPayload.put("tenantPhone", req.get("tenantPhone") != null ? req.get("tenantPhone").toString() : "9876543210");

        return ResponseEntity.ok(orderPayload);
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createTenant(@Valid @RequestBody TenantRequest request) {
        Organization organization = getLoggedUserOrg();
        try {
            enforcementService.validateOperationalAccess(organization);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(new MessageResponse(e.getMessage()));
        }

        if (request.getPropertyId() != null) {
            Property prop = propertyRepository.findById(request.getPropertyId()).orElse(null);
            if (prop != null && "INACTIVE".equalsIgnoreCase(prop.getStatus())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Operational Action Rejected: The selected property is INACTIVE and locked from operations."));
            }
        }

        // 1. Universal Uniqueness Validation across Staff and Active Residents
        try {
            accountUniquenessService.validateTenantEmailAndMobile(
                organization,
                request.getEmail(),
                request.getMobile(),
                request.getEmergencyContactMobile(),
                null
            );
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank()) {

            // Bed occupied = any non-checked-out tenant in the same property, room and bed
            final UUID targetPropId = request.getPropertyId();
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
                boolean sameProp = (targetPropId == null || t.getPropertyId() == null || targetPropId.equals(t.getPropertyId()));
                return !isCheckedOut && sameProp &&
                    request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                    request.getBedNumber().equalsIgnoreCase(t.getBedNumber());
            });
            if (bedOccupied) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " in Room " + request.getRoomNumber() + " is already occupied!"));
            }

            // Check if room or building/floor/bed is archived/unavailable (scoped by property)
            List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
            Room room = orgRooms.stream().filter(r -> {
                boolean matchNum = request.getRoomNumber().equalsIgnoreCase(r.getRoomNumber());
                if (!matchNum) return false;
                if (targetPropId == null) return true;
                return r.getFloor() != null && r.getFloor().getBuilding() != null &&
                       r.getFloor().getBuilding().getProperty() != null &&
                       targetPropId.equals(r.getFloor().getBuilding().getProperty().getId());
            }).findFirst().orElse(null);
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
                    if ("ARCHIVED".equalsIgnoreCase(bStatus) || "MAINTENANCE".equalsIgnoreCase(bStatus) || "BLOCKED".equalsIgnoreCase(bStatus) || "OCCUPIED".equalsIgnoreCase(bStatus)) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " in Room " + room.getRoomNumber() + " is " + bStatus.toLowerCase() + " and cannot be assigned!"));
                    }
                }

                // Race-Condition Prevention: Check if another active resident is assigned to this exact bed in this property
                boolean alreadyOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                    String ts = t.getStatus();
                    boolean isOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
                    boolean sameProp = (targetPropId == null || t.getPropertyId() == null || targetPropId.equals(t.getPropertyId()));
                    return !isOut && sameProp &&
                        room.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                        request.getBedNumber().equalsIgnoreCase(t.getBedNumber());
                });
                if (alreadyOccupied) {
                    return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " in Room " + room.getRoomNumber() + " is currently occupied by an active resident!"));
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
        tenant.setLockInMonths(request.getLockInMonths());
        tenant.setNoticePeriodDays(request.getNoticePeriodDays());
        tenant.setStatus(request.getStatus() != null ? request.getStatus().toUpperCase() : "ACTIVE");

        if (request.getBillingResponsibility() != null) tenant.setBillingResponsibility(request.getBillingResponsibility());
        if (request.getCorporateCompanyName() != null) tenant.setCorporateCompanyName(request.getCorporateCompanyName());
        if (request.getCorporateGstin() != null) tenant.setCorporateGstin(request.getCorporateGstin());
        if (request.getUtilityResponsibility() != null) tenant.setUtilityResponsibility(request.getUtilityResponsibility());
        if (request.getDepositResponsibility() != null) tenant.setDepositResponsibility(request.getDepositResponsibility());

        Tenant saved = tenantRepository.save(tenant);

        // 2. Safe Tenant User Account Linking (Only link if already a dedicated ROLE_TENANT, never hijack staff)
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String tEmail = accountUniquenessService.normalizeEmail(request.getEmail());
            userRepository.findByEmail(tEmail).ifPresent(user -> {
                boolean isTenantRole = user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "ROLE_TENANT".equalsIgnoreCase(r.getName()));
                if (isTenantRole) {
                    user.setOrganization(organization);
                    user.setTenantId(saved.getId());
                    user.setStatus("ACTIVE");
                    user.setLockedUntil(null);
                    user.setFailedAttempts(0);
                    if (saved.getFirstName() != null && !saved.getFirstName().isBlank()) {
                        user.setFirstName(saved.getFirstName());
                    }
                    if (saved.getPropertyId() != null) {
                        List<UUID> pIds = new ArrayList<>();
                        pIds.add(saved.getPropertyId());
                        user.setPropertyIds(pIds);
                    }
                    userRepository.save(user);
                }
            });
        }

        // Auto-create initial Invoice & Payment for Onboarding (Rent + Security Deposit)
        try {
            java.math.BigDecimal fullRent = saved.getRent() != null ? saved.getRent() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal dAmt = saved.getDeposit() != null ? saved.getDeposit() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal rAmt = fullRent;

            // Pro-Rata First Month Rent Calculation (P0.1)
            java.time.LocalDate checkInDate = java.time.LocalDate.now();
            if (saved.getLeaseStart() != null && !saved.getLeaseStart().isBlank()) {
                try {
                    checkInDate = java.time.LocalDate.parse(saved.getLeaseStart());
                } catch (Exception ignored) {}
            }

            String billingMode = request.getBillingMode(); // "PRO_RATA" vs "FULL_MONTH"
            if (("PRO_RATA".equalsIgnoreCase(billingMode) || billingMode == null) && checkInDate.getDayOfMonth() > 1 && fullRent.compareTo(java.math.BigDecimal.ZERO) > 0) {
                int daysInMonth = checkInDate.lengthOfMonth();
                int remainingDays = daysInMonth - checkInDate.getDayOfMonth() + 1;
                java.math.BigDecimal dailyRate = fullRent.divide(java.math.BigDecimal.valueOf(daysInMonth), 2, java.math.RoundingMode.HALF_UP);
                rAmt = dailyRate.multiply(java.math.BigDecimal.valueOf(remainingDays)).setScale(2, java.math.RoundingMode.HALF_UP);
            }

            rAmt = (saved.getBillingResponsibility() != null && saved.getBillingResponsibility().equalsIgnoreCase("CORPORATE_SPONSORED"))
                    ? java.math.BigDecimal.ZERO
                    : (request.getRent() != null ? request.getRent() : (saved.getRent() != null ? saved.getRent() : java.math.BigDecimal.ZERO));
            dAmt = request.getDeposit() != null ? request.getDeposit() : (saved.getDeposit() != null ? saved.getDeposit() : java.math.BigDecimal.ZERO);
            java.math.BigDecimal totalDue = rAmt.add(dAmt);

            if (totalDue.compareTo(java.math.BigDecimal.ZERO) > 0) {
                Invoice inv = new Invoice();
                inv.setTenant(saved);
                inv.setInvoiceNumber(invoiceSequenceService.nextRentalInvoiceNumber(saved));
                inv.setAmountDue(totalDue);
                inv.setIssueDate(java.time.LocalDate.now());
                inv.setDueDate(java.time.LocalDate.now().plusDays(7));

                // Line items for Rent and Deposit
                if (rAmt.compareTo(java.math.BigDecimal.ZERO) > 0) {
                    String rentDesc = (rAmt.compareTo(fullRent) < 0)
                            ? "Pro-Rata Move-In Rent (from " + checkInDate + " to end of month)"
                            : "First Month Rent";
                    inv.getItems().add(new InvoiceItem(inv, rentDesc, rAmt));
                }
                if (dAmt.compareTo(java.math.BigDecimal.ZERO) > 0) {
                    inv.getItems().add(new InvoiceItem(inv, "Refundable Security Deposit", dAmt));
                }

                String pMethod = request.getPaymentMethod();
                boolean isPaid = "RAZORPAY".equalsIgnoreCase(pMethod) || "CASH".equalsIgnoreCase(pMethod) || "BANK_TRANSFER".equalsIgnoreCase(pMethod) || "UPI".equalsIgnoreCase(pMethod);
                
                if (isPaid) {
                    inv.setStatus("PAID");
                    inv.setAmountPaid(totalDue);
                } else {
                    inv.setStatus("UNPAID");
                    inv.setAmountPaid(java.math.BigDecimal.ZERO);
                }

                if (request.getRazorpayOrderId() != null) inv.setRazorpayOrderId(request.getRazorpayOrderId());
                if (request.getRazorpayPaymentId() != null) inv.setRazorpayPaymentId(request.getRazorpayPaymentId());
                if (request.getRazorpaySignature() != null) inv.setRazorpaySignature(request.getRazorpaySignature());

                Invoice savedInv = invoiceRepository.save(inv);

                if (isPaid) {
                    Payment p = new Payment();
                    p.setInvoice(savedInv);
                    p.setAmount(totalDue);
                    p.setPaymentDate(java.time.OffsetDateTime.now());
                    p.setPaymentMethod(pMethod != null ? pMethod.toUpperCase() : "RAZORPAY");
                    p.setTransactionReference(request.getRazorpayPaymentId() != null ? request.getRazorpayPaymentId() : "TXN-" + System.currentTimeMillis());
                    p.setStatus("COMPLETED");
                    paymentRepository.save(p);
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to auto-create Onboarding Invoice/Payment: " + e.getMessage());
            e.printStackTrace();
        }

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
            Property tProp = null;
            if (saved.getPropertyId() != null) {
                tProp = propertyRepository.findById(saved.getPropertyId()).orElse(null);
            }
            checkIn.setCode(invoiceSequenceService.nextCheckInCode(tProp, organization));
            checkInRepository.save(checkIn);
        } catch(Exception e) {
            System.err.println("Failed to auto-create CheckIn: " + e.getMessage());
            e.printStackTrace();
        }

        // Auto-provision User Account & Credentials Dispatch for Tenant
        try {
            if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
                String tEmail = accountUniquenessService.normalizeEmail(saved.getEmail());
                User user = userRepository.findByEmail(tEmail).orElse(null);
                String tempPassword = credentialService.generateSecurePassword();
                if (user == null) {
                    user = new User(organization, tEmail, passwordEncoder.encode(tempPassword), saved.getMobile() != null ? saved.getMobile() : "9876543210");
                    user.setFirstName(saved.getFirstName());
                    user.setMustChangePassword(true);
                    user.setTenantId(saved.getId());

                    Role tenantRole = roleRepository.findByName("ROLE_TENANT")
                            .orElseGet(() -> roleRepository.save(new Role("ROLE_TENANT", "[]")));
                    java.util.Set<Role> roles = new java.util.HashSet<>();
                    roles.add(tenantRole);
                    user.setRoles(roles);

                    if (saved.getPropertyId() != null) {
                        List<UUID> pIds = new ArrayList<>();
                        pIds.add(saved.getPropertyId());
                        user.setPropertyIds(pIds);
                    }

                    userRepository.save(user);
                } else if (user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "ROLE_TENANT".equalsIgnoreCase(r.getName()))) {
                    user.setTenantId(saved.getId());
                    if (user.getOrganization() == null) {
                        user.setOrganization(organization);
                    }
                    userRepository.save(user);
                }

                String pName = "StayEaze PG/Hostel";
                if (saved.getPropertyId() != null) {
                    Property p = propertyRepository.findById(saved.getPropertyId()).orElse(null);
                    if (p != null) pName = p.getName();
                }

                emailService.sendTenantWelcomeOnboardingEmail(
                        tEmail,
                        saved.getFirstName() + " " + (saved.getLastName() != null ? saved.getLastName() : ""),
                        tempPassword,
                        pName,
                        saved.getRoomNumber(),
                        saved.getBedNumber(),
                        "http://localhost:5173/login"
                );

                if (saved.getMobile() != null && !saved.getMobile().isBlank()) {
                    smsService.sendTenantWelcomeSms(
                            saved.getMobile(),
                            saved.getFirstName(),
                            tempPassword,
                            "http://localhost:5173/login"
                    );
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to auto-provision User/Credentials for Tenant: " + e.getMessage());
            e.printStackTrace();
        }

        // Mark Bed as OCCUPIED and assign tenant
        if (saved.getRoomNumber() != null && saved.getBedNumber() != null && !"ARCHIVED".equalsIgnoreCase(saved.getStatus()) && !"CHECKED_OUT".equalsIgnoreCase(saved.getStatus())) {
            List<Bed> orgBeds = bedRepository.findByOrganizationId(organization.getId());
            Bed bed = orgBeds.stream().filter(b ->
                saved.getBedNumber().equalsIgnoreCase(b.getBedNumber()) &&
                b.getRoom() != null &&
                saved.getRoomNumber().equalsIgnoreCase(b.getRoom().getRoomNumber())
            ).findFirst().orElse(null);
            if (bed != null) {
                bed.setStatus("OCCUPIED");
                bed.setTenantId(saved.getId() != null ? saved.getId().toString() : null);
                bed.setTenantName(saved.getFirstName() + " " + (saved.getLastName() != null ? saved.getLastName() : ""));
                bedRepository.save(bed);
            }
        }

        occupancySyncService.syncStatsAndEvictCaches(null);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PostMapping("/bulk-import")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN')")
    public ResponseEntity<?> bulkImportTenants(@RequestBody List<com.stayeaze.backend.payload.request.TenantBulkImportRequest> items) {
        if (items == null || items.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: No tenant records provided for import."));
        }

        Organization organization = getLoggedUserOrg();
        List<Property> orgProperties = propertyRepository.findByOrganization(organization);
        Property defaultProperty = (orgProperties != null && !orgProperties.isEmpty()) ? orgProperties.get(0) : null;

        int successCount = 0;
        int failCount = 0;
        List<java.util.Map<String, Object>> importResults = new ArrayList<>();
        java.util.Set<String> seenEmails = new java.util.HashSet<>();
        java.util.Set<String> seenMobiles = new java.util.HashSet<>();

        for (int i = 0; i < items.size(); i++) {
            com.stayeaze.backend.payload.request.TenantBulkImportRequest item = items.get(i);
            java.util.Map<String, Object> rowResult = new java.util.HashMap<>();
            rowResult.put("index", i + 1);
            rowResult.put("name", item.getName() != null ? item.getName() : item.getFirstName() + " " + item.getLastName());
            rowResult.put("email", item.getEmail());
            rowResult.put("mobile", item.getMobile());

            try {
                // 1. Universal Validation (Intra-file duplicate check & Database collisions with staff/residents)
                accountUniquenessService.validateBulkImportRow(
                    organization,
                    item.getEmail(),
                    item.getMobile(),
                    i + 1,
                    seenEmails,
                    seenMobiles
                );

                // 2. Resolve Target Property
                Property targetProperty = defaultProperty;
                if (item.getPropertyId() != null) {
                    targetProperty = propertyRepository.findById(item.getPropertyId()).orElse(defaultProperty);
                } else if (item.getPropertyName() != null && !item.getPropertyName().isBlank() && orgProperties != null) {
                    String pName = item.getPropertyName().trim().toLowerCase();
                    for (Property p : orgProperties) {
                        if (p.getName() != null && p.getName().trim().toLowerCase().contains(pName)) {
                            targetProperty = p;
                            break;
                        }
                    }
                }

                String cleanEmail = accountUniquenessService.normalizeEmail(item.getEmail());
                String cleanMobile = accountUniquenessService.normalizeMobile(item.getMobile());

                // 3. Create Tenant Entity
                Tenant tenant = new Tenant();
                tenant.setOrganization(organization);
                tenant.setFirstName(item.getFirstName());
                tenant.setLastName(item.getLastName());
                tenant.setEmail(cleanEmail);
                tenant.setMobile(cleanMobile != null ? cleanMobile : (item.getPhone() != null ? item.getPhone() : "9876543210"));
                tenant.setGender(item.getGender());
                tenant.setOccupation(item.getOccupation());
                tenant.setIdType(item.getIdType());
                tenant.setIdNumber(item.getIdNumber());
                tenant.setEmergencyContactName(item.getEmergencyContactName());
                tenant.setEmergencyContactMobile(item.getEmergencyContactMobile());
                tenant.setRent(item.getRent());
                tenant.setDeposit(item.getDeposit());
                tenant.setRoomNumber(item.getRoomNumber() != null ? item.getRoomNumber().trim() : "101");
                tenant.setBedNumber(item.getBedNumber() != null ? item.getBedNumber().trim() : "B1");
                tenant.setPropertyId(targetProperty != null ? targetProperty.getId() : null);

                String lStart = item.getLeaseStart();
                if (lStart != null && !lStart.isBlank()) {
                    tenant.setLeaseStart(lStart);
                } else {
                    tenant.setLeaseStart(java.time.LocalDate.now().toString());
                }
                if (item.getLeaseEnd() != null && !item.getLeaseEnd().isBlank()) {
                    tenant.setLeaseEnd(item.getLeaseEnd());
                }

                tenant.setStatus("ACTIVE");
                tenant.setKycStatus(item.getIdNumber() != null && !item.getIdNumber().isBlank() ? "VERIFIED" : "PENDING");
                Tenant saved = tenantRepository.save(tenant);

                // 4. Update Bed/Room occupancy if applicable
                if (targetProperty != null && item.getRoomNumber() != null) {
                    try {
                        List<Room> propertyRooms = roomRepository.findByPropertyIdNative(targetProperty.getId());
                        if (propertyRooms != null) {
                            for (Room room : propertyRooms) {
                                if (room.getRoomNumber() != null && room.getRoomNumber().equalsIgnoreCase(item.getRoomNumber().trim())) {
                                    if (item.getBedNumber() != null) {
                                        List<Bed> beds = bedRepository.findByRoomId(room.getId());
                                        if (beds != null) {
                                            for (Bed bed : beds) {
                                                if (bed.getBedNumber() != null && bed.getBedNumber().equalsIgnoreCase(item.getBedNumber().trim())) {
                                                    bed.setStatus("OCCUPIED");
                                                    bed.setTenantId(saved.getId().toString());
                                                    bedRepository.save(bed);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }

                // 5. Create CheckIn Record (Historical or current)
                try {
                    CheckIn checkIn = new CheckIn();
                    checkIn.setOrganization(organization);
                    checkIn.setTenantName(saved.getFirstName() + " " + saved.getLastName());
                    checkIn.setPropertyId(targetProperty != null ? targetProperty.getId() : UUID.randomUUID());
                    checkIn.setRoomNumber(saved.getRoomNumber());
                    checkIn.setBedNumber(saved.getBedNumber());
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
                    checkIn.setStatus("completed");
                    checkIn.setCode(invoiceSequenceService.nextCheckInCode(targetProperty, organization));
                    checkInRepository.save(checkIn);
                } catch (Exception ignored) {}

                // 6. Financial Accounting (Deposit Paid + Opening Balance Due)
                try {
                    java.math.BigDecimal depositAmt = saved.getDeposit() != null ? saved.getDeposit() : java.math.BigDecimal.ZERO;
                    if (Boolean.TRUE.equals(item.getDepositCollected()) && depositAmt.compareTo(java.math.BigDecimal.ZERO) > 0) {
                        Invoice depInv = new Invoice();
                        depInv.setTenant(saved);
                        depInv.setInvoiceNumber(invoiceSequenceService.nextRentalInvoiceNumber(saved));
                        depInv.setAmountDue(depositAmt);
                        depInv.setAmountPaid(depositAmt);
                        depInv.setStatus("PAID");
                        depInv.setIssueDate(java.time.LocalDate.now());
                        depInv.setDueDate(java.time.LocalDate.now());
                        Invoice savedDepInv = invoiceRepository.save(depInv);

                        Payment depPay = new Payment();
                        depPay.setInvoice(savedDepInv);
                        depPay.setAmount(depositAmt);
                        depPay.setPaymentDate(java.time.OffsetDateTime.now());
                        depPay.setPaymentMethod("CASH");
                        depPay.setTransactionReference("ONBOARDING-DEPOSIT-" + System.currentTimeMillis());
                        depPay.setStatus("COMPLETED");
                        paymentRepository.save(depPay);
                    }

                    java.math.BigDecimal openingDue = item.getOpeningBalanceDue();
                    if (openingDue != null && openingDue.compareTo(java.math.BigDecimal.ZERO) > 0) {
                        Invoice dueInv = new Invoice();
                        dueInv.setTenant(saved);
                        dueInv.setInvoiceNumber(invoiceSequenceService.nextRentalInvoiceNumber(saved));
                        dueInv.setAmountDue(openingDue);
                        dueInv.setAmountPaid(java.math.BigDecimal.ZERO);
                        dueInv.setStatus("UNPAID");
                        dueInv.setIssueDate(java.time.LocalDate.now());
                        dueInv.setDueDate(java.time.LocalDate.now().plusDays(7));
                        invoiceRepository.save(dueInv);
                    }
                } catch (Exception ignored) {}

                // 7. Auto-provision User & Credentials Dispatch
                if (Boolean.TRUE.equals(item.getSendCredentials()) && cleanEmail != null) {
                    try {
                        User user = userRepository.findByEmail(cleanEmail).orElse(null);
                        String tempPassword = credentialService.generateSecurePassword();
                        if (user == null) {
                            user = new User(organization, cleanEmail, passwordEncoder.encode(tempPassword), saved.getMobile() != null ? saved.getMobile() : "9876543210");
                            user.setFirstName(saved.getFirstName());
                            user.setMustChangePassword(true);
                            user.setTenantId(saved.getId());

                            Role tenantRole = roleRepository.findByName("ROLE_TENANT")
                                    .orElseGet(() -> roleRepository.save(new Role("ROLE_TENANT", "[]")));
                            java.util.Set<Role> roles = new java.util.HashSet<>();
                            roles.add(tenantRole);
                            user.setRoles(roles);

                            if (saved.getPropertyId() != null) {
                                List<UUID> pIds = new ArrayList<>();
                                pIds.add(saved.getPropertyId());
                                user.setPropertyIds(pIds);
                            }
                            userRepository.save(user);
                        } else {
                            user.setTenantId(saved.getId());
                            if (user.getOrganization() == null) {
                                user.setOrganization(organization);
                            }
                            userRepository.save(user);
                        }

                        String pName = targetProperty != null ? targetProperty.getName() : "StayEaze PG/Hostel";
                        emailService.sendTenantWelcomeOnboardingEmail(
                                cleanEmail,
                                saved.getFirstName() + " " + (saved.getLastName() != null ? saved.getLastName() : ""),
                                tempPassword,
                                pName,
                                saved.getRoomNumber(),
                                saved.getBedNumber(),
                                "http://localhost:5173/login"
                        );

                        if (saved.getMobile() != null && !saved.getMobile().isBlank()) {
                            smsService.sendTenantWelcomeSms(
                                    saved.getMobile(),
                                    saved.getFirstName(),
                                    tempPassword,
                                    "http://localhost:5173/login"
                            );
                        }
                    } catch (Exception ignored) {}
                }

                rowResult.put("status", "SUCCESS");
                rowResult.put("tenantId", saved.getId());
                rowResult.put("room", saved.getRoomNumber());
                rowResult.put("bed", saved.getBedNumber());
                importResults.add(rowResult);
                successCount++;

            } catch (Exception ex) {
                rowResult.put("status", "ERROR");
                rowResult.put("message", ex.getMessage());
                importResults.add(rowResult);
                failCount++;
            }
        }

        auditLogService.logCurrent("Bulk imported " + successCount + " tenants into organization.", null);
        occupancySyncService.syncStatsAndEvictCaches(null);

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("importedCount", successCount);
        response.put("failedCount", failCount);
        response.put("totalCount", items.size());
        response.put("results", importResults);

        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<?> getAllTenants(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        boolean isSuperAdmin = securityUtils.isSuperAdmin();

        List<Tenant> tenants;
        if (isSuperAdmin) {
            tenants = tenantRepository.findAllSuperAdmin();
        } else if (organization != null) {
            tenants = tenantRepository.findByOrganizationIdNative(organization.getId());
        } else {
            tenants = Collections.emptyList();
        }

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            tenants = tenants.stream()
                    .filter(t -> t.getPropertyId() != null && assignedProps.contains(t.getPropertyId()))
                    .collect(Collectors.toList());
        }

        if (propertyId != null) {
            tenants = tenants.stream()
                    .filter(t -> propertyId.equals(t.getPropertyId()))
                    .collect(Collectors.toList());
        }

        List<MinimalTenantDTO> dtos = tenants.stream().map(MinimalTenantDTO::fromEntity).collect(Collectors.toList());
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(dtos, page, pageSize));
    }

    @GetMapping("/minimal")
    public ResponseEntity<?> getMinimalTenants(@RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<Tenant> tenants = tenantRepository.findByOrganization(organization);

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            tenants = tenants.stream()
                    .filter(t -> t.getPropertyId() != null && assignedProps.contains(t.getPropertyId()))
                    .collect(Collectors.toList());
        }

        if (propertyId != null) {
            tenants = tenants.stream()
                    .filter(t -> propertyId.equals(t.getPropertyId()))
                    .collect(Collectors.toList());
        }

        List<MinimalTenantDTO> dtos = tenants.stream()
                .map(MinimalTenantDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getTenantStats(@RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();

        long total;
        long active;
        long checkedIn;
        long pendingOnboarding;
        long noticePeriod;

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();

        if (propertyId != null) {
            securityUtils.validatePropertyAccess(propertyId);
            total = tenantRepository.countByPropertyId(propertyId);
            active = tenantRepository.countByPropertyIdAndStatus(propertyId, "ACTIVE");
            checkedIn = tenantRepository.countByPropertyIdAndStatus(propertyId, "CHECKED_IN");
            pendingOnboarding = tenantRepository.countByPropertyIdAndStatus(propertyId, "PENDING")
                    + tenantRepository.countByPropertyIdAndStatus(propertyId, "ONBOARDING");
            noticePeriod = tenantRepository.countByPropertyIdAndStatus(propertyId, "NOTICE_PERIOD");
        } else if (assignedProps != null) {
            List<Tenant> tenants = tenantRepository.findByOrganization(organization).stream()
                    .filter(t -> t.getPropertyId() != null && assignedProps.contains(t.getPropertyId()))
                    .collect(Collectors.toList());
            total = tenants.size();
            active = tenants.stream().filter(t -> "ACTIVE".equalsIgnoreCase(t.getStatus())).count();
            checkedIn = tenants.stream().filter(t -> "CHECKED_IN".equalsIgnoreCase(t.getStatus())).count();
            pendingOnboarding = tenants.stream().filter(t -> "PENDING".equalsIgnoreCase(t.getStatus()) || "ONBOARDING".equalsIgnoreCase(t.getStatus())).count();
            noticePeriod = tenants.stream().filter(t -> "NOTICE_PERIOD".equalsIgnoreCase(t.getStatus())).count();
        } else {
            total = tenantRepository.countByOrganization(organization);
            active = tenantRepository.countByOrganizationAndStatus(organization, "ACTIVE");
            checkedIn = tenantRepository.countByOrganizationAndStatus(organization, "CHECKED_IN");
            pendingOnboarding = tenantRepository.countByOrganizationAndStatus(organization, "PENDING")
                    + tenantRepository.countByOrganizationAndStatus(organization, "ONBOARDING");
            noticePeriod = tenantRepository.countByOrganizationAndStatus(organization, "NOTICE_PERIOD");
        }

        long totalActiveTenants = active + checkedIn;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTenants", total);
        stats.put("activeTenants", totalActiveTenants > 0 ? totalActiveTenants : active);
        stats.put("checkedInTenants", checkedIn);
        stats.put("pendingOnboardingTenants", pendingOnboarding);
        stats.put("noticePeriodTenants", noticePeriod);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
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
            if (tenant == null) {
                tenant = tenantRepository.findById(id).orElse(null);
            }
        }

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        populateBuildingName(tenant);
        populateIdentityFromKyc(tenant);
        return ResponseEntity.ok(tenant);
    }

    private void populateIdentityFromKyc(Tenant tenant) {
        if (tenant == null) return;
        if (tenant.getIdNumber() == null || tenant.getIdNumber().isBlank()) {
            try {
                List<TenantDocument> docs = tenantDocumentRepository.findByTenant(tenant);
                if (docs != null && !docs.isEmpty()) {
                    TenantDocument firstDoc = docs.stream()
                            .filter(d -> d.getDocumentNumber() != null && !d.getDocumentNumber().isBlank())
                            .findFirst().orElse(null);
                    if (firstDoc != null) {
                        if (tenant.getIdType() == null || tenant.getIdType().isBlank()) {
                            tenant.setIdType(firstDoc.getDocumentType() != null ? firstDoc.getDocumentType().toLowerCase() : "aadhaar");
                        }
                        tenant.setIdNumber(firstDoc.getDocumentNumber());
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private void populateBuildingName(Tenant tenant) {
        if (tenant == null || tenant.getRoomNumber() == null || tenant.getRoomNumber().isBlank()) return;
        try {
            String bName = null;
            if (tenant.getPropertyId() != null) {
                bName = roomRepository.findBuildingNameByRoomNumberAndPropertyId(tenant.getRoomNumber().trim(), tenant.getPropertyId());
            }
            if (bName == null || bName.isBlank()) {
                bName = roomRepository.findBuildingNameByRoomNumber(tenant.getRoomNumber().trim());
            }
            if (bName != null && !bName.isBlank()) {
                tenant.setBuildingName(bName);
            }
        } catch (Exception ignored) {}
    }

    @PutMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
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
            if (tenant == null) {
                tenant = tenantRepository.findById(id).orElse(null);
                if (tenant != null) organization = tenant.getOrganization();
            }
        }

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        // Universal Uniqueness Validation (Staff & Other Active Residents)
        try {
            accountUniquenessService.validateTenantEmailAndMobile(
                organization,
                request.getEmail(),
                request.getMobile(),
                request.getEmergencyContactMobile(),
                id
            );
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank() && organization != null) {
            // Bed occupied = any non-checked-out OTHER tenant in the same bed
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
                return !t.getId().equals(id) && !isCheckedOut &&
                    request.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                    request.getBedNumber().equalsIgnoreCase(t.getBedNumber());
            });
            if (bedOccupied) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + request.getBedNumber() + " in Room " + request.getRoomNumber() + " is already occupied!"));
            }

            try {
                List<Room> orgRooms = roomRepository.findByOrganizationId(organization.getId());
                Room room = orgRooms.stream().filter(r -> request.getRoomNumber().equalsIgnoreCase(r.getRoomNumber())).findFirst().orElse(null);
                if (room != null) {
                    String rStatus = room.getStatus();
                    if (rStatus != null && ("ARCHIVED".equalsIgnoreCase(rStatus) || "MAINTENANCE".equalsIgnoreCase(rStatus) || "BLOCKED".equalsIgnoreCase(rStatus))) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: Room " + request.getRoomNumber() + " is " + rStatus.toLowerCase() + " and cannot be assigned!"));
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
            } catch (Exception ignored) {}
        }

        UUID oldPropertyId = tenant.getPropertyId();
        String oldRoomNumber = tenant.getRoomNumber();
        String oldBedNumber = tenant.getBedNumber();
        String oldStatus = tenant.getStatus();
        BigDecimal oldRent = tenant.getRent();
        BigDecimal oldDeposit = tenant.getDeposit();

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
        tenant.setLockInMonths(request.getLockInMonths());
        tenant.setNoticePeriodDays(request.getNoticePeriodDays());
        if (request.getStatus() != null) {
            tenant.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getBillingResponsibility() != null) {
            tenant.setBillingResponsibility(request.getBillingResponsibility());
        }
        if (request.getCorporateCompanyName() != null) {
            tenant.setCorporateCompanyName(request.getCorporateCompanyName());
        }
        if (request.getCorporateGstin() != null) {
            tenant.setCorporateGstin(request.getCorporateGstin());
        }
        if (request.getUtilityResponsibility() != null) {
            tenant.setUtilityResponsibility(request.getUtilityResponsibility());
        }
        if (request.getDepositResponsibility() != null) {
            tenant.setDepositResponsibility(request.getDepositResponsibility());
        }

        if (request.getRefundAccountName() != null) {
            tenant.setRefundAccountName(request.getRefundAccountName().trim());
        }
        if (request.getRefundAccountNumber() != null) {
            tenant.setRefundAccountNumber(request.getRefundAccountNumber().trim());
        }
        if (request.getRefundIfsc() != null) {
            tenant.setRefundIfsc(request.getRefundIfsc().trim().toUpperCase());
        }
        if (request.getRefundBankName() != null) {
            tenant.setRefundBankName(request.getRefundBankName().trim());
        }
        if (request.getRefundUpi() != null) {
            tenant.setRefundUpi(request.getRefundUpi().trim());
        }

        Tenant updated = tenantRepository.save(tenant);
        populateBuildingName(updated);
        auditLogService.logCurrent("Updated tenant record: " + (updated.getFirstName() != null ? updated.getFirstName() : "") + " " + (updated.getLastName() != null ? updated.getLastName() : ""), null);

        // Perform Financial Reconciliations for Mid-Cycle Room/Rent Changes
        boolean rentChanged = (oldRent != null && updated.getRent() != null && oldRent.compareTo(updated.getRent()) != 0);
        if (rentChanged || (oldRoomNumber != null && !oldRoomNumber.equalsIgnoreCase(updated.getRoomNumber()))) {
            try {
                roomTransferReconciliationService.reconcileMidCycleTransfer(
                        updated,
                        oldRent,
                        updated.getRent(),
                        oldDeposit,
                        updated.getDeposit(),
                        oldRoomNumber,
                        updated.getRoomNumber(),
                        organization
                );
            } catch (Exception recEx) {
                System.err.println("Warning during mid-cycle transfer reconciliation: " + recEx.getMessage());
            }
        }

        // Trigger Atomic Room/Bed Transfer & Occupancy Synchronization
        boolean locationChanged = (oldRoomNumber != null && !oldRoomNumber.equalsIgnoreCase(updated.getRoomNumber())) ||
                                 (oldBedNumber != null && !oldBedNumber.equalsIgnoreCase(updated.getBedNumber())) ||
                                 (oldPropertyId != null && !oldPropertyId.equals(updated.getPropertyId())) ||
                                 (oldRoomNumber == null && updated.getRoomNumber() != null);

        boolean statusChanged = (oldStatus != null && !oldStatus.equalsIgnoreCase(updated.getStatus()));

        if (locationChanged || statusChanged) {
            occupancySyncService.handleTenantRoomTransfer(
                updated,
                oldPropertyId,
                oldRoomNumber,
                oldBedNumber,
                updated.getPropertyId(),
                updated.getRoomNumber(),
                updated.getBedNumber(),
                organization
            );
        } else {
            occupancySyncService.syncAllStatsForOrg(organization);
        }

        if ("ACTIVE".equalsIgnoreCase(updated.getStatus()) || "CHECKED_IN".equalsIgnoreCase(updated.getStatus()) || "COMPLETED".equalsIgnoreCase(updated.getStatus())) {
            final String tenantFullName = (updated.getFirstName() + " " + updated.getLastName()).trim();
            final UUID targetOrgId = organization != null ? organization.getId() : null;
            List<CheckIn> tenantCheckIns = targetOrgId != null ? checkInRepository.findByOrganizationId(targetOrgId) : checkInRepository.findAll();
            for (CheckIn ci : tenantCheckIns) {
                if (ci == null) continue;
                boolean matches = (ci.getTenantName() != null && ci.getTenantName().equalsIgnoreCase(tenantFullName)) ||
                                  (updated.getRoomNumber() != null && !updated.getRoomNumber().isBlank() && updated.getRoomNumber().equalsIgnoreCase(ci.getRoomNumber()) &&
                                   updated.getBedNumber() != null && !updated.getBedNumber().isBlank() && updated.getBedNumber().equalsIgnoreCase(ci.getBedNumber()));
                if (matches && "pending".equalsIgnoreCase(ci.getStatus())) {
                    ci.setStatus("completed");
                    checkInRepository.save(ci);
                }
            }
        }
        occupancySyncService.syncAllStatsForOrg(organization);
        return ResponseEntity.ok(updated);
    }

    private void freeTenantBed(Tenant tenant) {
        if (tenant == null) return;
        try {
            if (tenant.getRoomNumber() != null && tenant.getBedNumber() != null && tenant.getOrganization() != null) {
                bedRepository.findByRoomNumberAndBedNumberAndOrgId(tenant.getRoomNumber(), tenant.getBedNumber(), tenant.getOrganization().getId())
                        .ifPresent(b -> {
                            b.setStatus("AVAILABLE");
                            bedRepository.save(b);
                            if (b.getRoom() != null && b.getRoom().getFloor() != null) {
                                occupancySyncService.syncStatsAndEvictCaches(b.getRoom().getFloor());
                            }
                        });
            }
        } catch (Exception e) {
            System.err.println("Warning freeing bed for tenant: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN')")
    public ResponseEntity<?> archiveTenant(@PathVariable UUID id) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Tenant tenant;
        if (isSuperAdmin) {
            tenant = tenantRepository.findById(id).orElse(null);
        } else {
            Organization organization = getLoggedUserOrg();
            tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
            if (tenant == null) {
                tenant = tenantRepository.findById(id).orElse(null);
            }
        }

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        // Free up assigned Bed and make room vacant
        freeTenantBed(tenant);

        tenant.setStatus("ARCHIVED");
        tenantRepository.save(tenant);
        auditLogService.logCurrent("Archived tenant record: " + (tenant.getFirstName() != null ? tenant.getFirstName() : "") + " " + (tenant.getLastName() != null ? tenant.getLastName() : ""), null);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Tenant archived successfully and bed freed."));
    }

    @PutMapping("/{id}/unarchive")
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN')")
    public ResponseEntity<?> unarchiveTenant(@PathVariable UUID id, @RequestBody(required = false) java.util.Map<String, Object> req) {
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        Tenant tenant;
        Organization organization = null;
        if (isSuperAdmin) {
            tenant = tenantRepository.findById(id).orElse(null);
        } else {
            organization = getLoggedUserOrg();
            tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        }

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant profile not found."));
        }

        if (organization == null) {
            organization = tenant.getOrganization();
        }

        if (req != null) {
            if (req.get("roomNumber") != null) tenant.setRoomNumber(req.get("roomNumber").toString());
            if (req.get("bedNumber") != null) tenant.setBedNumber(req.get("bedNumber").toString());
        }

        if (tenant.getBedNumber() != null && tenant.getRoomNumber() != null && organization != null) {
            final String targetRoom = tenant.getRoomNumber();
            final String targetBed = tenant.getBedNumber();
            boolean bedAlreadyTaken = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
                return !t.getId().equals(id) && !isCheckedOut &&
                    targetRoom.equalsIgnoreCase(t.getRoomNumber()) &&
                    targetBed.equalsIgnoreCase(t.getBedNumber());
            });
            if (bedAlreadyTaken) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed " + tenant.getBedNumber() + " in Room " + tenant.getRoomNumber() + " is currently occupied by another active resident. Please reassign the room/bed before unarchiving."));
            }

            // Re-occupy Bed
            bedRepository.findByRoomNumberAndBedNumberAndOrgId(targetRoom, targetBed, organization.getId())
                    .ifPresent(b -> {
                        b.setStatus("OCCUPIED");
                        bedRepository.save(b);
                        if (b.getRoom() != null && b.getRoom().getFloor() != null) {
                            occupancySyncService.syncStatsAndEvictCaches(b.getRoom().getFloor());
                        }
                    });
        }

        // Clean Reset of Lease Dates & Phantom Balances for Restored Tenant
        tenant.setStatus("ACTIVE");
        if (req != null && req.get("leaseStart") != null) {
            tenant.setLeaseStart(req.get("leaseStart").toString());
        } else {
            tenant.setLeaseStart(java.time.LocalDate.now().toString());
        }

        if (req != null && req.get("leaseEnd") != null) {
            tenant.setLeaseEnd(req.get("leaseEnd").toString());
        } else {
            tenant.setLeaseEnd(null); // Clear past expired checkout date!
        }

        // Reset advance balance so past settled monies are not carried over as phantom credits
        tenant.setAdvanceBalance(BigDecimal.ZERO);

        Tenant updated = tenantRepository.save(tenant);
        auditLogService.logCurrent("Unarchived tenant record: " + (updated.getFirstName() != null ? updated.getFirstName() : "") + " " + (updated.getLastName() != null ? updated.getLastName() : ""), null);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Tenant successfully unarchived with clean active tenure and bed marked occupied."));
    }

    @PostMapping("/{id}/send-credentials")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN')")
    public ResponseEntity<?> resendTenantCredentials(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant record not found."));
        }

        if (tenant.getEmail() == null || tenant.getEmail().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Tenant does not have a valid email address configured."));
        }

        try {
            String tEmail = tenant.getEmail().trim().toLowerCase();
            User user = userRepository.findByEmail(tEmail).orElse(null);
            String tempPassword = credentialService.generateSecurePassword();
            if (user == null) {
                user = new User(organization, tEmail, passwordEncoder.encode(tempPassword), tenant.getMobile() != null ? tenant.getMobile() : "9876543210");
                user.setFirstName(tenant.getFirstName());
                user.setMustChangePassword(true);
                user.setTenantId(tenant.getId());

                Role tenantRole = roleRepository.findByName("ROLE_TENANT")
                        .orElseGet(() -> roleRepository.save(new Role("ROLE_TENANT", "[]")));
                java.util.Set<Role> roles = new java.util.HashSet<>();
                roles.add(tenantRole);
                user.setRoles(roles);

                if (tenant.getPropertyId() != null) {
                    List<UUID> pIds = new ArrayList<>();
                    pIds.add(tenant.getPropertyId());
                    user.setPropertyIds(pIds);
                }
            } else {
                user.setOrganization(organization);
                user.setStatus("ACTIVE");
                user.setLockedUntil(null);
                user.setFailedAttempts(0);
                user.setPassword(passwordEncoder.encode(tempPassword));
                user.setMustChangePassword(true);
                user.setTenantId(tenant.getId());
                if (tenant.getPropertyId() != null) {
                    List<UUID> pIds = new ArrayList<>();
                    pIds.add(tenant.getPropertyId());
                    user.setPropertyIds(pIds);
                }
                userRepository.save(user);
            }

            String pName = "StayEaze PG/Hostel";
            if (tenant.getPropertyId() != null) {
                Property p = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
                if (p != null) pName = p.getName();
            }

            emailService.sendTenantWelcomeOnboardingEmail(
                    tEmail,
                    tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : ""),
                    tempPassword,
                    pName,
                    tenant.getRoomNumber(),
                    tenant.getBedNumber(),
                    "http://localhost:5173/login"
            );

            if (tenant.getMobile() != null && !tenant.getMobile().isBlank()) {
                smsService.sendTenantWelcomeSms(
                        tenant.getMobile(),
                        tenant.getFirstName(),
                        tempPassword,
                        "http://localhost:5173/login"
                );
            }

            return ResponseEntity.ok(new MessageResponse("Welcome credentials sent successfully to " + tEmail + " via Email & SMS."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error dispatching credentials: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/verify-document")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN')")
    public ResponseEntity<?> verifyTenantDocument(@PathVariable UUID id, @RequestBody java.util.Map<String, String> req) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findById(id).orElse(null);
        if (tenant == null || (organization != null && tenant.getOrganization() != null && !organization.getId().equals(tenant.getOrganization().getId()) && !securityUtils.isSuperAdmin())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant record not found."));
        }

        String status = req.get("status");
        if (status == null || (!"VERIFIED".equalsIgnoreCase(status) && !"REJECTED".equalsIgnoreCase(status) && !"PENDING".equalsIgnoreCase(status))) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid status. Must be VERIFIED, REJECTED, or PENDING."));
        }

        if ("VERIFIED".equalsIgnoreCase(status)) {
            List<TenantDocument> docs = tenantDocumentRepository.findByTenant(tenant);
            boolean hasUploadedDocs = docs != null && !docs.isEmpty();
            boolean hasIdDoc = tenant.getIdNumber() != null && !tenant.getIdNumber().isBlank();
            if (!hasUploadedDocs && !hasIdDoc) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Cannot approve KYC. No identity or verification documents have been uploaded for this resident."));
            }
        }

        tenant.setKycStatus(status.toUpperCase());
        Tenant saved = tenantRepository.save(tenant);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/approve-desk-payment")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN')")
    public ResponseEntity<?> approveDeskPayment(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant record not found."));
        }

        // Find initial unpaid invoices for this tenant
        List<Invoice> invoices = invoiceRepository.findByTenant(tenant);
        String invNumber = null;
        for (Invoice inv : invoices) {
            if (!"PAID".equalsIgnoreCase(inv.getStatus())) {
                inv.setStatus("PAID");
                inv.setAmountPaid(inv.getAmountDue());
                inv.setPaymentMethod("CASH");
                inv.setPaymentReference("DESK_CASH_APPROVED_" + (System.currentTimeMillis() % 1000000L));
                Invoice savedInv = invoiceRepository.save(inv);
                if (invNumber == null && savedInv.getInvoiceNumber() != null && !savedInv.getInvoiceNumber().isBlank()) {
                    invNumber = savedInv.getInvoiceNumber();
                }
            }
        }
        if (invNumber == null && !invoices.isEmpty()) {
            invNumber = invoices.get(0).getInvoiceNumber();
        }

        tenant.setStatus("ACTIVE");
        tenantRepository.save(tenant);
        auditLogService.log("Desk onboarding payment approved and verified for resident: " + tenant.getName(), null);

        // Dispatch Payment Success Email with Property Branding
        try {
            if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                String pName = "StayEaze Residency";
                if (tenant.getPropertyId() != null) {
                    Property p = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
                    if (p != null) pName = p.getName();
                }
                if (invNumber == null || invNumber.isBlank()) {
                    invNumber = invoiceSequenceService.nextRentalInvoiceNumber(tenant);
                }

                emailService.sendRentPaymentSuccessEmail(
                        tenant.getEmail(),
                        tenant.getName(),
                        invNumber,
                        tenant.getRent() != null ? tenant.getRent() : java.math.BigDecimal.ZERO,
                        "CASH (Desk Approved)",
                        "DESK_CASH_" + (System.currentTimeMillis() % 1000000L),
                        pName
                );
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(new MessageResponse("Desk payment approved successfully! Resident accommodation is now Active."));
    }

    @PostMapping("/swap-beds")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> swapBeds(@RequestBody Map<String, Object> req) {
        Organization organization = getLoggedUserOrg();
        if (req == null || !req.containsKey("tenantId1") || !req.containsKey("tenantId2")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Both tenantId1 and tenantId2 are required."));
        }

        UUID id1 = UUID.fromString(req.get("tenantId1").toString());
        UUID id2 = UUID.fromString(req.get("tenantId2").toString());

        if (id1.equals(id2)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Cannot swap beds for the same tenant."));
        }

        Tenant t1 = tenantRepository.findByIdAndOrganization(id1, organization).orElse(null);
        Tenant t2 = tenantRepository.findByIdAndOrganization(id2, organization).orElse(null);

        if (t1 == null || t2 == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: One or both tenants not found in your organization."));
        }

        if ("ARCHIVED".equalsIgnoreCase(t1.getStatus()) || "CHECKED_OUT".equalsIgnoreCase(t1.getStatus()) ||
            "ARCHIVED".equalsIgnoreCase(t2.getStatus()) || "CHECKED_OUT".equalsIgnoreCase(t2.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Both tenants must be active residents to perform a bed swap."));
        }

        String oldRoom1 = t1.getRoomNumber();
        String oldBed1 = t1.getBedNumber();
        BigDecimal oldRent1 = t1.getRent();
        BigDecimal oldDeposit1 = t1.getDeposit();

        String oldRoom2 = t2.getRoomNumber();
        String oldBed2 = t2.getBedNumber();
        BigDecimal oldRent2 = t2.getRent();
        BigDecimal oldDeposit2 = t2.getDeposit();

        if (oldRoom1 == null || oldBed1 == null || oldRoom2 == null || oldBed2 == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Both tenants must currently have an assigned room and bed number."));
        }

        // 1. Swap assignments on Tenant records
        t1.setRoomNumber(oldRoom2);
        t1.setBedNumber(oldBed2);
        t2.setRoomNumber(oldRoom1);
        t2.setBedNumber(oldBed1);

        // 2. Re-assign Bed entities
        List<Bed> orgBeds = bedRepository.findByOrganizationId(organization.getId());
        Bed bed1 = orgBeds.stream().filter(b ->
                oldBed1.equalsIgnoreCase(b.getBedNumber()) &&
                b.getRoom() != null &&
                oldRoom1.equalsIgnoreCase(b.getRoom().getRoomNumber())
        ).findFirst().orElse(null);

        Bed bed2 = orgBeds.stream().filter(b ->
                oldBed2.equalsIgnoreCase(b.getBedNumber()) &&
                b.getRoom() != null &&
                oldRoom2.equalsIgnoreCase(b.getRoom().getRoomNumber())
        ).findFirst().orElse(null);

        if (bed1 != null) {
            bed1.setTenantId(t2.getId() != null ? t2.getId().toString() : null);
            bed1.setTenantName(t2.getFirstName() + " " + (t2.getLastName() != null ? t2.getLastName() : ""));
            bed1.setStatus("OCCUPIED");
            bedRepository.save(bed1);
        }

        if (bed2 != null) {
            bed2.setTenantId(t1.getId() != null ? t1.getId().toString() : null);
            bed2.setTenantName(t1.getFirstName() + " " + (t1.getLastName() != null ? t1.getLastName() : ""));
            bed2.setStatus("OCCUPIED");
            bedRepository.save(bed2);
        }

        // 3. Reconcile rent / deposit differences if rents differed
        RoomTransferReconciliationService.ReconciliationResult rec1 = roomTransferReconciliationService.reconcileMidCycleTransfer(
                t1, oldRent1, t2.getRent(), oldDeposit1, t2.getDeposit(), oldRoom1, oldRoom2, organization
        );

        RoomTransferReconciliationService.ReconciliationResult rec2 = roomTransferReconciliationService.reconcileMidCycleTransfer(
                t2, oldRent2, t1.getRent(), oldDeposit2, t1.getDeposit(), oldRoom2, oldRoom1, organization
        );

        Tenant saved1 = tenantRepository.save(t1);
        Tenant saved2 = tenantRepository.save(t2);

        // 4. Auto-generate Digital Lease Addendums for both residents
        try {
            Agreement addendum1 = new Agreement(
                    saved1,
                    String.format("MUTUAL BED SWAP ADDENDUM\n\nEffective Date: %s\nResident: %s %s\nPrevious: Room %s (Bed %s)\nNew Assignment: Room %s (Bed %s)\nMonthly Rent: ₹%s\nSecurity Deposit: ₹%s\n\nThis Addendum amends the Primary Tenancy Agreement with mutual consent.",
                            LocalDate.now(), saved1.getFirstName(), saved1.getLastName(), oldRoom1, oldBed1, oldRoom2, oldBed2, saved1.getRent(), saved1.getDeposit()),
                    LocalDate.now(),
                    saved1.getLeaseEnd() != null && !saved1.getLeaseEnd().isBlank() ? LocalDate.parse(saved1.getLeaseEnd()) : LocalDate.now().plusMonths(11)
            );
            addendum1.setStatus("SIGNED");
            addendum1.setSignedAt(java.time.OffsetDateTime.now());
            agreementRepository.save(addendum1);

            Agreement addendum2 = new Agreement(
                    saved2,
                    String.format("MUTUAL BED SWAP ADDENDUM\n\nEffective Date: %s\nResident: %s %s\nPrevious: Room %s (Bed %s)\nNew Assignment: Room %s (Bed %s)\nMonthly Rent: ₹%s\nSecurity Deposit: ₹%s\n\nThis Addendum amends the Primary Tenancy Agreement with mutual consent.",
                            LocalDate.now(), saved2.getFirstName(), saved2.getLastName(), oldRoom2, oldBed2, oldRoom1, oldBed1, saved2.getRent(), saved2.getDeposit()),
                    LocalDate.now(),
                    saved2.getLeaseEnd() != null && !saved2.getLeaseEnd().isBlank() ? LocalDate.parse(saved2.getLeaseEnd()) : LocalDate.now().plusMonths(11)
            );
            addendum2.setStatus("SIGNED");
            addendum2.setSignedAt(java.time.OffsetDateTime.now());
            agreementRepository.save(addendum2);
        } catch (Exception ignored) {}

        occupancySyncService.syncStatsAndEvictCaches(null);
        auditLogService.logCurrent(String.format("Mutual Bed Swap executed: %s (now in Room %s, Bed %s) <-> %s (now in Room %s, Bed %s)",
                saved1.getName(), saved1.getRoomNumber(), saved1.getBedNumber(),
                saved2.getName(), saved2.getRoomNumber(), saved2.getBedNumber()), null);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("message", "Mutual bed swap completed successfully. Digital lease addendums generated.");
        resp.put("tenant1", saved1);
        resp.put("tenant2", saved2);
        resp.put("reconciliation1", rec1 != null ? rec1.actionTaken : "NO_ACTION");
        resp.put("reconciliation2", rec2 != null ? rec2.actionTaken : "NO_ACTION");
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/{id}/financial-statement")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getTenantFinancialStatement(@PathVariable UUID id, @RequestParam(required = false) Integer year) {
        Tenant tenant = tenantRepository.findById(id).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant profile not found"));
        }

        Property property = null;
        if (tenant.getPropertyId() != null) {
            property = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
        }

        Organization org = tenant.getOrganization();
        OrganizationBillingProfile profile = organizationBillingProfileRepository.findByOrganization(org).orElse(null);

        List<Invoice> allInvoices = invoiceRepository.findByTenant(tenant);
        List<Map<String, Object>> invoiceLedger = new ArrayList<>();
        BigDecimal totalBilled = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;

        for (Invoice inv : allInvoices) {
            if ("CANCELLED".equalsIgnoreCase(inv.getStatus())) continue;

            if (year != null && inv.getIssueDate() != null && inv.getIssueDate().getYear() != year) {
                continue;
            }

            BigDecimal due = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
            BigDecimal paid = inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO;
            totalBilled = totalBilled.add(due);
            totalPaid = totalPaid.add(paid);

            List<Payment> payments = paymentRepository.findByInvoice(inv);

            Map<String, Object> invData = new HashMap<>();
            invData.put("id", inv.getId());
            invData.put("invoiceNumber", inv.getInvoiceNumber());
            invData.put("issueDate", inv.getIssueDate() != null ? inv.getIssueDate().toString() : "");
            invData.put("dueDate", inv.getDueDate() != null ? inv.getDueDate().toString() : "");
            invData.put("amountDue", due);
            invData.put("amountPaid", paid);
            invData.put("status", inv.getStatus());
            invData.put("description", inv.getItems() != null && !inv.getItems().isEmpty() ? inv.getItems().get(0).getDescription() : "Rent & Amenities");
            invData.put("payments", payments.stream().map(p -> {
                Map<String, Object> payMap = new HashMap<>();
                payMap.put("id", p.getId());
                payMap.put("amount", p.getAmount());
                payMap.put("method", p.getPaymentMethod());
                payMap.put("transactionRef", p.getTransactionReference());
                payMap.put("paymentDate", p.getPaymentDate() != null ? p.getPaymentDate().toString() : "");
                payMap.put("receiptUrl", p.getReceiptUrl());
                return payMap;
            }).collect(Collectors.toList()));

            invoiceLedger.add(invData);
        }

        Map<String, Object> statement = new HashMap<>();
        statement.put("statementNumber", "STMT-" + (year != null ? year : java.time.LocalDate.now().getYear()) + "-" + tenant.getId().toString().substring(0, 6).toUpperCase());
        statement.put("generatedDate", java.time.LocalDate.now().toString());
        statement.put("financialYear", year != null ? "FY " + (year - 1) + "-" + String.valueOf(year).substring(2) : "All-Time Statement");
        statement.put("tenantId", tenant.getId());
        statement.put("tenantName", tenant.getName());
        statement.put("mobile", tenant.getMobile());
        statement.put("email", tenant.getEmail());
        statement.put("roomNumber", tenant.getRoomNumber());
        statement.put("bedNumber", tenant.getBedNumber());
        statement.put("leaseStart", tenant.getLeaseStart());
        statement.put("leaseEnd", tenant.getLeaseEnd());
        statement.put("monthlyRent", tenant.getRent());
        statement.put("securityDepositPaid", tenant.getDeposit());
        statement.put("advanceWalletBalance", tenant.getAdvanceBalance());
        statement.put("propertyName", property != null ? property.getName() : "StayEaze Residency");
        statement.put("propertyAddress", property != null ? property.getAddress() : "");
        statement.put("landlordLegalName", profile != null && profile.getLegalName() != null ? profile.getLegalName() : (org != null ? org.getName() : "StayEaze"));
        statement.put("landlordPan", profile != null ? profile.getPan() : "");
        statement.put("landlordGstin", profile != null ? profile.getGstin() : "");
        statement.put("totalRentBilled", totalBilled);
        statement.put("totalRentPaid", totalPaid);
        statement.put("outstandingBalance", totalBilled.subtract(totalPaid));
        statement.put("invoices", invoiceLedger);
        statement.put("isHraEligible", totalPaid.compareTo(BigDecimal.ZERO) > 0);

        return ResponseEntity.ok(statement);
    }

    /**
     * P2.2: Preview mid-cycle room transfer reconciliation math before committing.
     */
    @PostMapping("/tenants/{id}/preview-room-transfer")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN')")
    public ResponseEntity<?> previewRoomTransfer(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Resident not found."));
        }

        BigDecimal oldRent = tenant.getRent() != null ? tenant.getRent() : BigDecimal.ZERO;
        BigDecimal newRent = req.containsKey("newRent") && req.get("newRent") != null
                ? new BigDecimal(req.get("newRent").toString())
                : oldRent;

        BigDecimal oldDeposit = tenant.getDeposit() != null ? tenant.getDeposit() : BigDecimal.ZERO;
        BigDecimal newDeposit = req.containsKey("newDeposit") && req.get("newDeposit") != null
                ? new BigDecimal(req.get("newDeposit").toString())
                : oldDeposit;

        LocalDate today = LocalDate.now();
        int daysInMonth = today.lengthOfMonth();
        int currentDay = today.getDayOfMonth();
        int remainingDays = Math.max(1, daysInMonth - currentDay + 1);

        BigDecimal deltaRent = newRent.subtract(oldRent);
        BigDecimal dailyDelta = deltaRent.divide(BigDecimal.valueOf(daysInMonth), 2, java.math.RoundingMode.HALF_UP);
        BigDecimal proRataDiff = dailyDelta.multiply(BigDecimal.valueOf(remainingDays)).setScale(2, java.math.RoundingMode.HALF_UP).abs();
        BigDecimal depositTopUp = newDeposit.compareTo(oldDeposit) > 0 ? newDeposit.subtract(oldDeposit) : BigDecimal.ZERO;

        boolean isUpgrade = newRent.compareTo(oldRent) > 0;
        boolean isDowngrade = newRent.compareTo(oldRent) < 0;

        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("tenantId", tenant.getId());
        preview.put("tenantName", tenant.getName());
        preview.put("currentRoom", tenant.getRoomNumber());
        preview.put("currentBed", tenant.getBedNumber());
        preview.put("targetRoom", req.get("newRoomNumber"));
        preview.put("targetBed", req.get("newBedNumber"));
        preview.put("oldRent", oldRent);
        preview.put("newRent", newRent);
        preview.put("deltaRent", deltaRent);
        preview.put("oldDeposit", oldDeposit);
        preview.put("newDeposit", newDeposit);
        preview.put("depositTopUp", depositTopUp);
        preview.put("daysInMonth", daysInMonth);
        preview.put("remainingDays", remainingDays);
        preview.put("proRataDifference", proRataDiff);
        preview.put("isUpgrade", isUpgrade);
        preview.put("isDowngrade", isDowngrade);
        preview.put("currentAdvanceBalance", tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO);

        String summary;
        if (isUpgrade) {
            BigDecimal totalDue = proRataDiff.add(depositTopUp);
            summary = String.format("Room Upgrade: +₹%s/mo. Pro-rata rent delta for %d remaining days: ₹%s. Deposit top-up: ₹%s. Net invoice to generate: ₹%s.",
                    deltaRent.abs(), remainingDays, proRataDiff, depositTopUp, totalDue);
            preview.put("actionType", "UPGRADE_INVOICE");
            preview.put("netInvoiceDue", totalDue);
        } else if (isDowngrade) {
            summary = String.format("Room Downgrade: -₹%s/mo. Pro-rata surplus of ₹%s (%d days) will be credited directly to resident's Advance Wallet.",
                    deltaRent.abs(), proRataDiff, remainingDays);
            preview.put("actionType", "ADVANCE_CREDIT");
            preview.put("surplusCredit", proRataDiff);
        } else {
            summary = "Same rent rate. Room transfer will be processed without financial adjustments.";
            preview.put("actionType", "LATERAL_TRANSFER");
        }
        preview.put("summary", summary);

        return ResponseEntity.ok(preview);
    }

    /**
     * P2.2: Execute room transfer wizard with atomic reconciliation and digital addendum generation.
     */
    @PostMapping("/tenants/{id}/transfer-room")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN')")
    public ResponseEntity<?> executeRoomTransferWizard(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Resident not found."));
        }

        String oldRoomNumber = tenant.getRoomNumber();
        String oldBedNumber = tenant.getBedNumber();
        UUID oldPropertyId = tenant.getPropertyId();
        BigDecimal oldRent = tenant.getRent() != null ? tenant.getRent() : BigDecimal.ZERO;
        BigDecimal oldDeposit = tenant.getDeposit() != null ? tenant.getDeposit() : BigDecimal.ZERO;

        String newRoomNumber = req.containsKey("newRoomNumber") && req.get("newRoomNumber") != null ? req.get("newRoomNumber").toString().trim() : oldRoomNumber;
        String newBedNumber = req.containsKey("newBedNumber") && req.get("newBedNumber") != null ? req.get("newBedNumber").toString().trim() : oldBedNumber;

        UUID newPropertyId = oldPropertyId;
        if (req.containsKey("newPropertyId") && req.get("newPropertyId") != null && !req.get("newPropertyId").toString().isBlank()) {
            try {
                newPropertyId = UUID.fromString(req.get("newPropertyId").toString());
            } catch (Exception ignored) {}
        }

        BigDecimal newRent = req.containsKey("newRent") && req.get("newRent") != null
                ? new BigDecimal(req.get("newRent").toString())
                : oldRent;

        BigDecimal newDeposit = req.containsKey("newDeposit") && req.get("newDeposit") != null
                ? new BigDecimal(req.get("newDeposit").toString())
                : oldDeposit;

        // 1. Update Tenant record
        tenant.setRoomNumber(newRoomNumber);
        tenant.setBedNumber(newBedNumber);
        tenant.setPropertyId(newPropertyId);
        tenant.setRent(newRent);
        tenant.setDeposit(newDeposit);
        Tenant savedTenant = tenantRepository.save(tenant);

        // 2. Perform Financial Reconciliations for Mid-Cycle Transfer
        RoomTransferReconciliationService.ReconciliationResult recResult = roomTransferReconciliationService.reconcileMidCycleTransfer(
                savedTenant,
                oldRent,
                newRent,
                oldDeposit,
                newDeposit,
                oldRoomNumber,
                newRoomNumber,
                organization
        );

        // 3. Atomically sync occupancy across old and new beds
        occupancySyncService.handleTenantRoomTransfer(
                savedTenant,
                oldPropertyId,
                oldRoomNumber,
                oldBedNumber,
                newPropertyId,
                newRoomNumber,
                newBedNumber,
                organization
        );

        auditLogService.logCurrent(String.format("Executed Room Transfer for %s: Room %s (Bed %s) -> Room %s (Bed %s), Rent: ₹%s -> ₹%s (Action: %s)",
                savedTenant.getName(), oldRoomNumber, oldBedNumber, newRoomNumber, newBedNumber, oldRent, newRent,
                recResult != null ? recResult.actionTaken : "LATERAL_TRANSFER"), null);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("message", String.format("Resident successfully transferred to Room %s (Bed %s).", newRoomNumber, newBedNumber));
        resp.put("tenant", savedTenant);
        resp.put("reconciliationAction", recResult != null ? recResult.actionTaken : "LATERAL_TRANSFER");
        resp.put("proRataDifference", recResult != null ? recResult.proRataDifference : BigDecimal.ZERO);
        resp.put("generatedInvoice", recResult != null ? recResult.generatedInvoice : null);
        resp.put("updatedAdvanceBalance", savedTenant.getAdvanceBalance());

        return ResponseEntity.ok(resp);
    }

    @GetMapping("/tenants/expiring-leases")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getExpiringLeases() {
        Organization org = null;
        try {
            org = getLoggedUserOrg();
        } catch (Exception ignored) {}
        return ResponseEntity.ok(tenantNoticePeriodService.getExpiringLeasesInNoticeWindow(org));
    }

    @PostMapping("/tenants/notice-reminders/run")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> runNoticeRemindersSweep() {
        Organization org = null;
        try {
            org = getLoggedUserOrg();
        } catch (Exception ignored) {}
        return ResponseEntity.ok(tenantNoticePeriodService.checkAndSendNoticePeriodReminders(org));
    }

    @PostMapping("/tenants/{id}/send-notice-reminder")
    @PreAuthorize("hasRole('ADMIN') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> sendSingleNoticeReminder(@PathVariable UUID id) {
        try {
            Map<String, Object> result = tenantNoticePeriodService.sendSingleTenantNoticeReminder(id);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Failed to send notice reminder: " + e.getMessage()));
        }
    }
}

