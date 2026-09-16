package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/tenant-portal")
public class TenantPortalController {

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private TenantDocumentRepository tenantDocumentRepository;

    @Autowired
    private VisitorRepository visitorRepository;

    @Autowired
    private CheckOutRepository checkOutRepository;

    @Autowired
    private MeterReadingRepository meterReadingRepository;

    @Autowired
    private ParcelRepository parcelRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.services.FileStorageService fileStorageService;

    @Autowired
    private com.stayeaze.backend.services.WebSocketNotificationService webSocketNotificationService;

    private Tenant getAuthenticatedTenant() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetailsImpl)) {
            return null;
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) principal;
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        if (user == null)
            return null;

        Organization userOrg = user.getOrganization();

        if (user.getTenantId() != null) {
            Tenant t = tenantRepository.findByIdSuperAdmin(user.getTenantId()).orElse(null);
            if (t != null && (userOrg == null
                    || (t.getOrganization() != null && t.getOrganization().getId().equals(userOrg.getId())))) {
                return t;
            }
        }

        // Fallback: match by email or mobile strictly within the active user
        // organization and active status
        List<Tenant> tenants = userOrg != null
                ? tenantRepository.findByOrganization(userOrg)
                : tenantRepository.findAllSuperAdmin();

        for (Tenant t : tenants) {
            if ("CHECKED_OUT".equalsIgnoreCase(t.getStatus()) || "ARCHIVED".equalsIgnoreCase(t.getStatus())) {
                continue;
            }
            if (t.getEmail() != null && user.getEmail() != null
                    && t.getEmail().trim().equalsIgnoreCase(user.getEmail().trim())) {
                return t;
            }
            if (t.getMobile() != null && user.getMobile() != null
                    && t.getMobile().trim().equals(user.getMobile().trim())) {
                return t;
            }
        }
        return null;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> getTenantOverview() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Tenant accommodation profile not linked to this account."));
        }

        Property property = null;
        if (tenant.getPropertyId() != null) {
            property = propertyRepository.findByIdSuperAdmin(tenant.getPropertyId()).orElse(null);
        }

        // Fetch roommates sharing the same room (if in a shared room)
        List<Map<String, Object>> roommates = new ArrayList<>();
        if (tenant.getRoomNumber() != null && !tenant.getRoomNumber().isBlank()) {
            List<Tenant> allTenants = tenantRepository.findAllSuperAdmin();
            for (Tenant other : allTenants) {
                if (!other.getId().equals(tenant.getId()) &&
                        "ACTIVE".equalsIgnoreCase(other.getStatus()) &&
                        tenant.getRoomNumber().equalsIgnoreCase(other.getRoomNumber()) &&
                        (tenant.getPropertyId() == null || tenant.getPropertyId().equals(other.getPropertyId()))) {
                    Map<String, Object> rm = new HashMap<>();
                    rm.put("name", other.getName());
                    rm.put("bedNumber", other.getBedNumber());
                    rm.put("status", other.getStatus());
                    roommates.add(rm);
                }
            }
        }

        // Calculate pending invoices count and balance
        List<Invoice> invoices = invoiceRepository.findByTenant(tenant);
        BigDecimal totalPendingAmount = BigDecimal.ZERO;
        int unpaidInvoicesCount = 0;
        for (Invoice inv : invoices) {
            String st = inv.getStatus() != null ? inv.getStatus().trim().toUpperCase() : "";
            if (!"PAID".equals(st) && !"COMPLETED".equals(st)) {
                BigDecimal due = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
                BigDecimal paid = inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO;
                BigDecimal pending = due.subtract(paid);
                if (pending.compareTo(BigDecimal.ZERO) > 0) {
                    totalPendingAmount = totalPendingAmount.add(pending);
                    unpaidInvoicesCount++;
                }
            }
        }
        if (totalPendingAmount.compareTo(BigDecimal.ZERO) < 0) {
            totalPendingAmount = BigDecimal.ZERO;
        }

        // Open complaints count
        List<Complaint> complaints = complaintRepository.findByTenant(tenant);
        long openComplaintsCount = complaints.stream()
                .filter(c -> !"RESOLVED".equalsIgnoreCase(c.getStatus()))
                .count();

        Map<String, Object> response = new HashMap<>();
        response.put("tenantId", tenant.getId());
        response.put("name", tenant.getName());
        response.put("firstName", tenant.getFirstName());
        response.put("lastName", tenant.getLastName());
        response.put("email", tenant.getEmail());
        response.put("mobile", tenant.getMobile());
        response.put("gender", tenant.getGender());
        response.put("occupation", tenant.getOccupation());
        response.put("kycStatus", tenant.getKycStatus() != null ? tenant.getKycStatus() : "PENDING");
        response.put("idType", tenant.getIdType());
        response.put("idNumber", tenant.getIdNumber());
        response.put("emergencyContactName", tenant.getEmergencyContactName());
        response.put("emergencyContactMobile", tenant.getEmergencyContactMobile());

        // Accommodation
        response.put("roomNumber", tenant.getRoomNumber());
        response.put("bedNumber", tenant.getBedNumber());
        response.put("rent", tenant.getRent());
        response.put("deposit", tenant.getDeposit());
        response.put("advanceBalance",
                tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO);
        response.put("advanceRentPaid",
                tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO);
        response.put("leaseStart", tenant.getLeaseStart());
        response.put("leaseEnd", tenant.getLeaseEnd());
        response.put("status", tenant.getStatus());

        // Property & Wi-Fi Details
        if (property != null) {
            response.put("propertyName", property.getName());
            response.put("propertyAddress", property.getAddress());
            response.put("propertyCity", property.getCity());
            response.put("gateClosingTime", "10:30 PM");
            response.put("managerPhone", property.getPhone() != null ? property.getPhone() : "+91 98765 43210");
        } else {
            response.put("propertyName", "StayEaze Premium Residency");
            response.put("propertyAddress", "Central City Campus");
            response.put("propertyCity", "Bengaluru");
            response.put("gateClosingTime", "10:30 PM");
            response.put("managerPhone", "+91 98765 43210");
        }

        // Resolve Wi-Fi credentials with priority: Room -> Floor -> Property
        String resolvedWifiSsid = null;
        String resolvedWifiPassword = null;
        String resolvedWifiType = "PROPERTY WI-FI";

        Room tenantRoom = null;
        try {
            if (tenant.getRoomNumber() != null && !tenant.getRoomNumber().isBlank()) {
                List<Room> allRooms = roomRepository.findAll();
                for (Room r : allRooms) {
                    if (r != null && r.getRoomNumber() != null
                            && r.getRoomNumber().trim().equalsIgnoreCase(tenant.getRoomNumber().trim())) {
                        if (property == null || (r.getFloor() != null && r.getFloor().getBuilding() != null
                                && r.getFloor().getBuilding().getProperty() != null
                                && property.getId().equals(r.getFloor().getBuilding().getProperty().getId()))) {
                            tenantRoom = r;
                            break;
                        }
                    }
                }
            }

            if (tenantRoom == null && tenant.getId() != null) {
                String tidStr = tenant.getId().toString();
                Bed bed = bedRepository.findAll().stream()
                        .filter(b -> tidStr.equals(b.getTenantId()))
                        .findFirst()
                        .orElse(null);
                if (bed != null && bed.getRoom() != null) {
                    tenantRoom = bed.getRoom();
                }
            }
        } catch (Exception ignored) {
        }

        // DSA Inverted Index Algorithm:
        // Build O(1) fast lookup index maps from centralized property.wifiNetworksJson
        // if configured
        Map<String, Map<String, Object>> hubRoomMap = new HashMap<>();
        Map<String, Map<String, Object>> hubFloorMap = new HashMap<>();
        Map<String, Map<String, Object>> hubBuildingMap = new HashMap<>();
        Map<String, Object> hubPropertyDefault = null;

        if (property != null && property.getWifiNetworksJson() != null && !property.getWifiNetworksJson().isBlank()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                List<Map<String, Object>> hubNetworks = mapper.readValue(property.getWifiNetworksJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {
                        });
                if (hubNetworks != null) {
                    for (Map<String, Object> net : hubNetworks) {
                        String coverageType = (String) net.getOrDefault("coverageType", "ALL_PROPERTY");
                        if ("ROOMS".equalsIgnoreCase(coverageType) || "ROOM_WISE".equalsIgnoreCase(coverageType)) {
                            List<String> rooms = (List<String>) net.get("coveredRoomNumbers");
                            List<String> bldNames = (List<String>) net.get("coveredBuildingNames");
                            String targetBld = (String) net.get("targetBuildingName");
                            if (rooms != null) {
                                for (String rm : rooms) {
                                    if (rm != null) {
                                        String rmL = rm.trim().toLowerCase();
                                        hubRoomMap.put(rmL, net);
                                        if (targetBld != null && !targetBld.isBlank()) {
                                            hubRoomMap.put(targetBld.trim().toLowerCase() + ":::" + rmL, net);
                                        }
                                        if (bldNames != null) {
                                            for (String bn : bldNames) {
                                                if (bn != null)
                                                    hubRoomMap.put(bn.trim().toLowerCase() + ":::" + rmL, net);
                                            }
                                        }
                                    }
                                }
                            }
                        } else if ("FLOORS".equalsIgnoreCase(coverageType)
                                || "FLOOR_WISE".equalsIgnoreCase(coverageType)) {
                            List<String> floorIds = (List<String>) net.get("coveredFloorIds");
                            if (floorIds != null) {
                                for (String fid : floorIds) {
                                    if (fid != null)
                                        hubFloorMap.put(fid.trim().toLowerCase(), net);
                                }
                            }
                            List<String> floorNames = (List<String>) net.get("coveredFloorNames");
                            if (floorNames != null) {
                                for (String fn : floorNames) {
                                    if (fn != null)
                                        hubFloorMap.put(fn.trim().toLowerCase(), net);
                                }
                            }
                        } else if ("BUILDINGS".equalsIgnoreCase(coverageType)
                                || "BUILDING_WISE".equalsIgnoreCase(coverageType)) {
                            List<String> buildingIds = (List<String>) net.get("coveredBuildingIds");
                            if (buildingIds != null) {
                                for (String bid : buildingIds) {
                                    if (bid != null)
                                        hubBuildingMap.put(bid.trim().toLowerCase(), net);
                                }
                            }
                            List<String> buildingNames = (List<String>) net.get("coveredBuildingNames");
                            if (buildingNames != null) {
                                for (String bn : buildingNames) {
                                    if (bn != null)
                                        hubBuildingMap.put(bn.trim().toLowerCase(), net);
                                }
                            }
                        } else if (hubPropertyDefault == null) {
                            hubPropertyDefault = net;
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }

        // Priority 1: Hub Room-Specific Router
        String tenantRoomNum = tenant.getRoomNumber() != null ? tenant.getRoomNumber().trim().toLowerCase() : null;
        String tenantBldName = tenantRoom != null && tenantRoom.getFloor() != null
                && tenantRoom.getFloor().getBuilding() != null && tenantRoom.getFloor().getBuilding().getName() != null
                        ? tenantRoom.getFloor().getBuilding().getName().trim().toLowerCase()
                        : null;
        String bldRoomKey = (tenantBldName != null && tenantRoomNum != null) ? (tenantBldName + ":::" + tenantRoomNum)
                : null;

        if (bldRoomKey != null && hubRoomMap.containsKey(bldRoomKey)) {
            Map<String, Object> net = hubRoomMap.get(bldRoomKey);
            resolvedWifiSsid = (String) net.get("ssid");
            resolvedWifiPassword = (String) net.get("password");
            resolvedWifiType = "ROOM " + tenant.getRoomNumber() + " WI-FI";
        } else if (tenantRoomNum != null && hubRoomMap.containsKey(tenantRoomNum)) {
            Map<String, Object> net = hubRoomMap.get(tenantRoomNum);
            resolvedWifiSsid = (String) net.get("ssid");
            resolvedWifiPassword = (String) net.get("password");
            resolvedWifiType = "ROOM " + tenant.getRoomNumber() + " WI-FI";
        }
        // Priority 2: Hub Floor-Specific Router
        else if (tenantRoom != null && tenantRoom.getFloor() != null && tenantRoom.getFloor().getId() != null
                && hubFloorMap.containsKey(tenantRoom.getFloor().getId().toString().toLowerCase())) {
            Map<String, Object> net = hubFloorMap.get(tenantRoom.getFloor().getId().toString().toLowerCase());
            resolvedWifiSsid = (String) net.get("ssid");
            resolvedWifiPassword = (String) net.get("password");
            resolvedWifiType = tenantRoom.getFloor().getName().toUpperCase() + " WI-FI";
        } else if (tenantRoom != null && tenantRoom.getFloor() != null && tenantRoom.getFloor().getName() != null
                && hubFloorMap.containsKey(tenantRoom.getFloor().getName().trim().toLowerCase())) {
            Map<String, Object> net = hubFloorMap.get(tenantRoom.getFloor().getName().trim().toLowerCase());
            resolvedWifiSsid = (String) net.get("ssid");
            resolvedWifiPassword = (String) net.get("password");
            resolvedWifiType = tenantRoom.getFloor().getName().toUpperCase() + " WI-FI";
        }
        // Priority 3: Hub Building-Specific Router (e.g. "Tower B Building Wi-Fi")
        else if (tenantRoom != null && tenantRoom.getFloor() != null && tenantRoom.getFloor().getBuilding() != null
                && tenantRoom.getFloor().getBuilding().getId() != null
                && hubBuildingMap.containsKey(tenantRoom.getFloor().getBuilding().getId().toString().toLowerCase())) {
            Map<String, Object> net = hubBuildingMap
                    .get(tenantRoom.getFloor().getBuilding().getId().toString().toLowerCase());
            resolvedWifiSsid = (String) net.get("ssid");
            resolvedWifiPassword = (String) net.get("password");
            resolvedWifiType = tenantRoom.getFloor().getBuilding().getName().toUpperCase() + " BUILDING WI-FI";
        } else if (tenantRoom != null && tenantRoom.getFloor() != null && tenantRoom.getFloor().getBuilding() != null
                && tenantRoom.getFloor().getBuilding().getName() != null
                && hubBuildingMap.containsKey(tenantRoom.getFloor().getBuilding().getName().trim().toLowerCase())) {
            Map<String, Object> net = hubBuildingMap
                    .get(tenantRoom.getFloor().getBuilding().getName().trim().toLowerCase());
            resolvedWifiSsid = (String) net.get("ssid");
            resolvedWifiPassword = (String) net.get("password");
            resolvedWifiType = tenantRoom.getFloor().getBuilding().getName().toUpperCase() + " BUILDING WI-FI";
        }
        // Priority 4: Hub Property Default Router or Property Entity Wi-Fi or System
        // Fallback
        else if (hubPropertyDefault != null && hubPropertyDefault.get("password") != null) {
            resolvedWifiSsid = (String) hubPropertyDefault.get("ssid");
            resolvedWifiPassword = (String) hubPropertyDefault.get("password");
            resolvedWifiType = "PROPERTY WI-FI";
        } else if (property != null && property.getWifiPassword() != null
                && !property.getWifiPassword().trim().isBlank()) {
            resolvedWifiPassword = property.getWifiPassword().trim();
            resolvedWifiSsid = property.getWifiSsid() != null && !property.getWifiSsid().trim().isBlank()
                    ? property.getWifiSsid().trim()
                    : property.getName().replaceAll("\\s+", "_") + "_Tenant_HighSpeed";
            resolvedWifiType = "PROPERTY WI-FI";
        } else {
            resolvedWifiSsid = property != null ? property.getName().replaceAll("\\s+", "_") + "_Tenant_HighSpeed"
                    : "StayEaze_HighSpeed_WiFi";
            resolvedWifiPassword = "StayEaze@"
                    + (property != null && property.getCity() != null ? property.getCity() : "2026");
            resolvedWifiType = "PROPERTY WI-FI";
        }

        response.put("wifiSsid", resolvedWifiSsid);
        response.put("wifiPassword", resolvedWifiPassword);
        response.put("wifiType", resolvedWifiType);

        boolean isInitialPaid = totalPendingAmount.compareTo(BigDecimal.ZERO) == 0;
        boolean isDeskPending = "PENDING_CHECKIN".equalsIgnoreCase(tenant.getStatus())
                || "PENDING_PAYMENT_APPROVAL".equalsIgnoreCase(tenant.getStatus());
        boolean isKycVerified = "VERIFIED".equalsIgnoreCase(tenant.getKycStatus());
        boolean isAgreementAccepted = Boolean.TRUE.equals(tenant.getIsAgreementAccepted());
        boolean onboardingComplete = isInitialPaid && isKycVerified && isAgreementAccepted;

        Organization org = tenant.getOrganization();
        if (org == null && property != null) {
            org = property.getOrganization();
        }

        OrganizationBillingProfile billingProfile = null;
        if (org != null) {
            billingProfile = organizationBillingProfileRepository.findByOrganization(org).orElse(null);
        }

        String propName = property != null && property.getName() != null && !property.getName().isBlank()
                ? property.getName()
                : (org != null ? org.getName() : "Property Accommodation");

        boolean hasRazorpay = (property != null && property.getRazorpayKeyId() != null
                && !property.getRazorpayKeyId().isBlank()) ||
                (billingProfile != null && billingProfile.getRazorpayKeyId() != null
                        && !billingProfile.getRazorpayKeyId().isBlank());

        // Resolve Bank & UPI Details with Priority: Property specific > Org Billing
        // Profile > Org Legal Info
        String accName = null;
        String bName = null;
        String accNum = null;
        String ifsc = null;
        String upi = null;

        if (property != null) {
            if (property.getBankAccountName() != null && !property.getBankAccountName().isBlank())
                accName = property.getBankAccountName();
            if (property.getBankName() != null && !property.getBankName().isBlank())
                bName = property.getBankName();
            if (property.getBankAccountNumber() != null && !property.getBankAccountNumber().isBlank())
                accNum = property.getBankAccountNumber();
            if (property.getBankIfsc() != null && !property.getBankIfsc().isBlank())
                ifsc = property.getBankIfsc();
            if (property.getUpiVpa() != null && !property.getUpiVpa().isBlank())
                upi = property.getUpiVpa();
        }

        if (billingProfile != null) {
            if (accName == null || accName.isBlank())
                accName = billingProfile.getBankAccountName() != null && !billingProfile.getBankAccountName().isBlank()
                        ? billingProfile.getBankAccountName()
                        : billingProfile.getLegalName();
            if (bName == null || bName.isBlank())
                bName = billingProfile.getBankName();
            if (accNum == null || accNum.isBlank())
                accNum = billingProfile.getBankAccountNumber();
            if (ifsc == null || ifsc.isBlank())
                ifsc = billingProfile.getBankIfsc();
            if (upi == null || upi.isBlank())
                upi = billingProfile.getUpiVpa();
        }

        if (accName == null || accName.isBlank())
            accName = propName;
        if (bName == null || bName.isBlank())
            bName = "Primary Current Bank Account";
        if (accNum == null || accNum.isBlank())
            accNum = "Contact Reception Desk";
        if (ifsc == null || ifsc.isBlank())
            ifsc = "N/A";
        if (upi == null || upi.isBlank())
            upi = org != null && org.getSubdomain() != null ? org.getSubdomain() + "@upi" : "Contact Reception for QR";

        Map<String, Object> bankDetails = new HashMap<>();
        bankDetails.put("accountName", accName);
        bankDetails.put("bankName", bName);
        bankDetails.put("accountNumber", accNum);
        bankDetails.put("ifsc", ifsc);
        bankDetails.put("upiId", upi);
        bankDetails.put("propertyName", propName);

        response.put("propertyName", propName);
        response.put("hasRazorpay", hasRazorpay);
        response.put("bankDetails", bankDetails);

        List<TenantDocument> tenantDocs = tenantDocumentRepository.findByTenant(tenant);
        boolean hasUploadedKyc = (tenantDocs != null && !tenantDocs.isEmpty())
                || (tenant.getIdNumber() != null && !tenant.getIdNumber().isBlank());
        List<Agreement> agreements = agreementRepository.findByTenant(tenant);
        boolean hasSignedAgreement = Boolean.TRUE.equals(tenant.getIsAgreementAccepted())
                || (agreements != null && agreements.stream().anyMatch(a -> "SIGNED".equalsIgnoreCase(a.getStatus())));
        boolean isComplianceCompleted = hasUploadedKyc && hasSignedAgreement;

        response.put("isInitialPaid", isInitialPaid);
        response.put("isDeskPending", isDeskPending);
        response.put("isKycVerified", isKycVerified);
        response.put("hasUploadedKyc", hasUploadedKyc);
        response.put("hasSignedAgreement", hasSignedAgreement);
        response.put("isComplianceCompleted", isComplianceCompleted);
        response.put("isAgreementAccepted", hasSignedAgreement);
        response.put("isLeaseSigned", hasSignedAgreement);
        response.put("onboardingComplete", onboardingComplete && isComplianceCompleted);

        long pendingParcelsCount = 0;
        try {
            pendingParcelsCount = parcelRepository.findByTenant(tenant).stream()
                    .filter(p -> "RECEIVED".equalsIgnoreCase(p.getStatus()))
                    .count();
        } catch (Exception ignored) {}

        response.put("roommates", roommates);
        response.put("totalPendingAmount", totalPendingAmount);
        response.put("advanceBalance",
                tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO);
        response.put("unpaidInvoicesCount", unpaidInvoicesCount);
        response.put("openComplaintsCount", openComplaintsCount);
        response.put("pendingParcelsCount", pendingParcelsCount);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/invoices")
    @Transactional
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> getTenantInvoices() {
        try {
            Tenant tenant = getAuthenticatedTenant();
            if (tenant == null) {
                return ResponseEntity.ok(new ArrayList<>());
            }

            List<Invoice> invoices = invoiceRepository.findByTenant(tenant);
            List<Map<String, Object>> result = new ArrayList<>();
            for (Invoice inv : invoices) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", inv.getId());
                map.put("invoiceNumber", inv.getInvoiceNumber());
                map.put("issueDate", inv.getIssueDate());
                map.put("dueDate", inv.getDueDate());
                map.put("amountDue", inv.getAmountDue());
                map.put("amountPaid", inv.getAmountPaid());
                map.put("status", inv.getStatus());
                map.put("paymentMethod", inv.getPaymentMethod());
                map.put("paymentReference", inv.getPaymentReference());

                List<Map<String, Object>> itemList = new ArrayList<>();
                try {
                    if (inv.getItems() != null && !inv.getItems().isEmpty()) {
                        for (InvoiceItem it : inv.getItems()) {
                            Map<String, Object> itemMap = new HashMap<>();
                            itemMap.put("description", it.getDescription());
                            itemMap.put("amount", it.getAmount());
                            itemList.add(itemMap);
                        }
                    }
                } catch (Exception ignored) {
                }

                if (itemList.isEmpty()) {
                    // If items list is empty in DB, construct exact items based on invoice amount &
                    // tenant rent/deposit
                    BigDecimal total = inv.getAmountDue() != null ? inv.getAmountDue() : BigDecimal.ZERO;
                    BigDecimal tenantRent = tenant.getRent() != null ? tenant.getRent() : BigDecimal.ZERO;
                    BigDecimal tenantDeposit = tenant.getSecurityDeposit() != null ? tenant.getSecurityDeposit()
                            : BigDecimal.ZERO;

                    // Check if this invoice is the onboarding move-in invoice (Rent + Deposit)
                    if (tenantDeposit.compareTo(BigDecimal.ZERO) > 0 && tenantRent.compareTo(BigDecimal.ZERO) > 0
                            && total.compareTo(tenantRent.add(tenantDeposit)) == 0) {
                        Map<String, Object> rentItem = new HashMap<>();
                        rentItem.put("description", "First Month Room Accommodation Rent");
                        rentItem.put("amount", tenantRent);
                        itemList.add(rentItem);

                        Map<String, Object> depItem = new HashMap<>();
                        depItem.put("description", "Refundable Security Deposit");
                        depItem.put("amount", tenantDeposit);
                        itemList.add(depItem);
                    } else if (tenantDeposit.compareTo(BigDecimal.ZERO) > 0 && total.compareTo(tenantDeposit) == 0) {
                        Map<String, Object> depItem = new HashMap<>();
                        depItem.put("description", "Refundable Security Deposit");
                        depItem.put("amount", tenantDeposit);
                        itemList.add(depItem);
                    } else {
                        Map<String, Object> rentItem = new HashMap<>();
                        rentItem.put("description", "Monthly Room Accommodation Rent");
                        rentItem.put("amount", total);
                        itemList.add(rentItem);
                    }
                }

                map.put("items", itemList);
                result.add(map);
            }

            // If no invoices exist yet, generate and persist a default initial invoice
            // based on tenant's rent + deposit
            if (result.isEmpty() && tenant.getRent() != null && tenant.getRent().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal dep = tenant.getSecurityDeposit() != null ? tenant.getSecurityDeposit() : BigDecimal.ZERO;
                BigDecimal totalInitial = tenant.getRent().add(dep);

                String invNum = null;
                try {
                    invNum = invoiceSequenceService.nextRentalInvoiceNumber(tenant);
                } catch (Exception e) {
                    invNum = "INV-" + System.currentTimeMillis();
                }

                Invoice initialInv = new Invoice();
                initialInv.setTenant(tenant);
                initialInv.setInvoiceNumber(invNum);
                initialInv.setIssueDate(LocalDate.now());
                initialInv.setDueDate(LocalDate.now().plusDays(7));
                initialInv.setAmountDue(totalInitial);
                initialInv.setAmountPaid(BigDecimal.ZERO);
                initialInv.setStatus("UNPAID");
                initialInv.setPaymentMethod("RAZORPAY");

                Invoice savedInv = invoiceRepository.save(initialInv);

                List<Map<String, Object>> initialItems = new ArrayList<>();
                Map<String, Object> rentItem = new HashMap<>();
                rentItem.put("description", "First Month Room Accommodation Rent");
                rentItem.put("amount", tenant.getRent());
                initialItems.add(rentItem);

                if (dep.compareTo(BigDecimal.ZERO) > 0) {
                    Map<String, Object> depItem = new HashMap<>();
                    depItem.put("description", "Refundable Security Deposit");
                    depItem.put("amount", dep);
                    initialItems.add(depItem);
                }

                Map<String, Object> initialMap = new HashMap<>();
                initialMap.put("id", savedInv.getId());
                initialMap.put("invoiceNumber", savedInv.getInvoiceNumber());
                initialMap.put("issueDate", savedInv.getIssueDate());
                initialMap.put("dueDate", savedInv.getDueDate());
                initialMap.put("amountDue", savedInv.getAmountDue());
                initialMap.put("amountPaid", savedInv.getAmountPaid());
                initialMap.put("status", savedInv.getStatus());
                initialMap.put("paymentMethod", savedInv.getPaymentMethod());
                initialMap.put("items", initialItems);
                result.add(initialMap);
            }

            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    @GetMapping("/complaints")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> getTenantComplaints() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        List<Complaint> complaints = complaintRepository.findByTenant(tenant);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Complaint c : complaints) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("category", c.getCategory());
            map.put("description", c.getDescription());
            map.put("priority", c.getPriority());
            map.put("status", c.getStatus());
            map.put("assignedStaff", c.getAssignedStaff());
            map.put("createdAt", c.getCreatedAt());
            map.put("resolvedAt", c.getResolvedAt());
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/complaints")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> createTenantComplaint(@RequestBody Map<String, String> req) {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        String category = req.getOrDefault("category", "MAINTENANCE");
        String description = req.get("description");
        String priority = req.getOrDefault("priority", "MEDIUM");

        if (description == null || description.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Complaint description is required."));
        }

        Complaint complaint = new Complaint(tenant, category, description);
        complaint.setPriority(priority);
        complaint.setStatus("OPEN");
        complaint.setAssignedStaff("Property Manager & Receptionist");

        // Automatically bind tenant's room if assigned
        if (tenant.getRoomNumber() != null && !tenant.getRoomNumber().isBlank() && tenant.getPropertyId() != null) {
            try {
                List<Room> propRooms = roomRepository.findByPropertyIdNative(tenant.getPropertyId());
                if (propRooms != null) {
                    for (Room r : propRooms) {
                        if (tenant.getRoomNumber().equalsIgnoreCase(r.getRoomNumber())) {
                            complaint.setRoom(r);
                            break;
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }

        Property prop = null;
        if (tenant.getPropertyId() != null) {
            prop = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
        }
        String ticketNum = invoiceSequenceService.nextComplaintTicketNumber(prop, tenant.getOrganization());
        complaint.setTicketNumber(ticketNum);

        Complaint saved = complaintRepository.save(complaint);

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "COMPLAINT_CREATED");
            payload.put("title", "🛠️ New Complaint Ticket!");
            payload.put("message", (saved.getTicketNumber() != null ? saved.getTicketNumber() : "TKT") + ": "
                    + (saved.getDescription() != null ? saved.getDescription() : "New complaint logged"));
            payload.put("complaintId", saved.getId());
            payload.put("ticketNumber", saved.getTicketNumber());
            payload.put("status", saved.getStatus());
            payload.put("category", saved.getCategory());
            payload.put("tenantName",
                    (tenant.getFirstName() + " " + (tenant.getLastName() != null ? tenant.getLastName() : "")).trim());

            webSocketNotificationService.broadcastTopic("/topic/complaints", payload);
        } catch (Exception ignored) {
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/documents")
    @PreAuthorize("hasRole('TENANT')")
    public ResponseEntity<?> getTenantDocuments() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        List<TenantDocument> docs = tenantDocumentRepository.findByTenant(tenant);
        if (docs == null) {
            docs = new java.util.ArrayList<>();
        }

        // If no explicit TenantDocument row exists yet, but tenant has idNumber/idType,
        // auto-synthesize an initial document entry
        if (docs.isEmpty() && tenant.getIdNumber() != null && !tenant.getIdNumber().isBlank()) {
            TenantDocument initialDoc = new TenantDocument(tenant,
                    tenant.getIdType() != null ? tenant.getIdType().toUpperCase() : "AADHAAR", tenant.getIdNumber());
            initialDoc.setVerificationStatus(tenant.getKycStatus() != null ? tenant.getKycStatus() : "PENDING");
            initialDoc.setFileUrl(null);
            TenantDocument saved = tenantDocumentRepository.save(initialDoc);
            docs.add(saved);
        }

        return ResponseEntity.ok(docs);
    }

    @PostMapping("/documents")
    @PreAuthorize("hasRole('TENANT')")
    public ResponseEntity<?> uploadTenantDocument(@RequestBody Map<String, String> req) {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        String documentType = req.getOrDefault("documentType", "AADHAAR");
        String documentNumber = req.get("documentNumber");
        String fileUrl = req.get("fileUrl");

        if (documentNumber == null || documentNumber.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Document number is required."));
        }

        TenantDocument doc = new TenantDocument(tenant, documentType, documentNumber);
        doc.setFileUrl(fileUrl != null ? fileUrl : "https://stayeaze-kyc.s3.amazonaws.com/mock-doc.pdf");
        doc.setVerificationStatus("PENDING");

        TenantDocument saved = tenantDocumentRepository.save(doc);

        if (documentType != null && !documentType.isBlank()) {
            tenant.setIdType(documentType.toLowerCase());
        }
        if (documentNumber != null && !documentNumber.isBlank()) {
            tenant.setIdNumber(documentNumber);
        }
        tenant.setKycStatus("PENDING");
        tenantRepository.save(tenant);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping(value = "/documents/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('TENANT')")
    public ResponseEntity<?> uploadTenantDocumentMultipart(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam("documentNumber") String documentNumber) {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        if (documentNumber == null || documentNumber.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Document number is required."));
        }

        try {
            String fileUrl = fileStorageService.storeFile(file, "kyc");
            TenantDocument doc = new TenantDocument(tenant, documentType, documentNumber);
            doc.setFileUrl(fileUrl);
            doc.setVerificationStatus("PENDING");
            TenantDocument saved = tenantDocumentRepository.save(doc);

            if (documentType != null && !documentType.isBlank()) {
                tenant.setIdType(documentType.toLowerCase());
            }
            if (documentNumber != null && !documentNumber.isBlank()) {
                tenant.setIdNumber(documentNumber);
            }
            tenant.setKycStatus("PENDING");
            tenantRepository.save(tenant);

            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Failed to upload document file: " + e.getMessage()));
        }
    }

    @GetMapping("/visitors")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> getTenantVisitors() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        List<Visitor> visitors = visitorRepository.findByTenant(tenant);
        return ResponseEntity.ok(visitors);
    }

    @PostMapping("/visitors")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> preRegisterVisitor(@RequestBody Map<String, String> req) {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        String visitorName = req.get("visitorName");
        String mobileNumber = req.get("mobileNumber");
        String purpose = req.getOrDefault("purpose", "Personal Visit");

        if (visitorName == null || mobileNumber == null) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Visitor name and mobile number are required."));
        }

        Visitor visitor = new Visitor(tenant, visitorName, mobileNumber);
        visitor.setPurpose(purpose);
        visitor.setStatus("PRE_REGISTERED");

        Visitor saved = visitorRepository.save(visitor);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/lease")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> getTenantLease() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        Property property = null;
        if (tenant.getPropertyId() != null) {
            property = propertyRepository.findByIdSuperAdmin(tenant.getPropertyId()).orElse(null);
        }

        Map<String, Object> lease = new HashMap<>();
        lease.put("tenantName", tenant.getName());
        lease.put("propertyName", property != null ? property.getName() : "StayEaze Residency");
        lease.put("propertyAddress", property != null ? property.getAddress() : "Central Residency Campus");
        lease.put("roomNumber", tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "101");
        lease.put("bedNumber", tenant.getBedNumber() != null ? tenant.getBedNumber() : "A");
        lease.put("monthlyRent", tenant.getRent() != null ? tenant.getRent() : BigDecimal.valueOf(8000));
        lease.put("securityDeposit", tenant.getDeposit() != null ? tenant.getDeposit() : BigDecimal.valueOf(10000));
        lease.put("leaseStart", tenant.getLeaseStart() != null ? tenant.getLeaseStart() : LocalDate.now().toString());
        lease.put("leaseEnd",
                tenant.getLeaseEnd() != null ? tenant.getLeaseEnd() : LocalDate.now().plusMonths(11).toString());
        lease.put("isSigned", Boolean.TRUE.equals(tenant.getIsAgreementAccepted()));
        lease.put("signedAt",
                tenant.getAgreementAcceptedAt() != null ? tenant.getAgreementAcceptedAt().toString() : null);

        return ResponseEntity.ok(lease);
    }

    @PostMapping({ "/lease/sign", "/agreement/sign" })
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> signTenantLease(@RequestBody(required = false) Map<String, String> req) {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Tenant not found."));
        }

        tenant.setIsAgreementAccepted(true);
        tenant.setAgreementAcceptedAt(java.time.OffsetDateTime.now());
        tenantRepository.save(tenant);

        // Also update or create signed Agreement records
        List<Agreement> agreements = agreementRepository.findByTenant(tenant);
        if (agreements != null && !agreements.isEmpty()) {
            for (Agreement ag : agreements) {
                if (!"SIGNED".equalsIgnoreCase(ag.getStatus())) {
                    ag.setStatus("SIGNED");
                    ag.setSignedAt(java.time.OffsetDateTime.now());
                    ag.setSignatureUrl("TENANT_PORTAL_DIGITAL_SIGNATURE");
                    agreementRepository.save(ag);
                }
            }
        } else {
            Agreement ag = new Agreement(
                    tenant,
                    "StayEaze Digital Tenancy Agreement. Standard 30-day notice period and rent due on the 1st.",
                    LocalDate.now(),
                    LocalDate.now().plusMonths(11)
            );
            ag.setStatus("SIGNED");
            ag.setSignedAt(java.time.OffsetDateTime.now());
            ag.setSignatureUrl("TENANT_PORTAL_DIGITAL_SIGNATURE");
            agreementRepository.save(ag);
        }

        return ResponseEntity.ok(new MessageResponse("Digital Tenancy Agreement signed successfully."));
    }

    @GetMapping("/refund-account")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> getRefundAccount() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Tenant accommodation profile not found."));
        }

        Map<String, Object> map = new HashMap<>();
        map.put("tenantId", tenant.getId());
        map.put("tenantName", tenant.getName());
        map.put("refundUpi", tenant.getRefundUpi());
        map.put("refundAccountName", tenant.getRefundAccountName());
        map.put("refundAccountNumber", tenant.getRefundAccountNumber());
        map.put("refundIfsc", tenant.getRefundIfsc());
        map.put("refundBankName", tenant.getRefundBankName());
        BigDecimal depositPaid = tenant.getDeposit();
        if (depositPaid == null || depositPaid.compareTo(BigDecimal.ZERO) == 0) {
            try {
                if (tenant.getOrganization() != null) {
                    OrganizationBillingProfile profile = organizationBillingProfileRepository
                            .findByOrganization(tenant.getOrganization()).orElse(null);
                    if (profile != null && profile.getDefaultSecurityDeposit() != null
                            && profile.getDefaultSecurityDeposit().compareTo(BigDecimal.ZERO) > 0) {
                        depositPaid = profile.getDefaultSecurityDeposit();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        map.put("depositAmount", depositPaid != null ? depositPaid : BigDecimal.ZERO);
        return ResponseEntity.ok(map);
    }

    @PostMapping("/refund-account")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER')")
    public ResponseEntity<?> updateRefundAccount(@RequestBody Map<String, String> req) {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Tenant accommodation profile not found."));
        }

        String upi = req.get("refundUpi");
        String accName = req.get("refundAccountName");
        String accNum = req.get("refundAccountNumber");
        String ifsc = req.get("refundIfsc");
        String bank = req.get("refundBankName");

        if ((upi == null || upi.isBlank()) && (accNum == null || accNum.isBlank())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Please provide either a valid UPI ID or Bank Account Number."));
        }

        tenant.setRefundUpi(upi != null ? upi.trim() : null);
        tenant.setRefundAccountName(accName != null ? accName.trim() : (tenant.getName()));
        tenant.setRefundAccountNumber(accNum != null ? accNum.trim() : null);
        tenant.setRefundIfsc(ifsc != null ? ifsc.trim().toUpperCase() : null);
        tenant.setRefundBankName(bank != null ? bank.trim() : null);

        tenantRepository.save(tenant);

        // Auto-sync into any active / pending CheckOut records for this tenant
        try {
            List<CheckOut> checkOuts = checkOutRepository.findByOrganization(tenant.getOrganization());
            if (checkOuts != null) {
                for (CheckOut co : checkOuts) {
                    if (co.getTenantName() != null && co.getTenantName().equalsIgnoreCase(tenant.getName())) {
                        co.setBeneficiaryUpi(tenant.getRefundUpi());
                        co.setBeneficiaryAccount(tenant.getRefundAccountNumber());
                        co.setBeneficiaryIfsc(tenant.getRefundIfsc());
                        co.setBeneficiaryBank(tenant.getRefundBankName());
                        checkOutRepository.save(co);
                    }
                }
            }
        } catch (Exception ignored) {
        }

        Map<String, Object> res = new HashMap<>();
        res.put("message", "Security deposit refund account details updated successfully.");
        res.put("refundUpi", tenant.getRefundUpi());
        res.put("refundAccountNumber", tenant.getRefundAccountNumber());
        res.put("refundIfsc", tenant.getRefundIfsc());
        res.put("refundBankName", tenant.getRefundBankName());
        return ResponseEntity.ok(res);
    }

    @GetMapping("/utilities")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getTenantUtilities() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized tenant"));
        }

        List<Map<String, Object>> result = new ArrayList<>();
        if (tenant.getPropertyId() == null || tenant.getRoomNumber() == null || tenant.getRoomNumber().isBlank()) {
            return ResponseEntity.ok(result);
        }

        List<Room> propRooms = roomRepository.findByPropertyIdNative(tenant.getPropertyId());
        Room tenantRoom = propRooms.stream()
                .filter(r -> r.getRoomNumber() != null && r.getRoomNumber().equalsIgnoreCase(tenant.getRoomNumber()))
                .findFirst().orElse(null);

        if (tenantRoom == null) {
            return ResponseEntity.ok(result);
        }

        List<MeterReading> readings = meterReadingRepository.findByRoom(tenantRoom);
        readings.sort((a, b) -> {
            int yCmp = Integer.compare(b.getBillingYear() != null ? b.getBillingYear() : 0,
                    a.getBillingYear() != null ? a.getBillingYear() : 0);
            if (yCmp != 0)
                return yCmp;
            return Integer.compare(b.getBillingMonth() != null ? b.getBillingMonth() : 0,
                    a.getBillingMonth() != null ? a.getBillingMonth() : 0);
        });

        Set<String> seenCycles = new HashSet<>();
        for (MeterReading mr : readings) {
            String cycleKey = (mr.getBillingYear() != null ? mr.getBillingYear() : 0) + "_"
                    + (mr.getBillingMonth() != null ? mr.getBillingMonth() : 0);
            if (!seenCycles.add(cycleKey)) {
                continue; // Skip historical duplicates for the same cycle
            }

            Map<String, Object> map = new HashMap<>();
            map.put("id", mr.getId());
            map.put("roomNumber", tenantRoom.getRoomNumber());
            map.put("readingDate", mr.getReadingDate());
            map.put("billingMonth", mr.getBillingMonth());
            map.put("billingYear", mr.getBillingYear());
            map.put("previousReading", mr.getPreviousReadingValue());
            map.put("currentReading", mr.getReadingValue());
            map.put("unitsConsumed", mr.getUnitsConsumed());
            map.put("unitRate", mr.getUnitRate());
            map.put("totalAmount", mr.getTotalAmount());
            map.put("freeAllowanceUnits", mr.getFreeAllowanceUnits());
            map.put("splitMode", mr.getSplitMode());
            map.put("status", mr.getStatus());
            map.put("photoUrl", mr.getPhotoUrl());
            map.put("tenantSplitDetails", mr.getTenantSplitDetailsJson());
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/parcels")
    @PreAuthorize("hasAnyRole('TENANT', 'ADMIN', 'PROPERTY_MANAGER', 'OWNER')")
    public ResponseEntity<?> getTenantPortalParcels() {
        Tenant tenant = getAuthenticatedTenant();
        if (tenant == null) {
            return ResponseEntity.ok(new ArrayList<>());
        }

        List<com.stayeaze.backend.payload.response.ParcelDTO> parcels = parcelRepository.findByTenant(tenant)
                .stream()
                .map(com.stayeaze.backend.payload.response.ParcelDTO::fromEntity)
                .toList();

        return ResponseEntity.ok(parcels);
    }
}
