package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.services.AuditLogService;
import com.stayeaze.backend.services.EmailService;
import com.stayeaze.backend.services.OccupancySyncService;
import com.stayeaze.backend.services.SmsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/public/tenants")
public class PublicTenantOnboardingController {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EmailService emailService;

    @Autowired
    private SmsService smsService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private com.stayeaze.backend.services.CredentialService credentialService;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private OccupancySyncService occupancySyncService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private com.stayeaze.backend.services.AccountUniquenessService accountUniquenessService;

    @Autowired
    private SystemConfigRepository systemConfigRepository;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @GetMapping("/properties")
    public ResponseEntity<?> getPublicProperties() {
        List<Property> properties = propertyRepository.findAllSuperAdmin();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Property p : properties) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("name", p.getName());
            map.put("city", p.getCity());
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/properties/{id}")
    public ResponseEntity<?> getPublicPropertyById(@PathVariable UUID id) {
        Optional<Property> opt = propertyRepository.findByIdSuperAdmin(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Property not found."));
        }
        Property p = opt.get();
        Map<String, Object> map = new HashMap<>();
        map.put("id", p.getId());
        map.put("name", p.getName());
        map.put("city", p.getCity());

        BigDecimal deposit = null;

        // 1. Look up Organization Billing Profile where the Admin stored Default Security Deposit
        try {
            UUID orgId = (p.getOrganization() != null) ? p.getOrganization().getId() : p.getOrgId();
            if (orgId != null && organizationBillingProfileRepository != null) {
                Optional<OrganizationBillingProfile> bpOpt = organizationBillingProfileRepository.findByOrgIdNative(orgId);
                if (bpOpt.isPresent() && bpOpt.get().getDefaultSecurityDeposit() != null && bpOpt.get().getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                    deposit = bpOpt.get().getDefaultSecurityDeposit();
                }
            }
        } catch (Exception ignored) {}

        // 2. If not found by specific orgId, check any active organization billing profile saved by Admin
        if (deposit == null || deposit.compareTo(BigDecimal.ZERO) == 0) {
            try {
                if (organizationBillingProfileRepository != null) {
                    Optional<OrganizationBillingProfile> firstBp = organizationBillingProfileRepository.findFirstNative();
                    if (firstBp.isPresent() && firstBp.get().getDefaultSecurityDeposit() != null && firstBp.get().getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                        deposit = firstBp.get().getDefaultSecurityDeposit();
                    }
                }
            } catch (Exception ignored) {}
        }

        // 3. If property has explicit security deposit override and no org deposit
        if (deposit == null || deposit.compareTo(BigDecimal.ZERO) == 0) {
            deposit = p.getSecurityDeposit();
        }

        // 4. Fallback to SystemConfig
        if (deposit == null || deposit.compareTo(BigDecimal.ZERO) == 0) {
            try {
                if (systemConfigRepository != null) {
                    SystemConfig sys = systemConfigRepository.findFirstNative().orElse(null);
                    if (sys != null && sys.getDefaultSecurityDeposit() != null && sys.getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                        deposit = sys.getDefaultSecurityDeposit();
                    }
                }
            } catch (Exception ignored) {}
        }

        if (deposit == null) {
            deposit = BigDecimal.ZERO;
        }
        map.put("securityDeposit", deposit);
        return ResponseEntity.ok(map);
    }

    @GetMapping("/rooms")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getPublicRooms(@RequestParam(required = false) UUID propertyId) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (propertyId == null) {
            return ResponseEntity.ok(result);
        }
        try {
            List<Object[]> rows = roomRepository.findPublicRoomsWithHierarchyNative(propertyId);
            if (rows != null) {
                for (Object[] row : rows) {
                    if (row == null || row[0] == null) continue;
                    String roomIdStr = (String) row[0];
                    UUID roomId = UUID.fromString(roomIdStr);
                    String roomNumber = (String) row[1];
                    String sharingType = (String) row[2];
                    BigDecimal baseRent = row[3] != null ? (BigDecimal) row[3] : new BigDecimal("8000.00");
                    String status = (String) row[4];
                    String floorId = (String) row[5];
                    String floorName = (String) row[6];
                    Integer floorNumber = row[7] != null ? ((Number) row[7]).intValue() : null;
                    String buildingId = (String) row[8];
                    String buildingName = (String) row[9];
                    String propId = (String) row[10];
                    String propName = (String) row[11];

                    String sharing = sharingType != null ? sharingType.toUpperCase() : "SINGLE";
                    int totalBeds = (sharing.contains("DOUBLE") || sharing.contains("2")) ? 2 :
                                (sharing.contains("TRIPLE") || sharing.contains("3")) ? 3 :
                                (sharing.contains("FOUR") || sharing.contains("QUAD") || sharing.contains("4")) ? 4 : 1;

                    List<Object[]> bedRows = bedRepository.findPublicBedsWithHierarchyNative(roomId);
                    int actualBedsCount = bedRows != null ? bedRows.size() : 0;
                    if (actualBedsCount > 0) {
                        totalBeds = actualBedsCount;
                    }

                    int occupiedCount = 0;
                    if (bedRows != null) {
                        for (Object[] br : bedRows) {
                            String bStatus = br[2] != null ? br[2].toString() : "available";
                            if (!"available".equalsIgnoreCase(bStatus)) {
                                occupiedCount++;
                            }
                        }
                    }

                    int availableBeds = Math.max(0, totalBeds - occupiedCount);

                    Map<String, Object> map = new HashMap<>();
                    map.put("id", roomId);
                    map.put("roomNumber", roomNumber);
                    map.put("type", sharingType != null ? sharingType.toLowerCase() : "single");
                    map.put("sharingType", sharingType);
                    map.put("baseRent", baseRent);
                    map.put("totalBeds", totalBeds);
                    map.put("availableBeds", availableBeds);
                    map.put("isFull", totalBeds > 0 && availableBeds == 0);
                    map.put("propertyId", propId);
                    map.put("propertyName", propName);
                    map.put("buildingId", buildingId);
                    map.put("buildingName", buildingName);
                    map.put("floorId", floorId);
                    map.put("floorName", floorName != null ? floorName : (floorNumber != null ? "Floor " + floorNumber : ""));
                    map.put("floorNumber", floorNumber);
                    result.add(map);
                }
            }
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(PublicTenantOnboardingController.class).error("Error loading public rooms for property " + propertyId, e);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping({"/beds", "/rooms/{roomId}/beds"})
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getPublicBeds(
            @PathVariable(required = false) UUID roomId,
            @RequestParam(name = "roomId", required = false) UUID roomIdParam) {
        UUID effectiveRoomId = roomId != null ? roomId : roomIdParam;
        List<Map<String, Object>> result = new ArrayList<>();
        if (effectiveRoomId == null) {
            return ResponseEntity.ok(result);
        }

        try {
            List<Object[]> rows = bedRepository.findPublicBedsWithHierarchyNative(effectiveRoomId);
            if (rows != null) {
                for (Object[] br : rows) {
                    if (br == null || br[0] == null) continue;
                    String bStatus = br[2] != null ? br[2].toString() : "available";
                    if (!"available".equalsIgnoreCase(bStatus)) continue;

                    Map<String, Object> map = new HashMap<>();
                    map.put("id", UUID.fromString((String) br[0]));
                    map.put("bedNumber", br[1]);
                    map.put("status", "AVAILABLE");
                    map.put("isOccupied", false);
                    map.put("roomId", UUID.fromString((String) br[3]));
                    map.put("roomNumber", br[4]);
                    map.put("buildingName", br[5]);
                    map.put("floorName", br[6]);
                    map.put("propertyName", br[7]);
                    result.add(map);
                }
            }
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(PublicTenantOnboardingController.class).error("Error loading public beds for room " + effectiveRoomId, e);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createPublicOnboardingOrder(@RequestBody Map<String, Object> req) {
        UUID propertyId = null;
        if (req.get("propertyId") != null && !req.get("propertyId").toString().isBlank()) {
            try { propertyId = UUID.fromString(req.get("propertyId").toString()); } catch (Exception ignored) {}
        }

        BigDecimal rent = BigDecimal.ZERO;
        BigDecimal deposit = BigDecimal.ZERO;
        if (req.get("rent") != null) {
            try { rent = new BigDecimal(req.get("rent").toString()); } catch (Exception ignored) {}
        }
        if (req.get("deposit") != null) {
            try { deposit = new BigDecimal(req.get("deposit").toString()); } catch (Exception ignored) {}
        }
        BigDecimal totalAmount = rent.add(deposit);

        if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Total initial onboarding amount (Rent + Deposit) must be greater than zero."));
        }

        Property property = null;
        if (propertyId != null) {
            property = propertyRepository.findByIdSuperAdmin(propertyId).orElse(null);
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
            Organization org = (property != null) ? property.getOrganization() : organizationRepository.findAll().stream().findFirst().orElse(null);
            if (org != null) {
                Optional<OrganizationBillingProfile> bpOpt = organizationBillingProfileRepository.findByOrganization(org);
                if (bpOpt.isPresent() && bpOpt.get().getRazorpayKeyId() != null && !bpOpt.get().getRazorpayKeyId().isBlank()) {
                    activeKeyId = bpOpt.get().getRazorpayKeyId().trim();
                    if (bpOpt.get().getRazorpayKeySecret() != null && !bpOpt.get().getRazorpayKeySecret().isBlank()) {
                        activeKeySecret = bpOpt.get().getRazorpayKeySecret().trim();
                    }
                }
            }
        }

        // Fallback default test key if none configured in DB
        if (activeKeyId == null || activeKeyId.isBlank()) {
            activeKeyId = "rzp_test_StayeazeMockKey123";
            activeKeySecret = "mockSecret123";
        }

        long amountInPaise = totalAmount.multiply(new BigDecimal(100)).longValue();
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
                System.err.println("Razorpay client error during public onboarding order creation: " + e.getMessage());
            }
        }

        String resolvedPropName = (property != null && property.getName() != null && !property.getName().isBlank())
                ? property.getName()
                : (property != null && property.getOrganization() != null ? property.getOrganization().getName() : "StayEaze Residency");

        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("orderId", orderId);
        orderPayload.put("keyId", activeKeyId);
        orderPayload.put("amount", amountInPaise);
        orderPayload.put("amountFormatted", totalAmount);
        orderPayload.put("rentAmount", rent);
        orderPayload.put("depositAmount", deposit);
        orderPayload.put("currency", "INR");
        orderPayload.put("propertyName", resolvedPropName);
        orderPayload.put("businessName", resolvedPropName);
        orderPayload.put("tenantName", req.get("tenantName") != null ? req.get("tenantName").toString() : "New Tenant");
        orderPayload.put("tenantEmail", req.get("tenantEmail") != null ? req.get("tenantEmail").toString() : "tenant@stayeaze.com");
        orderPayload.put("tenantPhone", req.get("tenantPhone") != null ? req.get("tenantPhone").toString() : "9876543210");

        return ResponseEntity.ok(orderPayload);
    }

    @PostMapping("/onboard")
    public ResponseEntity<?> publicOnboardTenant(@RequestBody Map<String, Object> req) {
        try {
            String firstName = (String) req.get("firstName");
            String lastName = (String) req.get("lastName");
            String email = (String) req.get("email");
            String mobile = (String) req.get("mobile");
            String gender = (String) req.getOrDefault("gender", "MALE");
            String occupation = (String) req.getOrDefault("occupation", "STUDENT");
            String roomNumber = (String) req.get("roomNumber");
            String bedNumber = (String) req.get("bedNumber");
            String propertyIdStr = (String) req.get("propertyId");
            String paymentMethod = (String) req.getOrDefault("paymentMethod", "RAZORPAY");
            String razorpayPaymentId = (String) req.get("razorpayPaymentId");
            String razorpayOrderId = (String) req.get("razorpayOrderId");
            String razorpaySignature = (String) req.get("razorpaySignature");

            BigDecimal rent = BigDecimal.valueOf(8000);
            BigDecimal deposit = BigDecimal.valueOf(10000);
            if (req.get("rent") != null) {
                try { rent = new BigDecimal(req.get("rent").toString()); } catch (Exception ignored) {}
            }
            if (req.get("deposit") != null) {
                try { deposit = new BigDecimal(req.get("deposit").toString()); } catch (Exception ignored) {}
            }

            if (firstName == null || email == null || mobile == null) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: First name, email, and mobile are required."));
            }

            Organization org = null;
            Property property = null;
            UUID propUuid = null;

            if (propertyIdStr != null && !propertyIdStr.isBlank()) {
                try {
                    propUuid = UUID.fromString(propertyIdStr);
                    property = propertyRepository.findByIdSuperAdmin(propUuid).orElse(null);
                    if (property != null) {
                        org = property.getOrganization();
                    }
                } catch (Exception ignored) {}
            }

            if (org == null) {
                org = organizationRepository.findAll().stream().findFirst().orElse(null);
            }

            if (org == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(new MessageResponse("Error: System organization is not configured."));
            }

            boolean isOnlinePaid = "RAZORPAY".equalsIgnoreCase(paymentMethod) && razorpayPaymentId != null && !razorpayPaymentId.isBlank();

            String cleanMobile = accountUniquenessService.normalizeMobile(mobile);
            String cleanEmail = accountUniquenessService.normalizeEmail(email);

            // Universal Uniqueness Validation
            try {
                accountUniquenessService.validateTenantEmailAndMobile(org, cleanEmail, cleanMobile, null, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
            }

            Tenant tenant = tenantRepository.findFirstByMobile(cleanMobile)
                    .or(() -> tenantRepository.findFirstByEmail(cleanEmail))
                    .orElseGet(Tenant::new);

            tenant.setOrganization(org);
            tenant.setFirstName(firstName);
            tenant.setLastName(lastName != null ? lastName : "");
            tenant.setEmail(cleanEmail);
            tenant.setMobile(cleanMobile);
            tenant.setGender(gender);
            tenant.setOccupation(occupation);
            tenant.setRoomNumber(roomNumber);
            tenant.setBedNumber(bedNumber);
            tenant.setPropertyId(propUuid);
            tenant.setRent(rent);
            tenant.setDeposit(deposit);
            tenant.setLeaseStart(LocalDate.now().toString());
            tenant.setLeaseEnd(LocalDate.now().plusMonths(11).toString());

            // When onboarding payment is done/submitted, tenant is READY_FOR_CHECKIN awaiting desk check-in
            tenant.setStatus("READY_FOR_CHECKIN");
            if (tenant.getKycStatus() == null) {
                tenant.setKycStatus("PENDING");
            }

            Tenant saved = tenantRepository.save(tenant);

            // Generate initial Onboarding Invoice (Rent + Deposit)
            BigDecimal totalInitialAmount = rent.add(deposit);
            Invoice initialInvoice = new Invoice();
            initialInvoice.setTenant(saved);
            initialInvoice.setInvoiceNumber(invoiceSequenceService.nextRentalInvoiceNumber(saved));
            initialInvoice.setIssueDate(LocalDate.now());
            initialInvoice.setDueDate(LocalDate.now().plusDays(7));
            initialInvoice.setAmountDue(totalInitialAmount);
            initialInvoice.setAmountPaid(isOnlinePaid ? totalInitialAmount : BigDecimal.ZERO);
            initialInvoice.setStatus(isOnlinePaid ? "PAID" : "UNPAID");
            initialInvoice.setPaymentMethod(isOnlinePaid ? "RAZORPAY" : "CASH");
            if (isOnlinePaid) {
                initialInvoice.setRazorpayPaymentId(razorpayPaymentId);
                initialInvoice.setRazorpayOrderId(razorpayOrderId);
                initialInvoice.setRazorpaySignature(razorpaySignature);
                initialInvoice.setPaymentReference(razorpayPaymentId);
            }
            invoiceRepository.save(initialInvoice);

            // Auto-provision User Account & Credentials Dispatch for Tenant
            String tEmail = saved.getEmail().trim().toLowerCase();
            User user = userRepository.findByEmail(tEmail)
                    .or(() -> userRepository.findFirstByMobile(cleanMobile))
                    .orElse(null);

            String tempPassword = credentialService.generateSecurePassword();
            if (user == null) {
                user = new User(org, tEmail, passwordEncoder.encode(tempPassword), cleanMobile);
                user.setFirstName(saved.getFirstName());
                user.setMustChangePassword(true);
                user.setTenantId(saved.getId());

                Role tenantRole = roleRepository.findByName("ROLE_TENANT")
                        .orElseGet(() -> roleRepository.save(new Role("ROLE_TENANT", "[]")));
                Set<Role> roles = new HashSet<>();
                roles.add(tenantRole);
                user.setRoles(roles);

                if (propUuid != null) {
                    List<UUID> pIds = new ArrayList<>();
                    pIds.add(propUuid);
                    user.setPropertyIds(pIds);
                }

                userRepository.save(user);
            } else {
                user.setTenantId(saved.getId());
                user.setEmail(tEmail);
                user.setMobile(cleanMobile);
                if (user.getOrganization() == null) {
                    user.setOrganization(org);
                }
                if (propUuid != null) {
                    List<UUID> pIds = user.getPropertyIds() != null ? new ArrayList<>(user.getPropertyIds()) : new ArrayList<>();
                    if (!pIds.contains(propUuid)) {
                        pIds.add(propUuid);
                        user.setPropertyIds(pIds);
                    }
                }
                userRepository.save(user);
            }

            String pName = (property != null) ? property.getName() : "StayEaze PG/Hostel";

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

            occupancySyncService.syncStatsAndEvictCaches(null);
            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("firstName", saved.getFirstName());
            response.put("lastName", saved.getLastName());
            response.put("email", saved.getEmail());
            response.put("mobile", saved.getMobile());
            response.put("roomNumber", saved.getRoomNumber());
            response.put("bedNumber", saved.getBedNumber());
            response.put("status", saved.getStatus());
            response.put("tempPassword", tempPassword);
            response.put("message", "Resident successfully registered.");
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Public Onboarding Error: " + e.getMessage()));
        }
    }
}
