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

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.services.CredentialService credentialService;

    private Organization getLoggedUserOrg() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetailsImpl userDetails) {
            if (userDetails.getOrgId() != null) {
                return organizationRepository.findById(userDetails.getOrgId())
                        .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
            }
        }
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(username).orElseGet(() ->
                userRepository.findByMobile(username).orElse(null));
        if (user != null && user.getOrganization() != null) {
            return user.getOrganization();
        }
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

        // 1. Uniqueness scoped to the active organization (active/pending residents)
        if (request.getMobile() != null && !request.getMobile().isBlank()) {
            boolean mobileExists = tenantRepository.findByOrganization(organization).stream()
                    .anyMatch(t -> !"CHECKED_OUT".equalsIgnoreCase(t.getStatus()) && !"ARCHIVED".equalsIgnoreCase(t.getStatus()) && request.getMobile().trim().equalsIgnoreCase(t.getMobile()));
            if (mobileExists) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number already registered to an active resident in this organization!"));
            }
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            boolean emailExists = tenantRepository.findByOrganization(organization).stream()
                    .anyMatch(t -> !"CHECKED_OUT".equalsIgnoreCase(t.getStatus()) && !"ARCHIVED".equalsIgnoreCase(t.getStatus()) && t.getEmail() != null && request.getEmail().trim().equalsIgnoreCase(t.getEmail()));
            if (emailExists) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Email address already registered to an active resident in this organization!"));
            }
        }

        if (request.getRoomNumber() != null && !request.getRoomNumber().isBlank() &&
            request.getBedNumber() != null && !request.getBedNumber().isBlank()) {

            // Bed occupied = any non-checked-out tenant in the same bed (ACTIVE, PENDING_CHECKIN, PENDING, RESERVED, etc.)
            boolean bedOccupied = tenantRepository.findByOrganization(organization).stream().anyMatch(t -> {
                String ts = t.getStatus();
                boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts) || "ARCHIVED".equalsIgnoreCase(ts);
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
        tenant.setStatus(request.getStatus() != null ? request.getStatus().toUpperCase() : "ACTIVE");

        Tenant saved = tenantRepository.save(tenant);

        // 2. Cross-Organization User Account Linking:
        // If a global user account exists with this email or mobile, re-activate and link it to this organization and tenant profile
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String tEmail = request.getEmail().trim().toLowerCase();
            userRepository.findByEmail(tEmail).ifPresent(user -> {
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
            });
        }

        // Auto-create initial Invoice & Payment for Onboarding (Rent + Security Deposit)
        try {
            java.math.BigDecimal rAmt = saved.getRent() != null ? saved.getRent() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal dAmt = saved.getDeposit() != null ? saved.getDeposit() : java.math.BigDecimal.ZERO;
            java.math.BigDecimal totalDue = rAmt.add(dAmt);

            if (totalDue.compareTo(java.math.BigDecimal.ZERO) > 0) {
                Invoice inv = new Invoice();
                inv.setTenant(saved);
                inv.setInvoiceNumber(invoiceSequenceService.nextRentalInvoiceNumber(saved));
                inv.setAmountDue(totalDue);
                inv.setIssueDate(java.time.LocalDate.now());
                inv.setDueDate(java.time.LocalDate.now().plusDays(7));

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
            checkIn.setCode("CI-" + (System.currentTimeMillis() % 100000000L));
            checkInRepository.save(checkIn);
        } catch(Exception e) {
            System.err.println("Failed to auto-create CheckIn: " + e.getMessage());
            e.printStackTrace();
        }

        // Auto-provision User Account & Credentials Dispatch for Tenant
        try {
            if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
                String tEmail = saved.getEmail().trim().toLowerCase();
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
                } else {
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

        for (int i = 0; i < items.size(); i++) {
            com.stayeaze.backend.payload.request.TenantBulkImportRequest item = items.get(i);
            java.util.Map<String, Object> rowResult = new java.util.HashMap<>();
            rowResult.put("index", i + 1);
            rowResult.put("name", item.getName() != null ? item.getName() : item.getFirstName() + " " + item.getLastName());
            rowResult.put("email", item.getEmail());
            rowResult.put("mobile", item.getMobile());

            try {
                // 1. Resolve Target Property
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

                // 2. Validate/Check duplicates in organization
                String cleanEmail = (item.getEmail() != null && !item.getEmail().isBlank()) ? item.getEmail().trim().toLowerCase() : null;
                String cleanMobile = (item.getMobile() != null && !item.getMobile().isBlank()) ? item.getMobile().replaceAll("[^0-9]", "") : null;

                if (cleanEmail != null && tenantRepository.existsByOrganizationAndEmail(organization, cleanEmail)) {
                    rowResult.put("status", "SKIPPED");
                    rowResult.put("message", "A tenant with email " + cleanEmail + " already exists in this organization.");
                    importResults.add(rowResult);
                    failCount++;
                    continue;
                }

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
                    checkIn.setCode("CI-" + (System.currentTimeMillis() % 100000000L));
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
            @RequestParam(defaultValue = "10") int pageSize) {
        Organization organization = getLoggedUserOrg();
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        boolean isSuperAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_SUPER_ADMIN"));

        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));

        User user = !isSuperAdmin && userDetails != null ? userRepository.findById(userDetails.getId()).orElse(null) : null;

        List<Tenant> tenants;
        if (isSuperAdmin) {
            tenants = tenantRepository.findAllSuperAdmin();
        } else if (organization != null) {
            tenants = tenantRepository.findByOrganizationIdNative(organization.getId());
        } else {
            tenants = Collections.emptyList();
        }

        if (user != null && user.getPropertyIds() != null && !user.getPropertyIds().isEmpty()) {
            List<Tenant> scoped = tenants.stream()
                    .filter(t -> t.getPropertyId() != null && user.getPropertyIds().contains(t.getPropertyId()))
                    .collect(Collectors.toList());
            if (!scoped.isEmpty()) {
                tenants = scoped;
            }
        }

        List<MinimalTenantDTO> dtos = tenants.stream().map(MinimalTenantDTO::fromEntity).collect(Collectors.toList());
        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(dtos, page, pageSize));
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

    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getTenantStats(@RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();

        long total;
        long active;
        long checkedIn;
        long pendingOnboarding;
        long noticePeriod;

        if (propertyId != null) {
            total = tenantRepository.countByPropertyId(propertyId);
            active = tenantRepository.countByPropertyIdAndStatus(propertyId, "ACTIVE");
            checkedIn = tenantRepository.countByPropertyIdAndStatus(propertyId, "CHECKED_IN");
            pendingOnboarding = tenantRepository.countByPropertyIdAndStatus(propertyId, "PENDING")
                    + tenantRepository.countByPropertyIdAndStatus(propertyId, "ONBOARDING");
            noticePeriod = tenantRepository.countByPropertyIdAndStatus(propertyId, "NOTICE_PERIOD");
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

        String reqMobile = request.getMobile();
        if (reqMobile != null && !reqMobile.isBlank() && organization != null) {
            boolean mobileTakenByOther = tenantRepository.findByOrganization(organization).stream()
                .anyMatch(t -> !t.getId().equals(id) && !"CHECKED_OUT".equalsIgnoreCase(t.getStatus()) && !"ARCHIVED".equalsIgnoreCase(t.getStatus()) && reqMobile.trim().equalsIgnoreCase(t.getMobile()));
            if (mobileTakenByOther) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number already registered to another active resident in this organization!"));
            }
        }

        String reqEmail = request.getEmail();
        if (reqEmail != null && !reqEmail.isBlank() && organization != null) {
            boolean emailTakenByOther = tenantRepository.findByOrganization(organization).stream()
                .anyMatch(t -> !t.getId().equals(id) && !"CHECKED_OUT".equalsIgnoreCase(t.getStatus()) && !"ARCHIVED".equalsIgnoreCase(t.getStatus()) && t.getEmail() != null && reqEmail.trim().equalsIgnoreCase(t.getEmail()));
            if (emailTakenByOther) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Email address already registered to another active resident in this organization!"));
            }
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
        occupancySyncService.syncStatsAndEvictCaches(null);

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

        tenant.setStatus("ARCHIVED");
        tenantRepository.save(tenant);
        auditLogService.logCurrent("Archived tenant record: " + (tenant.getFirstName() != null ? tenant.getFirstName() : "") + " " + (tenant.getLastName() != null ? tenant.getLastName() : ""), null);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Tenant archived successfully."));
    }

    @DeleteMapping("/{id}/permanent")
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> permanentlyDeleteTenant(@PathVariable UUID id) {
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

        // Cascade delete child records with exact table and column matching
        try {
            // 1. Delete payments linked to tenant's invoices
            jdbcTemplate.update("DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = ?)", id);
            
            // 2. Delete invoice items linked to tenant's invoices
            jdbcTemplate.update("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = ?)", id);
            
            // 3. Delete invoices
            jdbcTemplate.update("DELETE FROM invoices WHERE tenant_id = ?", id);
            
            // 4. Delete tenant documents
            jdbcTemplate.update("DELETE FROM tenant_documents WHERE tenant_id = ?", id);
            
            // 5. Delete agreements
            jdbcTemplate.update("DELETE FROM agreements WHERE tenant_id = ?", id);
            
            // 6. Delete parcels, visitors, and penalties/discounts
            jdbcTemplate.update("DELETE FROM parcels WHERE tenant_id = ?", id);
            jdbcTemplate.update("DELETE FROM visitors WHERE tenant_id = ?", id);
            jdbcTemplate.update("DELETE FROM penalties_discounts WHERE tenant_id = ?", id);
            
            // 7. Delete complaint messages and complaints
            jdbcTemplate.update("DELETE FROM complaint_chat_messages WHERE complaint_id IN (SELECT id FROM complaints WHERE tenant_id = ?)", id);
            jdbcTemplate.update("DELETE FROM complaints WHERE tenant_id = ?", id);
            
            // 8. Delete bookings
            jdbcTemplate.update("DELETE FROM bookings WHERE tenant_id = ?", id);

            // 9. Delete user account and tokens if registered
            if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                userRepository.findByEmail(tenant.getEmail().trim().toLowerCase()).ifPresent(user -> {
                    jdbcTemplate.update("DELETE FROM refresh_tokens WHERE user_id = ?", user.getId());
                    jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", user.getId());
                    userRepository.delete(user);
                });
            }
        } catch (Exception e) {
            System.err.println("Warning during cascading tenant delete: " + e.getMessage());
        }

        tenantRepository.delete(tenant);
        auditLogService.logCurrent("Permanently deleted tenant record and all associated history for: " + (tenant.getFirstName() != null ? tenant.getFirstName() : "") + " " + (tenant.getLastName() != null ? tenant.getLastName() : ""), null);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Tenant and all associated records permanently deleted."));
    }

    @PutMapping("/{id}/unarchive")
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('ADMIN')")
    public ResponseEntity<?> unarchiveTenant(@PathVariable UUID id) {
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

        tenant.setStatus("ACTIVE");
        Tenant updated = tenantRepository.save(tenant);
        auditLogService.logCurrent("Unarchived tenant record: " + updated.getName(), null);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Tenant successfully unarchived."));
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
        Tenant tenant = tenantRepository.findByIdAndOrganization(id, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant record not found."));
        }

        String status = req.get("status");
        if (status == null || (!"VERIFIED".equalsIgnoreCase(status) && !"REJECTED".equalsIgnoreCase(status) && !"PENDING".equalsIgnoreCase(status))) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid status. Must be VERIFIED, REJECTED, or PENDING."));
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
        Tenant saved = tenantRepository.save(tenant);
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
}
