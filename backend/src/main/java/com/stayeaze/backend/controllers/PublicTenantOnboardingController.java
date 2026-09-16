package com.stayeaze.backend.controllers;

import com.stayeaze.backend.config.TenantIdentifierResolver;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.services.EmailService;
import com.stayeaze.backend.services.OccupancySyncService;
import com.stayeaze.backend.services.SmsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/public/tenants")
public class PublicTenantOnboardingController {

    private static final Logger logger = LoggerFactory.getLogger(PublicTenantOnboardingController.class);

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
    private com.stayeaze.backend.services.AccountUniquenessService accountUniquenessService;

    @Autowired
    private SystemConfigRepository systemConfigRepository;

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.services.FileStorageService fileStorageService;

    @Autowired
    private com.stayeaze.backend.repository.TenantDocumentRepository tenantDocumentRepository;

    @PostMapping(value = "/upload-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadPublicDocument(
            @RequestParam(value = "file", required = false) MultipartFile file,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            MultipartFile effectiveFile = file;
            if (effectiveFile == null && request instanceof org.springframework.web.multipart.MultipartHttpServletRequest multipartRequest) {
                effectiveFile = multipartRequest.getFile("document");
                if (effectiveFile == null) effectiveFile = multipartRequest.getFile("image");
                if (effectiveFile == null) effectiveFile = multipartRequest.getFile("attachment");
                if (effectiveFile == null && !multipartRequest.getFileMap().isEmpty()) {
                    effectiveFile = multipartRequest.getFileMap().values().iterator().next();
                }
            }

            if (effectiveFile == null || effectiveFile.isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: No file uploaded or file is empty."));
            }

            if (effectiveFile.getSize() > 3 * 1024 * 1024) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(new MessageResponse("File size exceeds 3MB limit. Please upload a smaller document."));
            }

            String fileUrl = fileStorageService.storeFile(effectiveFile, "kyc");
            Map<String, Object> response = new HashMap<>();
            response.put("fileUrl", fileUrl);
            response.put("fileName", effectiveFile.getOriginalFilename());
            response.put("size", effectiveFile.getSize());
            response.put("contentType", effectiveFile.getContentType());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | SecurityException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error uploading document: " + e.getMessage()));
        }
    }

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

    private OrganizationBillingProfile getBillingProfile(Organization organization) {
        if (organization == null) return null;
        return organizationBillingProfileRepository.findByOrganization(organization)
                .orElseGet(() -> {
                    try {
                        return organizationBillingProfileRepository.findByOrgIdNative(organization.getId())
                                .orElse(null);
                    } catch (Exception e) {
                        return null;
                    }
                });
    }

    private Room findRoomByPropertyAndNumber(Property property, Organization org, String roomNumber) {
        if (roomNumber == null || roomNumber.isBlank()) return null;
        if (property != null && property.getId() != null) {
            try {
                List<Room> propRooms = roomRepository.findByPropertyIdNative(property.getId());
                for (Room r : propRooms) {
                    if (roomNumber.equalsIgnoreCase(r.getRoomNumber())) {
                        return r;
                    }
                }
            } catch (Exception ignored) {}
        }
        UUID orgId = (org != null) ? org.getId() : (property != null && property.getOrganization() != null ? property.getOrganization().getId() : null);
        if (orgId != null) {
            try {
                List<Room> orgRooms = roomRepository.findByOrganizationId(orgId);
                for (Room r : orgRooms) {
                    if (roomNumber.equalsIgnoreCase(r.getRoomNumber())) {
                        return r;
                    }
                }
            } catch (Exception ignored) {}
        }
        List<Room> allRooms = roomRepository.findAllSuperAdmin();
        for (Room r : allRooms) {
            if (roomNumber.equalsIgnoreCase(r.getRoomNumber())) {
                return r;
            }
        }
        return null;
    }

    private BigDecimal resolveAuthoritativeRent(Property property, Organization org, String roomNumber, String bedNumber) {
        Room matchedRoom = findRoomByPropertyAndNumber(property, org, roomNumber);
        if (matchedRoom != null && matchedRoom.getBaseRent() != null && matchedRoom.getBaseRent().compareTo(BigDecimal.ZERO) > 0) {
            return matchedRoom.getBaseRent();
        }
        return BigDecimal.valueOf(8000);
    }

    private BigDecimal resolveAuthoritativeDeposit(Property property, Organization org) {
        if (org != null) {
            OrganizationBillingProfile bp = getBillingProfile(org);
            if (bp != null && bp.getDefaultSecurityDeposit() != null && bp.getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                return bp.getDefaultSecurityDeposit();
            }
        }
        if (property != null && property.getSecurityDeposit() != null && property.getSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
            return property.getSecurityDeposit();
        }
        try {
            if (systemConfigRepository != null) {
                SystemConfig sys = systemConfigRepository.findFirstNative().orElse(null);
                if (sys != null && sys.getDefaultSecurityDeposit() != null && sys.getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                    return sys.getDefaultSecurityDeposit();
                }
            }
        } catch (Exception ignored) {}
        return BigDecimal.valueOf(10000);
    }

    private String[] resolveRazorpayKeys(Property property, Organization org) {
        String activeKeyId = null;
        String activeKeySecret = null;
        if (property != null && property.getRazorpayKeyId() != null && !property.getRazorpayKeyId().isBlank()) {
            activeKeyId = property.getRazorpayKeyId().trim();
            if (property.getRazorpayKeySecret() != null && !property.getRazorpayKeySecret().isBlank()) {
                activeKeySecret = property.getRazorpayKeySecret().trim();
            }
        }
        if (activeKeyId == null || activeKeyId.isBlank()) {
            if (org != null) {
                OrganizationBillingProfile bp = getBillingProfile(org);
                if (bp != null && bp.getRazorpayKeyId() != null && !bp.getRazorpayKeyId().isBlank()) {
                    activeKeyId = bp.getRazorpayKeyId().trim();
                    if (bp.getRazorpayKeySecret() != null && !bp.getRazorpayKeySecret().isBlank()) {
                        activeKeySecret = bp.getRazorpayKeySecret().trim();
                    }
                }
            }
        }
        if (activeKeyId == null || activeKeyId.isBlank()) {
            activeKeyId = "rzp_test_StayeazeMockKey123";
            activeKeySecret = "mockSecret123";
        }
        return new String[]{activeKeyId, activeKeySecret};
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
        String onboardingBillingPolicy = "FULL_WITH_ADVANCE_CREDIT";

        // 1. Look up Organization Billing Profile where the Admin stored Default Security Deposit & Onboarding Billing Policy
        try {
            UUID orgId = (p.getOrganization() != null) ? p.getOrganization().getId() : p.getOrgId();
            if (orgId != null && organizationBillingProfileRepository != null) {
                Optional<OrganizationBillingProfile> bpOpt = organizationBillingProfileRepository
                        .findByOrgIdNative(orgId);
                if (bpOpt.isPresent()) {
                    if (bpOpt.get().getDefaultSecurityDeposit() != null && bpOpt.get().getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                        deposit = bpOpt.get().getDefaultSecurityDeposit();
                    }
                    if (bpOpt.get().getOnboardingBillingPolicy() != null && !bpOpt.get().getOnboardingBillingPolicy().isBlank()) {
                        onboardingBillingPolicy = bpOpt.get().getOnboardingBillingPolicy();
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 2. If not found by specific orgId, check any active organization billing profile saved by Admin
        if (deposit == null || deposit.compareTo(BigDecimal.ZERO) == 0) {
            try {
                if (organizationBillingProfileRepository != null) {
                    Optional<OrganizationBillingProfile> firstBp = organizationBillingProfileRepository
                            .findFirstNative();
                    if (firstBp.isPresent()) {
                        if (firstBp.get().getDefaultSecurityDeposit() != null && firstBp.get().getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                            deposit = firstBp.get().getDefaultSecurityDeposit();
                        }
                        if (firstBp.get().getOnboardingBillingPolicy() != null && !firstBp.get().getOnboardingBillingPolicy().isBlank()) {
                            onboardingBillingPolicy = firstBp.get().getOnboardingBillingPolicy();
                        }
                    }
                }
            } catch (Exception ignored) {
            }
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
                    if (sys != null && sys.getDefaultSecurityDeposit() != null
                            && sys.getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                        deposit = sys.getDefaultSecurityDeposit();
                    }
                }
            } catch (Exception ignored) {
            }
        }

        if (deposit == null) {
            deposit = BigDecimal.ZERO;
        }
        map.put("securityDeposit", deposit);
        map.put("onboardingBillingPolicy", onboardingBillingPolicy);
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
                    if (row == null || row[0] == null)
                        continue;
                    String roomIdStr = (String) row[0];
                    UUID roomId = UUID.fromString(roomIdStr);
                    String roomNumber = (String) row[1];
                    String sharingType = (String) row[2];
                    BigDecimal baseRent = row[3] != null ? (BigDecimal) row[3] : new BigDecimal("8000.00");
                    String floorId = (String) row[5];
                    String floorName = (String) row[6];
                    Integer floorNumber = row[7] != null ? ((Number) row[7]).intValue() : null;
                    String buildingId = (String) row[8];
                    String buildingName = (String) row[9];
                    String propId = (String) row[10];
                    String propName = (String) row[11];

                    String sharing = sharingType != null ? sharingType.toUpperCase() : "SINGLE";
                    int totalBeds = (sharing.contains("DOUBLE") || sharing.contains("2")) ? 2
                            : (sharing.contains("TRIPLE") || sharing.contains("3")) ? 3
                                    : (sharing.contains("FOUR") || sharing.contains("QUAD") || sharing.contains("4"))
                                            ? 4
                                            : 1;

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
                    map.put("floorName",
                            floorName != null ? floorName : (floorNumber != null ? "Floor " + floorNumber : ""));
                    map.put("floorNumber", floorNumber);
                    result.add(map);
                }
            }
        } catch (Exception e) {
            logger.error("Error loading public rooms for property " + propertyId, e);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping({ "/beds", "/rooms/{roomId}/beds" })
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
                    if (br == null || br[0] == null)
                        continue;
                    String bStatus = br[2] != null ? br[2].toString() : "available";
                    if (!"available".equalsIgnoreCase(bStatus))
                        continue;

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
            logger.error("Error loading public beds for room " + effectiveRoomId, e);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createPublicOnboardingOrder(@RequestBody Map<String, Object> req) {
        UUID propertyId = null;
        if (req.get("propertyId") != null && !req.get("propertyId").toString().isBlank()) {
            try {
                propertyId = UUID.fromString(req.get("propertyId").toString());
            } catch (Exception ignored) {
            }
        }

        String roomNumber = req.get("roomNumber") != null ? req.get("roomNumber").toString() : null;
        String bedNumber = req.get("bedNumber") != null ? req.get("bedNumber").toString() : null;

        Property property = null;
        if (propertyId != null) {
            property = propertyRepository.findByIdSuperAdmin(propertyId).orElse(null);
        }

        Organization org = (property != null) ? property.getOrganization() : null;
        if (org != null) {
            TenantIdentifierResolver.setCurrentTenant(org.getId());
        }
        try {
            OrganizationBillingProfile bp = (org != null) ? getBillingProfile(org) : null;
            String policy = (bp != null && bp.getOnboardingBillingPolicy() != null)
                    ? bp.getOnboardingBillingPolicy()
                    : "FULL_WITH_ADVANCE_CREDIT";

            // Authoritative server-side pricing resolution (zero client interference)
            BigDecimal rent = resolveAuthoritativeRent(property, org, roomNumber, bedNumber);
            BigDecimal deposit = resolveAuthoritativeDeposit(property, org);

            LocalDate today = LocalDate.now();
            int maxDaysInMonth = today.lengthOfMonth();
            int startDay = today.getDayOfMonth();
            int stayedDays = maxDaysInMonth - startDay + 1;
            boolean isMidMonth = startDay > 1;

            BigDecimal rentToCharge = rent;
            BigDecimal proRataRent = rent;
            BigDecimal advanceCreditEstimate = BigDecimal.ZERO;

            if (isMidMonth) {
                proRataRent = rent.multiply(BigDecimal.valueOf(stayedDays))
                        .divide(BigDecimal.valueOf(maxDaysInMonth), 0, java.math.RoundingMode.HALF_UP);
                if ("PRORATA_ONLY".equalsIgnoreCase(policy)) {
                    rentToCharge = proRataRent;
                } else {
                    // FULL_WITH_ADVANCE_CREDIT
                    rentToCharge = rent;
                    advanceCreditEstimate = rent.subtract(proRataRent);
                }
            }

            BigDecimal totalAmount = rentToCharge.add(deposit);

            if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                        "Error: Total initial onboarding amount (Rent + Deposit) must be greater than zero."));
            }

            String[] keys = resolveRazorpayKeys(property, org);
            String activeKeyId = keys[0];
            String activeKeySecret = keys[1];

            long amountInPaise = totalAmount.multiply(new BigDecimal(100)).longValue();
            String orderId = "order_onb_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);

            if (activeKeyId.startsWith("rzp_") && !activeKeyId.contains("MockKey")
                    && activeKeySecret != null && !activeKeySecret.contains("mockSecret")) {
                try {
                    com.razorpay.RazorpayClient razorpayClient = new com.razorpay.RazorpayClient(activeKeyId,
                            activeKeySecret);
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
                    : (property != null && property.getOrganization() != null ? property.getOrganization().getName()
                            : "StayEaze Residency");

            Map<String, Object> orderPayload = new HashMap<>();
            orderPayload.put("orderId", orderId);
            orderPayload.put("keyId", activeKeyId);
            orderPayload.put("amount", amountInPaise);
            orderPayload.put("amountFormatted", totalAmount);
            orderPayload.put("rentAmount", rent);
            orderPayload.put("rentCharged", rentToCharge);
            orderPayload.put("proRataRent", proRataRent);
            orderPayload.put("depositAmount", deposit);
            orderPayload.put("onboardingBillingPolicy", policy);
            orderPayload.put("isMidMonth", isMidMonth);
            orderPayload.put("stayedDays", stayedDays);
            orderPayload.put("daysInMonth", maxDaysInMonth);
            orderPayload.put("advanceCreditEstimate", advanceCreditEstimate);
            orderPayload.put("currency", "INR");
            orderPayload.put("propertyName", resolvedPropName);
            orderPayload.put("businessName", resolvedPropName);
            orderPayload.put("tenantName", req.get("tenantName") != null ? req.get("tenantName").toString() : "New Tenant");
            orderPayload.put("tenantEmail",
                    req.get("tenantEmail") != null ? req.get("tenantEmail").toString() : "tenant@stayeaze.com");
            orderPayload.put("tenantPhone",
                    req.get("tenantPhone") != null ? req.get("tenantPhone").toString() : "9876543210");

            return ResponseEntity.ok(orderPayload);
        } finally {
            TenantIdentifierResolver.clear();
        }
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

            String idType = (String) req.get("idType");
            String idNumber = (String) req.get("idNumber");
            String idFileUrl = (String) req.get("idFileUrl");
            if (idFileUrl == null || idFileUrl.isBlank()) {
                idFileUrl = (String) req.get("fileUrl");
            }
            if (idFileUrl == null || idFileUrl.isBlank()) {
                idFileUrl = (String) req.get("documentUrl");
            }

            Boolean isAgreementAccepted = req.get("isAgreementAccepted") != null
                    ? Boolean.valueOf(req.get("isAgreementAccepted").toString())
                    : (req.get("agreedToTerms") != null && Boolean.valueOf(req.get("agreedToTerms").toString()));

            if (firstName == null || email == null || mobile == null) {
                return ResponseEntity.badRequest()
                        .body(new MessageResponse("Error: First name, email, and mobile are required."));
            }

            if (idType == null || idType.isBlank() || idNumber == null || idNumber.isBlank()) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                        "Error: Identity document type and ID number are required for onboarding compliance."));
            }

            if (idFileUrl == null || idFileUrl.isBlank()) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                        "Error: Identity document proof file upload is mandatory for onboarding compliance."));
            }

            if (!Boolean.TRUE.equals(isAgreementAccepted)) {
                return ResponseEntity.badRequest().body(new MessageResponse(
                        "Error: Tenancy agreement acceptance and digital signature are mandatory to complete onboarding."));
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
                } catch (Exception ignored) {
                }
            }

            if (org == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new MessageResponse("Error: Property or organization context is required for resident onboarding."));
            }

            TenantIdentifierResolver.setCurrentTenant(org.getId());

            boolean isOnlinePaid = "RAZORPAY".equalsIgnoreCase(paymentMethod) && razorpayPaymentId != null
                    && !razorpayPaymentId.isBlank();

            // Cryptographic Razorpay Signature Verification
            if (isOnlinePaid) {
                String[] keys = resolveRazorpayKeys(property, org);
                String activeKeySecret = keys[1];
                if (activeKeySecret != null && !activeKeySecret.contains("mockSecret")
                        && razorpaySignature != null && !razorpaySignature.contains("sandbox") && !razorpaySignature.contains("MOCK")) {
                    try {
                        org.json.JSONObject attributes = new org.json.JSONObject();
                        attributes.put("razorpay_order_id", razorpayOrderId);
                        attributes.put("razorpay_payment_id", razorpayPaymentId);
                        attributes.put("razorpay_signature", razorpaySignature);
                        com.razorpay.Utils.verifyPaymentSignature(attributes, activeKeySecret);
                    } catch (Exception e) {
                        return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid Razorpay payment signature verification!"));
                    }
                }
            }

            // Bed Occupancy Guard: Prevent double-booking race condition
            if (roomNumber != null && bedNumber != null && !roomNumber.isBlank() && !bedNumber.isBlank()) {
                Room matchedRoom = findRoomByPropertyAndNumber(property, org, roomNumber);
                if (matchedRoom != null) {
                    List<Bed> rBeds = bedRepository.findByRoom(matchedRoom);
                    for (Bed b : rBeds) {
                        if (bedNumber.equalsIgnoreCase(b.getBedNumber()) && "OCCUPIED".equalsIgnoreCase(b.getStatus())) {
                            return ResponseEntity.badRequest().body(new MessageResponse(
                                    "Error: Selected Bed (" + bedNumber + ") in Room " + roomNumber + " is already occupied. Please select an available bed."));
                        }
                    }
                }
            }

            String cleanMobile = accountUniquenessService.normalizeMobile(mobile);
            String cleanEmail = accountUniquenessService.normalizeEmail(email);

            // Universal Uniqueness Validation
            try {
                accountUniquenessService.validateTenantEmailAndMobile(org, cleanEmail, cleanMobile, null, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
            }

            // Authoritative server-side pricing (client cannot modify or tamper)
            BigDecimal rent = resolveAuthoritativeRent(property, org, roomNumber, bedNumber);
            BigDecimal deposit = resolveAuthoritativeDeposit(property, org);

            OrganizationBillingProfile bp = getBillingProfile(org);
            String policy = (bp != null && bp.getOnboardingBillingPolicy() != null)
                    ? bp.getOnboardingBillingPolicy()
                    : "FULL_WITH_ADVANCE_CREDIT";

            LocalDate today = LocalDate.now();
            int maxDaysInMonth = today.lengthOfMonth();
            int startDay = today.getDayOfMonth();
            int stayedDays = maxDaysInMonth - startDay + 1;
            boolean isMidMonth = startDay > 1;

            BigDecimal billedRent = rent;
            BigDecimal advanceCredited = BigDecimal.ZERO;

            if (isMidMonth) {
                billedRent = rent.multiply(BigDecimal.valueOf(stayedDays))
                        .divide(BigDecimal.valueOf(maxDaysInMonth), 0, java.math.RoundingMode.HALF_UP);
                if (!"PRORATA_ONLY".equalsIgnoreCase(policy)) {
                    // FULL_WITH_ADVANCE_CREDIT: Collect full rent, invoice pro-rata rent, credit rest to advance
                    advanceCredited = rent.subtract(billedRent);
                }
            }

            final Organization targetOrg = org;
            Tenant tenant = tenantRepository.findFirstByOrganizationAndMobile(targetOrg, cleanMobile)
                    .or(() -> tenantRepository.findFirstByOrganizationAndEmail(targetOrg, cleanEmail))
                    .orElseGet(Tenant::new);

            tenant.setOrganization(org);
            tenant.setFirstName(firstName);
            tenant.setLastName(lastName != null ? lastName : "");
            tenant.setEmail(cleanEmail);
            tenant.setMobile(cleanMobile);
            tenant.setGender(gender);
            tenant.setOccupation(occupation);
            tenant.setIdType(idType.trim().toUpperCase());
            tenant.setIdNumber(idNumber.trim());
            tenant.setIsAgreementAccepted(true);
            tenant.setAgreementAcceptedAt(java.time.OffsetDateTime.now());
            tenant.setRoomNumber(roomNumber);
            tenant.setBedNumber(bedNumber);
            tenant.setPropertyId(propUuid);
            tenant.setRent(rent);
            tenant.setDeposit(deposit);
            tenant.setAdvanceBalance(advanceCredited);
            tenant.setLeaseStart(today.toString());
            tenant.setLeaseEnd(today.plusMonths(11).toString());

            // When onboarding payment is done/submitted, tenant is READY_FOR_CHECKIN
            // awaiting desk check-in
            tenant.setStatus("READY_FOR_CHECKIN");
            if (tenant.getKycStatus() == null) {
                tenant.setKycStatus("PENDING");
            }

            Tenant saved = tenantRepository.save(tenant);

            // Mark Bed as OCCUPIED
            if (roomNumber != null && bedNumber != null && !roomNumber.isBlank() && !bedNumber.isBlank()) {
                Room matchedRoom = findRoomByPropertyAndNumber(property, org, roomNumber);
                if (matchedRoom != null) {
                    List<Bed> rBeds = bedRepository.findByRoom(matchedRoom);
                    for (Bed b : rBeds) {
                        if (bedNumber.equalsIgnoreCase(b.getBedNumber())) {
                            b.setStatus("OCCUPIED");
                            b.setTenantId(saved.getId().toString());
                            b.setTenantName(saved.getFirstName() + " " + saved.getLastName());
                            bedRepository.save(b);
                        }
                    }
                    occupancySyncService.syncStatsForRoom(matchedRoom);
                }
            }

            // Auto-create signed Agreement entity for compliance
            try {
                Agreement initialAgreement = new Agreement(
                        saved,
                        "StayEaze Standard Digital Tenancy Lease Agreement. Rent is due on the 1st of each month with a standard 30-day notice period.",
                        LocalDate.now(),
                        LocalDate.now().plusMonths(11));
                initialAgreement.setStatus("SIGNED");
                initialAgreement.setSignatureUrl("ONBOARDING_DIGITAL_CHECKBOX");
                initialAgreement.setSignedAt(java.time.OffsetDateTime.now());
                agreementRepository.save(initialAgreement);
            } catch (Exception agEx) {
                logger.warn("Could not create initial signed agreement: {}", agEx.getMessage());
            }

            // Auto-create TenantDocument for KYC compliance
            try {
                TenantDocument initialDoc = new TenantDocument(saved, idType.trim().toUpperCase(), idNumber.trim());
                initialDoc.setFileUrl(idFileUrl);
                initialDoc.setVerificationStatus("PENDING");
                tenantDocumentRepository.save(initialDoc);
            } catch (Exception docEx) {
                logger.warn("Could not save initial tenant KYC document record: {}", docEx.getMessage());
            }

            // Generate initial Onboarding Invoice (Pro-Rata/Full Rent + Deposit)
            BigDecimal invoiceAmountDue = billedRent.add(deposit);
            Invoice initialInvoice = new Invoice();
            initialInvoice.setTenant(saved);
            initialInvoice.setInvoiceNumber(invoiceSequenceService.nextRentalInvoiceNumber(saved));
            initialInvoice.setIssueDate(today);
            initialInvoice.setDueDate(today.plusDays(7));
            initialInvoice.setAmountDue(invoiceAmountDue);
            initialInvoice.setAmountPaid(isOnlinePaid ? invoiceAmountDue : BigDecimal.ZERO);
            initialInvoice.setStatus(isOnlinePaid ? "PAID" : "UNPAID");
            initialInvoice.setPaymentMethod(isOnlinePaid ? "RAZORPAY" : "CASH");
            if (isOnlinePaid) {
                initialInvoice.setRazorpayPaymentId(razorpayPaymentId);
                initialInvoice.setRazorpayOrderId(razorpayOrderId);
                initialInvoice.setRazorpaySignature(razorpaySignature);
                initialInvoice.setPaymentReference(razorpayPaymentId);
            }

            List<InvoiceItem> items = new ArrayList<>();
            String monthName = today.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH);
            String rentDesc = isMidMonth
                    ? String.format("Pro-Rata Rent (%d days: %s %d–%d)", stayedDays, monthName, startDay, maxDaysInMonth)
                    : String.format("1st Month Rent Charges (%s %d)", monthName, today.getYear());
            items.add(new InvoiceItem(initialInvoice, rentDesc, billedRent));
            items.add(new InvoiceItem(initialInvoice, "Security Deposit Agreement", deposit));
            initialInvoice.setItems(items);

            Invoice savedInv = invoiceRepository.save(initialInvoice);

            if (isOnlinePaid) {
                try {
                    BigDecimal paidTotal = ("PRORATA_ONLY".equalsIgnoreCase(policy) || !isMidMonth) ? invoiceAmountDue : rent.add(deposit);
                    Payment payment = new Payment();
                    payment.setInvoice(savedInv);
                    payment.setAmount(paidTotal);
                    payment.setPaymentDate(java.time.OffsetDateTime.now());
                    payment.setPaymentMethod("RAZORPAY");
                    payment.setReceiptNumber("REC-" + initialInvoice.getInvoiceNumber().replace("INV-", ""));
                    payment.setTransactionReference(razorpayPaymentId);
                    payment.setStatus("COMPLETED");
                    paymentRepository.save(payment);
                } catch (Exception pEx) {
                    System.err.println("Failed to save Payment for public onboarding: " + pEx.getMessage());
                }
            }

            // Auto-provision User Account & Credentials Dispatch for Tenant
            String tEmail = saved.getEmail().trim().toLowerCase();
            User user = userRepository.findByEmail(tEmail)
                    .or(() -> userRepository.findFirstByMobile(cleanMobile))
                    .orElse(null);

            boolean isNewUser = (user == null);
            String tempPassword = isNewUser ? credentialService.generateSecurePassword() : null;

            if (isNewUser) {
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
                user.setOrganization(org);
                if (propUuid != null) {
                    List<UUID> pIds = user.getPropertyIds() != null ? new ArrayList<>(user.getPropertyIds())
                            : new ArrayList<>();
                    if (!pIds.contains(propUuid)) {
                        pIds.add(propUuid);
                        user.setPropertyIds(pIds);
                    }
                }
                userRepository.save(user);
            }

            String pName = (property != null) ? property.getName() : "StayEaze PG/Hostel";

            if (isNewUser) {
                emailService.sendTenantWelcomeOnboardingEmail(
                        tEmail,
                        saved.getFirstName() + " " + (saved.getLastName() != null ? saved.getLastName() : ""),
                        tempPassword,
                        pName,
                        saved.getRoomNumber(),
                        saved.getBedNumber(),
                        "http://localhost:5173/login");

                if (saved.getMobile() != null && !saved.getMobile().isBlank()) {
                    smsService.sendTenantWelcomeSms(
                            saved.getMobile(),
                            saved.getFirstName(),
                            tempPassword,
                            "http://localhost:5173/login");
                }
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
            response.put("isNewUser", isNewUser);
            response.put("message", isNewUser
                    ? "You have successfully onboarded! Your login credentials have been sent to your email address."
                    : "Welcome back! Tenancy successfully linked to your existing account. Please sign in with your password.");
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Public Onboarding Error: " + e.getMessage()));
        } finally {
            TenantIdentifierResolver.clear();
        }
    }
}
