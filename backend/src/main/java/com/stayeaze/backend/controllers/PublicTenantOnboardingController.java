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
            List<Room> rooms = roomRepository.findByPropertyIdNative(propertyId);
            List<Tenant> allTenants = tenantRepository.findAll();
            for (Room r : rooms) {
                List<Bed> rBeds = bedRepository.findByRoomId(r.getId());
                long totalBeds = rBeds != null ? rBeds.size() : 0;
                if (totalBeds == 0) {
                    String sharing = r.getSharingType() != null ? r.getSharingType().toUpperCase() : "SINGLE";
                    totalBeds = (sharing.contains("DOUBLE") || sharing.contains("2")) ? 2 :
                                (sharing.contains("TRIPLE") || sharing.contains("3")) ? 3 :
                                (sharing.contains("FOUR") || sharing.contains("QUAD") || sharing.contains("4")) ? 4 : 1;
                }

                long occupiedBeds = rBeds != null ? rBeds.stream().filter(b -> {
                    if (b.getStatus() != null && !"available".equalsIgnoreCase(b.getStatus())) {
                        return true;
                    }
                    return allTenants.stream().anyMatch(t -> {
                        String ts = t.getStatus();
                        boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts);
                        return !isCheckedOut &&
                                r.getRoomNumber() != null && r.getRoomNumber().equalsIgnoreCase(t.getRoomNumber()) &&
                                b.getBedNumber() != null && b.getBedNumber().equalsIgnoreCase(t.getBedNumber());
                    });
                }).count() : 0;

                long availableBeds = Math.max(0, totalBeds - occupiedBeds);

                Map<String, Object> map = new HashMap<>();
                map.put("id", r.getId());
                map.put("roomNumber", r.getRoomNumber());
                map.put("type", r.getType() != null ? r.getType() : r.getSharingType());
                map.put("sharingType", r.getSharingType());
                map.put("baseRent", r.getBaseRent() != null ? r.getBaseRent() : new BigDecimal("8000.00"));
                map.put("totalBeds", totalBeds);
                map.put("availableBeds", availableBeds);
                map.put("isFull", totalBeds > 0 && availableBeds == 0);
                result.add(map);
            }
        } catch (Exception ignored) {}
        return ResponseEntity.ok(result);
    }

    @GetMapping("/beds")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> getPublicBeds(@RequestParam(required = false) UUID roomId) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (roomId == null) {
            return ResponseEntity.ok(result);
        }

        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) {
            return ResponseEntity.ok(result);
        }

        List<Bed> beds = bedRepository.findByRoomId(roomId);
        if (beds == null || beds.isEmpty()) {
            beds = new ArrayList<>();
            String sharing = room.getSharingType() != null ? room.getSharingType().toUpperCase() : "SINGLE";
            int count = (sharing.contains("DOUBLE") || sharing.contains("2")) ? 2 :
                        (sharing.contains("TRIPLE") || sharing.contains("3")) ? 3 :
                        (sharing.contains("FOUR") || sharing.contains("QUAD") || sharing.contains("4")) ? 4 : 1;

            for (int i = 1; i <= count; i++) {
                String bNum = String.valueOf((char) ('A' + i - 1));
                Bed newBed = new Bed(room, bNum);
                newBed.setStatus("AVAILABLE");
                bedRepository.save(newBed);
                beds.add(newBed);
            }
        }

        List<Tenant> allTenants = tenantRepository.findAll();
        for (Bed b : beds) {
            boolean isOccupied = false;
            if (b.getStatus() != null && !"available".equalsIgnoreCase(b.getStatus())) {
                isOccupied = true;
            } else {
                String rNum = room.getRoomNumber();
                String bNum = b.getBedNumber();
                boolean tenantInBed = allTenants.stream().anyMatch(t -> {
                    String ts = t.getStatus();
                    boolean isCheckedOut = "CHECKED_OUT".equalsIgnoreCase(ts);
                    return !isCheckedOut &&
                            rNum != null && rNum.equalsIgnoreCase(t.getRoomNumber()) &&
                            bNum != null && bNum.equalsIgnoreCase(t.getBedNumber());
                });
                if (tenantInBed) {
                    isOccupied = true;
                }
            }

            // Exclude occupied beds completely from the public onboarding selection
            if (isOccupied) {
                continue;
            }

            Map<String, Object> map = new HashMap<>();
            map.put("id", b.getId());
            map.put("bedNumber", b.getBedNumber());
            map.put("status", "AVAILABLE");
            map.put("isOccupied", false);
            result.add(map);
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

        Map<String, Object> orderPayload = new HashMap<>();
        orderPayload.put("orderId", orderId);
        orderPayload.put("keyId", activeKeyId);
        orderPayload.put("amount", amountInPaise);
        orderPayload.put("amountFormatted", totalAmount);
        orderPayload.put("rentAmount", rent);
        orderPayload.put("depositAmount", deposit);
        orderPayload.put("currency", "INR");
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

            String cleanMobile = mobile.trim();
            String cleanEmail = email.trim().toLowerCase();

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
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Public Onboarding Error: " + e.getMessage()));
        }
    }
}
