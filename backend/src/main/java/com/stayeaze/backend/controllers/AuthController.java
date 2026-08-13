package com.stayeaze.backend.controllers;

import com.stayeaze.backend.exception.TokenRefreshException;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.LoginRequest;
import com.stayeaze.backend.payload.request.RegisterRequest;
import com.stayeaze.backend.payload.request.TokenRefreshRequest;
import com.stayeaze.backend.payload.response.JwtResponse;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.payload.response.TokenRefreshResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.jwt.JwtUtils;
import com.stayeaze.backend.security.services.RefreshTokenService;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import com.stayeaze.backend.services.AuditLogService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    RoleRepository roleRepository;

    @Autowired
    OrganizationRepository organizationRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    AuditLogService auditLogService;

    @Autowired
    com.stayeaze.backend.repository.PropertyRepository propertyRepository;

    @Autowired
    com.stayeaze.backend.repository.OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    com.stayeaze.backend.repository.SystemConfigRepository systemConfigRepository;

    @Autowired
    com.stayeaze.backend.repository.BuildingRepository buildingRepository;

    @Autowired
    com.stayeaze.backend.repository.FloorRepository floorRepository;

    @Autowired
    com.stayeaze.backend.repository.RoomRepository roomRepository;

    @Autowired
    com.stayeaze.backend.repository.BedRepository bedRepository;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Email is already registered!"));
        }

        if (userRepository.existsByMobile(registerRequest.getMobile())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Mobile number is already registered!"));
        }

        // Create Organization subdomain from organization name (lowercase alphanumeric)
        String subdomain = registerRequest.getOrgName().toLowerCase().replaceAll("[^a-z0-9]", "");
        if (subdomain.isEmpty()) {
            subdomain = "org" + System.currentTimeMillis();
        }
        
        // Ensure subdomain is unique
        String originalSubdomain = subdomain;
        int count = 1;
        while (organizationRepository.existsBySubdomain(subdomain)) {
            subdomain = originalSubdomain + count;
            count++;
        }

        // Create new organization
        Organization organization = new Organization(registerRequest.getOrgName(), subdomain);
        organization = organizationRepository.save(organization);

        // Create new user (Owner/Admin)
        User user = new User(organization,
                registerRequest.getEmail(),
                encoder.encode(registerRequest.getPassword()),
                registerRequest.getMobile());

        // Assign OWNER role (bootstrap if roles do not exist in DB)
        Set<Role> roles = new HashSet<>();
        Role ownerRole = roleRepository.findByName(ERole.OWNER)
                .orElseGet(() -> {
                    Role role = new Role(ERole.OWNER, "[\"ALL\"]");
                    return roleRepository.save(role);
                });
        roles.add(ownerRole);
        user.setRoles(roles);

        userRepository.save(user);

        return ResponseEntity.ok(new MessageResponse("Organization and Admin user registered successfully! Access subdomain: " + subdomain));
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();

        String jwt = jwtUtils.generateJwtToken(authentication);

        List<String> roles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        // Clear existing refresh tokens first
        refreshTokenService.deleteByUserId(userDetails.getId());
        
        // Generate new refresh token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());

        auditLogService.log("User logged in successfully.", null);

        return ResponseEntity.ok(new JwtResponse(jwt,
                refreshToken.getToken(),
                userDetails.getId(),
                userDetails.getEmail(),
                userDetails.getOrgId(),
                roles));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() instanceof String) {
            return ResponseEntity.status(401).body(new MessageResponse("Not authenticated"));
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        return ResponseEntity.ok(new java.util.HashMap<String, Object>() {{
            put("email", userDetails.getEmail());
            put("roles", userDetails.getAuthorities().stream().map(item -> item.getAuthority()).collect(Collectors.toList()));
        }});
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@Valid @RequestBody TokenRefreshRequest request) {
        String requestRefreshToken = request.getRefreshToken();

        return refreshTokenService.findByToken(requestRefreshToken)
                .map(refreshTokenService::verifyExpiration)
                .map(RefreshToken::getUser)
                .map(user -> {
                    String token = jwtUtils.generateTokenFromUsername(user.getEmail());
                    return ResponseEntity.ok(new TokenRefreshResponse(token, requestRefreshToken));
                })
                .orElseThrow(() -> new TokenRefreshException(requestRefreshToken, "Refresh token is not in database!"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (userDetails != null) {
            refreshTokenService.deleteByUserId(userDetails.getId());
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(new MessageResponse("Log out successful!"));
    }

    @GetMapping("/check-subdomain")
    public ResponseEntity<?> checkSubdomain(@RequestParam String subdomain) {
        if (subdomain == null || subdomain.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Subdomain is required"));
        }
        String cleanSub = subdomain.trim().toLowerCase().replaceAll("[^a-z0-9-]", "");
        boolean exists = organizationRepository.existsBySubdomain(cleanSub);
        java.util.Map<String, Object> map = new java.util.HashMap<>();
        map.put("subdomain", cleanSub);
        map.put("available", !exists);
        return ResponseEntity.ok(map);
    }

    @PostMapping("/create-subscription-order")
    public ResponseEntity<?> createSubscriptionOrder(@Valid @RequestBody com.stayeaze.backend.payload.request.OnboardingRequest req) {
        if (userRepository.existsByEmail(req.getOwnerEmail())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Owner Email is already registered!"));
        }
        if (userRepository.existsByMobile(req.getOwnerPhone())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number is already registered!"));
        }

        String cleanSub = req.getOrgSubdomain().trim().toLowerCase().replaceAll("[^a-z0-9-]", "");
        if (organizationRepository.existsBySubdomain(cleanSub)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Subdomain '" + cleanSub + "' is already taken. Please choose another subdomain."));
        }

        // Fetch Super Admin Master Razorpay Credentials from SystemConfig
        String activeKeyId = "rzp_test_StayeazeMasterKey";
        String activeKeySecret = "mockSecret123";

        java.util.Optional<SystemConfig> sysOpt = systemConfigRepository.findAll().stream().findFirst();
        if (sysOpt.isPresent() && sysOpt.get().getRazorpayKeyId() != null && !sysOpt.get().getRazorpayKeyId().isBlank()) {
            activeKeyId = sysOpt.get().getRazorpayKeyId().trim();
            if (sysOpt.get().getRazorpayKeySecret() != null && !sysOpt.get().getRazorpayKeySecret().isBlank()) {
                activeKeySecret = sysOpt.get().getRazorpayKeySecret().trim();
            }
        }

        java.math.BigDecimal price = req.isTrial() ? java.math.BigDecimal.ZERO : (req.getPlanPrice() != null ? req.getPlanPrice() : new java.math.BigDecimal("1499"));
        long amountInPaise = price.multiply(new java.math.BigDecimal(100)).longValue();
        String orderId = "sub_order_" + System.currentTimeMillis() + "_" + java.util.UUID.randomUUID().toString().substring(0, 8);

        if (!req.isTrial() && activeKeyId.startsWith("rzp_") && !activeKeyId.contains("MasterKey") && activeKeySecret != null && !activeKeySecret.contains("mockSecret")) {
            try {
                com.razorpay.RazorpayClient razorpayClient = new com.razorpay.RazorpayClient(activeKeyId, activeKeySecret);
                org.json.JSONObject orderReq = new org.json.JSONObject();
                orderReq.put("amount", amountInPaise);
                orderReq.put("currency", "INR");
                orderReq.put("receipt", "SaaS-" + req.getOrgSubdomain());
                com.razorpay.Order order = razorpayClient.orders.create(orderReq);
                if (order.has("id")) {
                    orderId = order.get("id");
                }
            } catch (Exception ignored) {}
        }

        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("orderId", orderId);
        res.put("keyId", activeKeyId);
        res.put("amount", amountInPaise);
        res.put("currency", "INR");
        res.put("planName", req.getPlanName());
        res.put("subdomain", cleanSub);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/complete-onboarding")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> completeOnboarding(@Valid @RequestBody com.stayeaze.backend.payload.request.OnboardingRequest req) {
        if (userRepository.existsByEmail(req.getOwnerEmail())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Owner Email is already registered!"));
        }
        if (userRepository.existsByMobile(req.getOwnerPhone())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number is already registered!"));
        }

        String cleanSub = req.getOrgSubdomain().trim().toLowerCase().replaceAll("[^a-z0-9-]", "");
        if (organizationRepository.existsBySubdomain(cleanSub)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Subdomain '" + cleanSub + "' is already taken."));
        }

        // 1. Create Organization
        Organization savedOrg = organizationRepository.save(new Organization(req.getOrgName().trim(), cleanSub));

        // 2. Create Owner Account (ROLE_OWNER & ROLE_ADMIN)
        User owner = new User(savedOrg, req.getOwnerEmail().trim().toLowerCase(), encoder.encode(req.getOwnerPassword()), req.getOwnerPhone().trim());
        owner.setFirstName(req.getOwnerName());
        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElseGet(() -> roleRepository.save(new Role(ERole.OWNER, "[\"ALL\"]")));
        Role adminRole = roleRepository.findByName("ROLE_ADMIN").orElseGet(() -> roleRepository.save(new Role("ROLE_ADMIN", "[\"ALL\"]")));
        Set<Role> roles = new HashSet<>();
        roles.add(ownerRole);
        roles.add(adminRole);
        owner.setRoles(roles);

        // 3. Create Property with all compulsory fields
        Property property = new Property(savedOrg, req.getPropertyName().trim(), req.getAddress().trim());
        property.setCode(req.getPropertyCode().trim().toUpperCase());
        property.setType(req.getPropertyType() != null ? req.getPropertyType() : "PG");
        property.setCity(req.getCity().trim());
        property.setState(req.getState().trim());
        property.setPincode(req.getPincode().trim());
        property.setManager(req.getManager() != null && !req.getManager().isBlank() ? req.getManager().trim() : req.getOwnerName());
        property.setPhone(req.getPhone() != null && !req.getPhone().isBlank() ? req.getPhone().trim() : req.getOwnerPhone());
        property.setEmail(req.getEmail() != null && !req.getEmail().isBlank() ? req.getEmail().trim() : req.getOwnerEmail());
        if (req.getLandlordPan() != null) property.setLandlordPan(req.getLandlordPan().trim());
        if (req.getPgLicenseNo() != null) property.setPgLicenseNo(req.getPgLicenseNo().trim());
        if (req.getBankAccountName() != null) property.setBankAccountName(req.getBankAccountName().trim());
        if (req.getBankName() != null) property.setBankName(req.getBankName().trim());
        if (req.getBankAccountNumber() != null) property.setBankAccountNumber(req.getBankAccountNumber().trim());
        if (req.getBankIfsc() != null) property.setBankIfsc(req.getBankIfsc().trim());
        if (req.getUpiVpa() != null) property.setUpiVpa(req.getUpiVpa().trim());
        if (req.getAuthorizedSignatory() != null) property.setAuthorizedSignatory(req.getAuthorizedSignatory().trim());

        Property savedProperty = propertyRepository.save(property);

        java.util.List<java.util.UUID> pIds = new java.util.ArrayList<>();
        pIds.add(savedProperty.getId());
        owner.setPropertyIds(pIds);
        userRepository.save(owner);

        // 4. Create Organization Billing Profile & SaaS Subscription Record
        OrganizationBillingProfile bp = organizationBillingProfileRepository.findByOrganization(savedOrg)
                .orElseGet(() -> new OrganizationBillingProfile(savedOrg));
        bp.setLegalName(req.getOrgName());
        bp.setBillingAddress(req.getAddress());
        bp.setCity(req.getCity());
        bp.setState(req.getState());
        bp.setPincode(req.getPincode());
        bp.setSupportEmail(req.getOwnerEmail());
        bp.setSupportPhone(req.getOwnerPhone());
        if (req.getGstin() != null) bp.setGstin(req.getGstin().trim());
        bp.setBankAccountName(req.getBankAccountName());
        bp.setBankName(req.getBankName());
        bp.setBankAccountNumber(req.getBankAccountNumber());
        bp.setBankIfsc(req.getBankIfsc());
        bp.setUpiVpa(req.getUpiVpa());

        bp.setSubscriptionPlanName(req.getPlanName() != null ? req.getPlanName() : "Starter PG Plan");
        bp.setSubscriptionPlanPrice(req.getPlanPrice() != null ? req.getPlanPrice() : new java.math.BigDecimal("1499"));
        bp.setSubscriptionBillingCycle(req.getBillingCycle() != null ? req.getBillingCycle() : "MONTHLY");
        bp.setSubscriptionStartDate(java.time.OffsetDateTime.now());
        bp.setSubscriptionEndDate(req.isTrial() ? java.time.OffsetDateTime.now().plusDays(14) : ("ANNUAL".equalsIgnoreCase(req.getBillingCycle()) ? java.time.OffsetDateTime.now().plusYears(1) : java.time.OffsetDateTime.now().plusMonths(1)));
        bp.setSubscriptionStatus(req.isTrial() ? "TRIAL" : "ACTIVE");
        bp.setSubscriptionPaymentId(req.getRazorpayPaymentId() != null ? req.getRazorpayPaymentId() : "pay_sub_" + System.currentTimeMillis());
        bp.setSubscriptionOrderId(req.getRazorpayOrderId());
        organizationBillingProfileRepository.save(bp);

        // 5. Optional Demo / Sample Data Seeding
        if (req.isSeedSampleData()) {
            try {
                Building b = new Building(savedProperty, "Tower A", "BLD-A");
                b = buildingRepository.save(b);

                Floor f1 = new Floor(b, 1);
                f1 = floorRepository.save(f1);

                Floor f2 = new Floor(b, 2);
                f2 = floorRepository.save(f2);

                Room r101 = new Room(f1, "101", "NON_AC", new java.math.BigDecimal("8500"));
                r101 = roomRepository.save(r101);

                Room r102 = new Room(f1, "102", "AC", new java.math.BigDecimal("9500"));
                r102 = roomRepository.save(r102);

                bedRepository.save(new Bed(r101, "101-A"));
                bedRepository.save(new Bed(r101, "101-B"));
                bedRepository.save(new Bed(r102, "102-A"));
                bedRepository.save(new Bed(r102, "102-B"));
            } catch (Exception ignored) {}
        }

        // 6. Generate Authentication JWT Token & Auto-Login Response
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getOwnerEmail().trim().toLowerCase(), req.getOwnerPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();

        String jwt = jwtUtils.generateJwtToken(authentication);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());

        List<String> userRoles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        return ResponseEntity.ok(new JwtResponse(jwt,
                refreshToken.getToken(),
                userDetails.getId(),
                userDetails.getEmail(),
                userDetails.getOrgId(),
                userRoles));
    }
}
