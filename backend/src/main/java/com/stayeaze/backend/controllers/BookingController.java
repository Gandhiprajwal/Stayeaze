package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.BookingRequest;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1")
public class BookingController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    private com.stayeaze.backend.services.AccountUniquenessService accountUniquenessService;

    @Autowired
    private com.stayeaze.backend.services.InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.security.SecurityUtils securityUtils;

    private Organization getLoggedUserOrg() {
        Organization org = securityUtils.getCurrentOrganization();
        if (org != null) return org;
        return organizationRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Logged in Organization not found"));
    }

    private Map<String, Object> formatBooking(Booking b) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", b.getId());
        map.put("bookingCode", b.getBookingCode() != null ? b.getBookingCode() : ("BKG/PROP/2026-27/" + b.getId().toString().substring(0, 4).toUpperCase()));
        
        String tName = b.getTenantName();
        String tEmail = b.getTenantEmail();
        String tPhone = b.getTenantPhone();
        try {
            if (b.getTenant() != null) {
                if (tName == null || tName.isBlank()) tName = b.getTenant().getFirstName() + " " + (b.getTenant().getLastName() != null ? b.getTenant().getLastName() : "");
                if (tEmail == null || tEmail.isBlank()) tEmail = b.getTenant().getEmail();
                if (tPhone == null || tPhone.isBlank()) tPhone = b.getTenant().getMobile();
            }
        } catch (Exception ignored) {}
        map.put("tenantName", tName != null ? tName : "Guest");
        map.put("tenantEmail", tEmail != null ? tEmail : "");
        map.put("tenantPhone", tPhone != null ? tPhone : "");

        UUID propId = b.getPropertyId();
        try {
            if (propId == null && b.getTenant() != null) propId = b.getTenant().getPropertyId();
        } catch (Exception ignored) {}
        try {
            if (propId == null && b.getBed() != null && b.getBed().getRoom() != null && b.getBed().getRoom().getFloor() != null && b.getBed().getRoom().getFloor().getBuilding() != null) {
                propId = b.getBed().getRoom().getFloor().getBuilding().getProperty().getId();
            }
        } catch (Exception ignored) {}
        if (propId == null) {
            try {
                Organization org = getLoggedUserOrg();
                if (org != null) {
                    propId = propertyRepository.findAll().stream().filter(p -> p.getOrganization() != null && p.getOrganization().getId().equals(org.getId())).map(Property::getId).findFirst().orElse(null);
                }
            } catch (Exception ignored) {}
        }
        map.put("propertyId", propId);

        String rNum = b.getRoomNumber();
        try {
            if (rNum == null && b.getBed() != null && b.getBed().getRoom() != null) rNum = b.getBed().getRoom().getRoomNumber();
        } catch (Exception ignored) {}
        map.put("roomNumber", rNum != null ? rNum : "101");

        String bNum = b.getBedNumber();
        try {
            if (bNum == null && b.getBed() != null) bNum = b.getBed().getBedNumber();
        } catch (Exception ignored) {}
        map.put("bedNumber", bNum != null ? bNum : "B1");

        map.put("checkInDate", b.getCheckinDate() != null ? b.getCheckinDate().toString() : java.time.LocalDate.now().toString());
        map.put("durationMonths", b.getDurationMonths() != null ? b.getDurationMonths() : 6);
        map.put("rent", b.getRentAgreed() != null ? b.getRentAgreed() : 8000);
        map.put("deposit", b.getDepositAgreed() != null ? b.getDepositAgreed() : 16000);

        map.put("advanceAmount", b.getAdvanceAmount() != null ? b.getAdvanceAmount() : java.math.BigDecimal.ZERO);
        map.put("advancePaymentStatus", b.getAdvancePaymentStatus() != null ? b.getAdvancePaymentStatus() : "PENDING");
        map.put("paymentMethod", b.getPaymentMethod());
        map.put("razorpayPaymentId", b.getRazorpayPaymentId());
        map.put("razorpayOrderId", b.getRazorpayOrderId());

        String st = b.getStatus();
        map.put("status", st != null ? st.toLowerCase() : "pending");

        String src = b.getSource();
        map.put("source", src != null ? src.toLowerCase() : "direct");
        map.put("notes", b.getNotes() != null ? b.getNotes() : "");
        map.put("createdAt", b.getCreatedAt());

        return map;
    }

    @PostMapping("/tenants/{tenantId}/bookings")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createBooking(@PathVariable UUID tenantId, @Valid @RequestBody BookingRequest request) {
        Organization organization = getLoggedUserOrg();
        
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant not found."));
        }

        Bed bed = request.getBedId() != null ? bedRepository.findById(request.getBedId()).orElse(null) : null;
        if (bed != null && !"AVAILABLE".equalsIgnoreCase(bed.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Bed is not available. Current status: " + bed.getStatus()));
        }

        if (bed != null) {
            bed.setStatus("OCCUPIED");
            bedRepository.save(bed);
        }

        java.math.BigDecimal rent = request.getRentAgreed() != null ? request.getRentAgreed() : java.math.BigDecimal.valueOf(8000);
        java.math.BigDecimal deposit = request.getDepositAgreed() != null ? request.getDepositAgreed() : java.math.BigDecimal.valueOf(16000);
        java.time.LocalDate checkin = request.getCheckinDate() != null ? request.getCheckinDate() : java.time.LocalDate.now();

        Booking booking = new Booking(tenant, bed, checkin, rent, deposit);
        if (request.getStatus() != null) booking.setStatus(request.getStatus().toUpperCase());
        Booking saved = bookingRepository.save(booking);

        return new ResponseEntity<>(formatBooking(saved), HttpStatus.CREATED);
    }

    @PostMapping("/bookings/order")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('ADMIN')")
    public ResponseEntity<?> createBookingOrder(@RequestBody java.util.Map<String, Object> req) {
        Organization organization = getLoggedUserOrg();
        UUID propertyId = null;
        if (req.get("propertyId") != null && !req.get("propertyId").toString().isBlank()) {
            try { propertyId = UUID.fromString(req.get("propertyId").toString()); } catch (Exception ignored) {}
        }
        
        java.math.BigDecimal advanceAmount = java.math.BigDecimal.ZERO;
        if (req.get("advanceAmount") != null) {
            try { advanceAmount = new java.math.BigDecimal(req.get("advanceAmount").toString()); } catch (Exception ignored) {}
        }

        if (advanceAmount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Advance deposit amount must be greater than zero."));
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

        long amountInPaise = advanceAmount.multiply(new java.math.BigDecimal(100)).longValue();
        String orderId = "order_bk_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);

        if (activeKeyId.startsWith("rzp_") && !activeKeyId.contains("MockKey")
                && activeKeySecret != null && !activeKeySecret.contains("mockSecret")) {
            try {
                com.razorpay.RazorpayClient razorpayClient = new com.razorpay.RazorpayClient(activeKeyId, activeKeySecret);
                org.json.JSONObject orderReq = new org.json.JSONObject();
                orderReq.put("amount", amountInPaise);
                orderReq.put("currency", "INR");
                orderReq.put("receipt", "BK-" + (System.currentTimeMillis() % 1000000L));
                com.razorpay.Order order = razorpayClient.orders.create(orderReq);
                if (order.has("id")) {
                    orderId = order.get("id");
                }
            } catch (Exception e) {
                System.err.println("Razorpay client error during booking order creation: " + e.getMessage());
            }
        }

        java.util.Map<String, Object> orderPayload = new java.util.HashMap<>();
        orderPayload.put("orderId", orderId);
        orderPayload.put("keyId", activeKeyId);
        orderPayload.put("amount", amountInPaise);
        orderPayload.put("amountFormatted", advanceAmount);
        orderPayload.put("currency", "INR");
        orderPayload.put("tenantName", req.get("tenantName") != null ? req.get("tenantName").toString() : "Guest");
        orderPayload.put("tenantEmail", req.get("tenantEmail") != null ? req.get("tenantEmail").toString() : "guest@stayeaze.com");
        orderPayload.put("tenantPhone", req.get("tenantPhone") != null ? req.get("tenantPhone").toString() : "9876543210");

        return ResponseEntity.ok(orderPayload);
    }

    @PostMapping("/bookings")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> createFlatBooking(@RequestBody BookingRequest request) {
        try {
            Organization organization = getLoggedUserOrg();

            if (request.getTenantEmail() != null || request.getTenantPhone() != null) {
                try {
                    accountUniquenessService.validateTenantEmailAndMobile(
                        organization,
                        request.getTenantEmail(),
                        request.getTenantPhone(),
                        null,
                        null
                    );
                } catch (IllegalArgumentException ex) {
                    return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
            }

            // Find or create tenant stub safely
            Tenant tenant = null;
            if (request.getTenantPhone() != null && !request.getTenantPhone().isBlank()) {
                tenant = tenantRepository.findFirstByMobile(request.getTenantPhone()).orElse(null);
            }
            if (tenant == null && request.getTenantEmail() != null && !request.getTenantEmail().isBlank()) {
                tenant = tenantRepository.findFirstByEmail(request.getTenantEmail()).orElse(null);
            }

            java.math.BigDecimal rent = request.getRentAgreed() != null ? request.getRentAgreed() : java.math.BigDecimal.valueOf(8000);
            java.math.BigDecimal deposit = request.getDepositAgreed() != null ? request.getDepositAgreed() : java.math.BigDecimal.valueOf(16000);
            java.time.LocalDate checkin = request.getCheckinDate() != null ? request.getCheckinDate() : java.time.LocalDate.now();
            int duration = request.getDurationMonths() != null ? request.getDurationMonths() : 6;

            if (tenant == null) {
                String fName = request.getTenantName() != null && !request.getTenantName().isBlank() ? request.getTenantName().trim() : "Guest";
                String lName = "-";
                if (fName.contains(" ")) {
                    String[] parts = fName.split("\\s+", 2);
                    fName = parts[0];
                    lName = parts[1];
                }
                if (lName.isBlank()) lName = "-";
                String mobile = request.getTenantPhone() != null && !request.getTenantPhone().isBlank() ? request.getTenantPhone() : ("9" + (System.currentTimeMillis() % 1000000000L));
                tenant = new Tenant(organization, fName, lName, mobile);
                tenant.setEmail(request.getTenantEmail() != null && !request.getTenantEmail().isBlank() ? request.getTenantEmail() : ("guest" + System.currentTimeMillis() + "@stayeaze.com"));
            }

            if (request.getPropertyId() != null) tenant.setPropertyId(request.getPropertyId());
            if (request.getRoomNumber() != null) tenant.setRoomNumber(request.getRoomNumber());
            if (request.getBedNumber() != null) tenant.setBedNumber(request.getBedNumber());
            tenant.setRent(rent);
            tenant.setDeposit(deposit);
            tenant.setLeaseStart(checkin.toString());
            tenant.setLeaseEnd(checkin.plusMonths(duration).toString());
            if (tenant.getStatus() == null || !"ACTIVE".equalsIgnoreCase(tenant.getStatus())) {
                tenant.setStatus("PENDING_CHECKIN");
            }
            tenant = tenantRepository.save(tenant);

            Bed bed = null;
            if (request.getBedId() != null) {
                bed = bedRepository.findById(request.getBedId()).orElse(null);
            }

            Property prop = null;
            if (request.getPropertyId() != null) {
                prop = propertyRepository.findById(request.getPropertyId()).orElse(null);
            } else if (tenant != null && tenant.getPropertyId() != null) {
                prop = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
            }

            Booking booking = new Booking(tenant, bed, checkin, rent, deposit);
            String bCode = request.getBookingCode();
            if (bCode == null || bCode.isBlank()) {
                bCode = invoiceSequenceService.nextBookingCode(prop, organization);
            }
            booking.setBookingCode(bCode);
            if (request.getTenantName() != null) booking.setTenantName(request.getTenantName());
            if (request.getTenantEmail() != null) booking.setTenantEmail(request.getTenantEmail());
            if (request.getTenantPhone() != null) booking.setTenantPhone(request.getTenantPhone());
            if (request.getPropertyId() != null) booking.setPropertyId(request.getPropertyId());
            if (request.getRoomNumber() != null) booking.setRoomNumber(request.getRoomNumber());
            if (request.getBedNumber() != null) booking.setBedNumber(request.getBedNumber());
            booking.setDurationMonths(duration);
            if (request.getStatus() != null) booking.setStatus(request.getStatus().toUpperCase());
            if (request.getSource() != null) booking.setSource(request.getSource());
            if (request.getNotes() != null) booking.setNotes(request.getNotes());

            if (request.getAdvanceAmount() != null) booking.setAdvanceAmount(request.getAdvanceAmount());
            if (request.getPaymentMethod() != null) booking.setPaymentMethod(request.getPaymentMethod());
            if (request.getRazorpayOrderId() != null) booking.setRazorpayOrderId(request.getRazorpayOrderId());
            if (request.getRazorpayPaymentId() != null) booking.setRazorpayPaymentId(request.getRazorpayPaymentId());
            if (request.getRazorpaySignature() != null) booking.setRazorpaySignature(request.getRazorpaySignature());

            String pMethod = request.getPaymentMethod();
            boolean isPaid = "RAZORPAY".equalsIgnoreCase(pMethod) || "CASH".equalsIgnoreCase(pMethod) || "BANK_TRANSFER".equalsIgnoreCase(pMethod) || "UPI".equalsIgnoreCase(pMethod);
            if (isPaid || (request.getAdvanceAmount() != null && request.getAdvanceAmount().compareTo(java.math.BigDecimal.ZERO) > 0 && request.getRazorpayPaymentId() != null)) {
                booking.setAdvancePaymentStatus("PAID");
            } else {
                booking.setAdvancePaymentStatus("PENDING");
            }

            Booking saved = bookingRepository.save(booking);

            // Auto-create CheckIn record
            try {
                UUID propId = request.getPropertyId();
                if (propId == null && tenant != null) propId = tenant.getPropertyId();
                if (propId == null) {
                    List<Property> props = propertyRepository.findByOrganization(organization);
                    if (props != null && !props.isEmpty()) propId = props.get(0).getId();
                }

                if (propId != null) {
                    CheckIn checkIn = new CheckIn();
                    checkIn.setOrganization(organization);
                    checkIn.setTenantName(tenant != null ? (tenant.getFirstName() + " " + tenant.getLastName()).trim() : (request.getTenantName() != null ? request.getTenantName() : "Guest"));
                    checkIn.setTenantEmail(saved.getTenantEmail() != null ? saved.getTenantEmail() : (tenant != null ? tenant.getEmail() : null));
                    checkIn.setTenantPhone(saved.getTenantPhone() != null ? saved.getTenantPhone() : (tenant != null ? tenant.getMobile() : null));
                    checkIn.setPropertyId(propId);
                    checkIn.setRoomNumber(request.getRoomNumber() != null ? request.getRoomNumber() : (tenant != null && tenant.getRoomNumber() != null ? tenant.getRoomNumber() : "101"));
                    checkIn.setBedNumber(request.getBedNumber() != null ? request.getBedNumber() : (tenant != null && tenant.getBedNumber() != null ? tenant.getBedNumber() : "B1"));
                    checkIn.setRent(saved.getRentAgreed() != null ? saved.getRentAgreed() : java.math.BigDecimal.valueOf(8000));
                    checkIn.setDepositPaid(saved.getDepositAgreed() != null ? saved.getDepositAgreed() : java.math.BigDecimal.valueOf(16000));
                    if (saved.getAdvanceAmount() != null) {
                        checkIn.setAdvanceAmount(saved.getAdvanceAmount());
                    }
                    checkIn.setCheckInDate(saved.getCheckinDate() != null ? saved.getCheckinDate() : java.time.LocalDate.now());
                    checkIn.setStatus("pending");
                    checkIn.setBookingId(saved.getId());
                    checkIn.setCode(invoiceSequenceService.nextCheckInCode(prop, organization));
                    checkInRepository.save(checkIn);
                }
            } catch(Exception ex) {
                ex.printStackTrace();
            }

            // Auto-create Advance Invoice & Payment Record if paid
            try {
                if ("PAID".equalsIgnoreCase(saved.getAdvancePaymentStatus()) && saved.getAdvanceAmount() != null && saved.getAdvanceAmount().compareTo(java.math.BigDecimal.ZERO) > 0 && tenant != null) {
                    Invoice advInv = new Invoice();
                    advInv.setTenant(tenant);
                    advInv.setInvoiceNumber("ADV-" + (saved.getBookingCode() != null ? saved.getBookingCode().replace("BK-", "") : (System.currentTimeMillis() % 1000000L)));
                    advInv.setAmountDue(saved.getAdvanceAmount());
                    advInv.setAmountPaid(saved.getAdvanceAmount());
                    advInv.setStatus("PAID");
                    advInv.setIssueDate(java.time.LocalDate.now());
                    advInv.setDueDate(java.time.LocalDate.now());
                    advInv.setPaymentMethod(saved.getPaymentMethod() != null ? saved.getPaymentMethod().toUpperCase() : "CASH");
                    advInv.setRazorpayPaymentId(saved.getRazorpayPaymentId());
                    advInv.setRazorpayOrderId(saved.getRazorpayOrderId());
                    advInv.setPaymentReference(saved.getRazorpayPaymentId() != null ? saved.getRazorpayPaymentId() : ("ADV-REC-" + System.currentTimeMillis()));

                    InvoiceItem advItem = new InvoiceItem(advInv, "Advance Room Reservation Deposit (" + saved.getBookingCode() + ")", saved.getAdvanceAmount());
                    advInv.getItems().add(advItem);
                    Invoice savedAdvInv = invoiceRepository.save(advInv);

                    Payment advPayment = new Payment();
                    advPayment.setInvoice(savedAdvInv);
                    advPayment.setAmount(saved.getAdvanceAmount());
                    advPayment.setPaymentDate(java.time.OffsetDateTime.now());
                    advPayment.setPaymentMethod(saved.getPaymentMethod() != null ? saved.getPaymentMethod().toUpperCase() : "CASH");
                    advPayment.setReceiptNumber("REC-" + saved.getBookingCode());
                    advPayment.setTransactionReference(saved.getRazorpayPaymentId() != null ? saved.getRazorpayPaymentId() : ("BK-OFFLINE-" + System.currentTimeMillis()));
                    advPayment.setStatus("COMPLETED");
                    paymentRepository.save(advPayment);
                }
            } catch (Exception advEx) {
                System.err.println("Failed to auto-create Advance Booking Invoice/Payment: " + advEx.getMessage());
            }

            // Dispatch Advance Deposit Receipt Email if paid
            try {
                if ("PAID".equalsIgnoreCase(saved.getAdvancePaymentStatus()) && saved.getAdvanceAmount() != null && saved.getAdvanceAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
                    String recipientEmail = saved.getTenantEmail() != null ? saved.getTenantEmail() : (tenant != null ? tenant.getEmail() : null);
                    if (recipientEmail != null && !recipientEmail.isBlank()) {
                        String propName = "StayEaze Property";
                        if (request.getPropertyId() != null) {
                            Property p = propertyRepository.findById(request.getPropertyId()).orElse(null);
                            if (p != null) propName = p.getName();
                        }
                        String roomBed = "Room " + (saved.getRoomNumber() != null ? saved.getRoomNumber() : "-") + " / Bed " + (saved.getBedNumber() != null ? saved.getBedNumber() : "-");
                        emailService.sendAdvancePaymentReceipt(
                            recipientEmail,
                            saved.getTenantName(),
                            saved.getBookingCode(),
                            propName,
                            roomBed,
                            saved.getAdvanceAmount(),
                            saved.getPaymentMethod(),
                            saved.getRazorpayPaymentId() != null ? saved.getRazorpayPaymentId() : saved.getRazorpayOrderId(),
                            saved.getCheckinDate() != null ? saved.getCheckinDate().toString() : java.time.LocalDate.now().toString()
                        );
                    }
                }
            } catch (Exception mailEx) {
                mailEx.printStackTrace();
            }

            occupancySyncService.syncStatsAndEvictCaches(null);
            return new ResponseEntity<>(formatBooking(saved), HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error processing booking: " + e.getMessage()));
        }
    }

    @GetMapping("/bookings/{id}/advance-receipt")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST') or hasRole('TENANT') or hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> getAdvanceReceipt(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking record not found."));
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isSuperAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_SUPER_ADMIN"));
        boolean isTenant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_TENANT"));

        if (!isSuperAdmin) {
            if (isTenant && auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
                boolean matchesTenant = (booking.getTenant() != null && booking.getTenant().getEmail() != null && userDetails.getEmail() != null && booking.getTenant().getEmail().equalsIgnoreCase(userDetails.getEmail()))
                        || (booking.getTenantEmail() != null && userDetails.getEmail() != null && booking.getTenantEmail().equalsIgnoreCase(userDetails.getEmail()));
                if (!matchesTenant) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized access to advance receipt."));
                }
            } else {
                UUID bookingOrgId = (booking.getTenant() != null && booking.getTenant().getOrganization() != null)
                        ? booking.getTenant().getOrganization().getId() : null;
                if (organization != null && bookingOrgId != null && !organization.getId().equals(bookingOrgId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Unauthorized access to advance receipt."));
                }
            }
        }

        String propName = "StayEaze Property";
        if (booking.getPropertyId() != null) {
            Property p = propertyRepository.findById(booking.getPropertyId()).orElse(null);
            if (p != null) propName = p.getName();
        }

        Map<String, Object> receipt = new HashMap<>();
        receipt.put("receiptNumber", "ADV-" + (booking.getBookingCode() != null ? booking.getBookingCode() : booking.getId().toString().substring(0, 8)));
        receipt.put("bookingCode", booking.getBookingCode());
        receipt.put("bookingId", booking.getId());
        receipt.put("tenantName", booking.getTenantName() != null ? booking.getTenantName() : (booking.getTenant() != null ? booking.getTenant().getFirstName() + " " + booking.getTenant().getLastName() : "Guest"));
        receipt.put("tenantEmail", booking.getTenantEmail() != null ? booking.getTenantEmail() : (booking.getTenant() != null ? booking.getTenant().getEmail() : ""));
        receipt.put("tenantPhone", booking.getTenantPhone() != null ? booking.getTenantPhone() : (booking.getTenant() != null ? booking.getTenant().getMobile() : ""));
        receipt.put("propertyName", propName);
        receipt.put("roomNumber", booking.getRoomNumber());
        receipt.put("bedNumber", booking.getBedNumber());
        receipt.put("advanceAmount", booking.getAdvanceAmount() != null ? booking.getAdvanceAmount() : java.math.BigDecimal.ZERO);
        receipt.put("paymentMethod", booking.getPaymentMethod() != null ? booking.getPaymentMethod() : "OFFLINE");
        receipt.put("advancePaymentStatus", booking.getAdvancePaymentStatus() != null ? booking.getAdvancePaymentStatus() : "PENDING");
        receipt.put("transactionId", booking.getRazorpayPaymentId() != null ? booking.getRazorpayPaymentId() : booking.getRazorpayOrderId());
        receipt.put("date", booking.getCreatedAt() != null ? booking.getCreatedAt().toLocalDate().toString() : java.time.LocalDate.now().toString());

        return ResponseEntity.ok(receipt);
    }

    @PutMapping("/bookings/{id}")
    @Transactional
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER') or hasRole('RECEPTIONIST')")
    public ResponseEntity<?> updateBooking(@PathVariable UUID id, @RequestBody BookingRequest request) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null || !booking.getTenant().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking not found."));
        }

        if (request.getCheckinDate() != null) booking.setCheckinDate(request.getCheckinDate());
        if (request.getRentAgreed() != null) booking.setRentAgreed(request.getRentAgreed());
        if (request.getDepositAgreed() != null) booking.setDepositAgreed(request.getDepositAgreed());
        if (request.getStatus() != null) booking.setStatus(request.getStatus().toUpperCase());
        if (request.getTenantName() != null) booking.setTenantName(request.getTenantName());
        if (request.getTenantEmail() != null) booking.setTenantEmail(request.getTenantEmail());
        if (request.getTenantPhone() != null) booking.setTenantPhone(request.getTenantPhone());
        if (request.getPropertyId() != null) booking.setPropertyId(request.getPropertyId());
        if (request.getRoomNumber() != null) booking.setRoomNumber(request.getRoomNumber());
        if (request.getBedNumber() != null) booking.setBedNumber(request.getBedNumber());
        if (request.getDurationMonths() != null) booking.setDurationMonths(request.getDurationMonths());
        if (request.getSource() != null) booking.setSource(request.getSource());
        if (request.getNotes() != null) booking.setNotes(request.getNotes());

        // Update linked tenant entity
        Tenant tenant = booking.getTenant();
        if (tenant != null) {
            if (booking.getRentAgreed() != null) tenant.setRent(booking.getRentAgreed());
            if (booking.getDepositAgreed() != null) tenant.setDeposit(booking.getDepositAgreed());
            if (booking.getPropertyId() != null) tenant.setPropertyId(booking.getPropertyId());
            if (booking.getRoomNumber() != null) tenant.setRoomNumber(booking.getRoomNumber());
            if (booking.getBedNumber() != null) tenant.setBedNumber(booking.getBedNumber());
            if (booking.getCheckinDate() != null) tenant.setLeaseStart(booking.getCheckinDate().toString());
            tenantRepository.save(tenant);
        }

        Booking saved = bookingRepository.save(booking);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(formatBooking(saved));
    }

    @DeleteMapping("/bookings/{id}")
    @PreAuthorize("hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<?> deleteBooking(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null || !booking.getTenant().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking not found."));
        }
        booking.setStatus("CANCELLED");
        bookingRepository.save(booking);
        occupancySyncService.syncStatsAndEvictCaches(null);
        return ResponseEntity.ok(new MessageResponse("Booking cancelled successfully."));
    }

    @GetMapping("/tenants/{tenantId}/bookings")
    public ResponseEntity<?> getTenantBookings(@PathVariable UUID tenantId) {
        Organization organization = getLoggedUserOrg();
        Tenant tenant = tenantRepository.findByIdAndOrganization(tenantId, organization).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Tenant not found."));
        }

        List<Booking> bookings = bookingRepository.findByTenant(tenant);
        List<Map<String, Object>> response = new ArrayList<>();
        for (Booking b : bookings) {
            response.add(formatBooking(b));
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/bookings")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getFlatBookings(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) UUID propertyId) {
        Organization organization = getLoggedUserOrg();
        List<Booking> bookings = bookingRepository.findByOrganizationIdNative(organization.getId());
        List<Map<String, Object>> mapped = bookings.stream().map(this::formatBooking).collect(java.util.stream.Collectors.toList());

        Set<UUID> assignedProps = securityUtils.getAssignedPropertyIds();
        if (assignedProps != null) {
            mapped = mapped.stream().filter(m -> {
                Object pId = m.get("propertyId");
                if (pId == null) return false;
                try {
                    return assignedProps.contains(UUID.fromString(pId.toString()));
                } catch (Exception e) {
                    return false;
                }
            }).collect(java.util.stream.Collectors.toList());
        }

        if (propertyId != null) {
            mapped = mapped.stream().filter(m -> {
                Object pId = m.get("propertyId");
                return pId != null && propertyId.toString().equalsIgnoreCase(pId.toString());
            }).collect(java.util.stream.Collectors.toList());
        }

        return ResponseEntity.ok(com.stayeaze.backend.payload.response.PageResponse.of(mapped, page, pageSize));
    }

    @GetMapping("/bookings/{id}")
    public ResponseEntity<?> getBookingById(@PathVariable UUID id) {
        Organization organization = getLoggedUserOrg();
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null || !booking.getTenant().getOrganization().getId().equals(organization.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Error: Booking not found."));
        }
        if (booking.getPropertyId() != null) {
            securityUtils.validatePropertyAccess(booking.getPropertyId());
        }
        return ResponseEntity.ok(formatBooking(booking));
    }
}
