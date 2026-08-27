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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

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
    com.stayeaze.backend.services.AuditLogService auditLogService;

    @Autowired
    com.stayeaze.backend.services.UserJourneyAuditService userJourneyAuditService;

    @Autowired
    com.stayeaze.backend.services.EmailService emailService;

    @Autowired
    com.stayeaze.backend.security.services.UserDetailsServiceImpl userDetailsService;

    @Autowired
    com.stayeaze.backend.repository.PropertyRepository propertyRepository;

    @Autowired
    com.stayeaze.backend.security.services.TokenBlacklistService tokenBlacklistService;

    @Autowired
    com.stayeaze.backend.repository.OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private com.stayeaze.backend.services.SubscriptionEnforcementService subscriptionEnforcementService;

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

    @Autowired
    com.stayeaze.backend.repository.SystemIntegrationSettingsRepository settingsRepository;

    @Autowired
    com.stayeaze.backend.repository.OnboardingLeadRepository onboardingLeadRepository;

    @Autowired
    com.stayeaze.backend.services.WebSocketNotificationService webSocketNotificationService;

    @GetMapping("/maintenance-status")
    public ResponseEntity<?> getMaintenanceStatus() {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream()
                .findFirst()
                .orElseGet(SystemIntegrationSettings::new);

        Map<String, Object> response = new HashMap<>();
        response.put("maintenanceModeEnabled", Boolean.TRUE.equals(settings.getMaintenanceModeEnabled()));
        response.put("maintenanceMessage", settings.getMaintenanceMessage() != null ? settings.getMaintenanceMessage()
                : "StayEaze is undergoing scheduled maintenance. We will be back shortly.");
        response.put("onboardingMode", settings.getOnboardingMode());
        response.put("onboardingHeadline", settings.getOnboardingHeadline());
        response.put("onboardingMessage", settings.getOnboardingMessage());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/onboarding-status")
    public ResponseEntity<?> getOnboardingStatus() {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream()
                .findFirst()
                .orElseGet(SystemIntegrationSettings::new);

        Map<String, Object> response = new HashMap<>();
        response.put("onboardingMode", settings.getOnboardingMode());
        response.put("onboardingHeadline", settings.getOnboardingHeadline());
        response.put("onboardingMessage", settings.getOnboardingMessage());
        response.put("maintenanceModeEnabled", Boolean.TRUE.equals(settings.getMaintenanceModeEnabled()));
        return ResponseEntity.ok(response);
    }

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

        SystemIntegrationSettings settings = settingsRepository.findAll().stream()
                .findFirst()
                .orElseGet(SystemIntegrationSettings::new);

        String onboardingMode = settings.getOnboardingMode() != null ? settings.getOnboardingMode().toUpperCase().trim() : "ENABLED";
        String vipInviteCodes = settings.getVipInviteCodes() != null ? settings.getVipInviteCodes().toUpperCase() : "";

        boolean hasValidVipCode = false;
        if (registerRequest.getInviteCode() != null && !registerRequest.getInviteCode().isBlank()) {
            String submittedCode = registerRequest.getInviteCode().trim().toUpperCase();
            List<String> validCodes = Arrays.stream(vipInviteCodes.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
            if (validCodes.contains(submittedCode)) {
                hasValidVipCode = true;
            }
        }

        // SCENARIO 1: Onboarding is DISABLED (Invite-Only) and NO valid VIP Invite Code provided
        // -> Interactively capture as an OnboardingLead without throwing a 403 error
        if ("DISABLED".equalsIgnoreCase(onboardingMode) && !hasValidVipCode) {
            String leadCode = "VIP-" + String.valueOf(System.currentTimeMillis()).substring(6);
            OnboardingLead lead = new OnboardingLead(
                    registerRequest.getOwnerName() != null ? registerRequest.getOwnerName() : "Applicant",
                    registerRequest.getEmail().trim().toLowerCase(),
                    registerRequest.getMobile(),
                    registerRequest.getOrgName(),
                    leadCode,
                    "INVITE_REQUESTED",
                    "UNPAID",
                    null
            );
            lead.setSalesNotes("Submitted during VIP Invite-Only mode. Awaiting Super-Admin invite pass.");
            if (registerRequest.getPassword() != null && !registerRequest.getPassword().isBlank()) {
                lead.setPasswordHash(encoder.encode(registerRequest.getPassword()));
            }
            onboardingLeadRepository.save(lead);

            // Real-time alert to Super-Admin
            try {
                Map<String, Object> alert = new HashMap<>();
                alert.put("type", "VIP_LEAD_CAPTURED");
                alert.put("leadId", lead.getId());
                alert.put("ownerName", lead.getOwnerName());
                alert.put("ownerEmail", lead.getOwnerEmail());
                alert.put("orgName", lead.getPropertyName());
                alert.put("message", "New VIP Early Access Lead from " + lead.getOwnerEmail() + " for '" + lead.getPropertyName() + "'");
                webSocketNotificationService.broadcastTopic("/topic/super-admin/leads", alert);
                webSocketNotificationService.broadcastTopic("/topic/super-admin/onboarding", alert);
            } catch (Exception ignored) {}

            // Send VIP Lead Confirmation Email
            try {
                emailService.sendVipLeadConfirmationEmail(
                        lead.getOwnerEmail(),
                        lead.getOwnerName(),
                        lead.getPropertyName(),
                        leadCode
                );
            } catch (Exception ignored) {}

            Map<String, Object> leadRes = new HashMap<>();
            leadRes.put("status", "LEAD_CAPTURED");
            leadRes.put("mode", "DISABLED");
            leadRes.put("leadCode", leadCode);
            leadRes.put("message", "Thank you for your interest! Public instant onboarding is currently invite-only. Our onboarding team has received your application and will contact you within 24 hours with an exclusive invite.");
            return ResponseEntity.ok(leadRes);
        }

        // Determine organization status based on mode and VIP code
        boolean isWaitlist = "WAITLIST".equalsIgnoreCase(onboardingMode) && !hasValidVipCode;
        String orgStatus = isWaitlist ? "PENDING_APPROVAL" : "ACTIVE";

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
        organization.setStatus(orgStatus);
        organization = organizationRepository.save(organization);

        // Create new user (Owner/Admin)
        User user = new User(organization,
                registerRequest.getEmail(),
                encoder.encode(registerRequest.getPassword()),
                registerRequest.getMobile());
        user.setFirstName(registerRequest.getOwnerName() != null ? registerRequest.getOwnerName() : "Owner");
        user.setStatus(orgStatus);

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

        // SCENARIO 2: WAITLIST Mode (Requires Super-Admin review and approval)
        if (isWaitlist) {
            try {
                Map<String, Object> waitlistAlert = new HashMap<>();
                waitlistAlert.put("type", "ORG_WAITLIST_APPLICATION");
                waitlistAlert.put("orgId", organization.getId());
                waitlistAlert.put("orgName", organization.getName());
                waitlistAlert.put("ownerEmail", user.getEmail());
                waitlistAlert.put("subdomain", subdomain);
                waitlistAlert.put("message", "New subscriber waitlist application: '" + organization.getName() + "' by " + user.getEmail());
                webSocketNotificationService.broadcastTopic("/topic/super-admin/onboarding", waitlistAlert);
            } catch (Exception ignored) {}

            Map<String, Object> waitlistRes = new HashMap<>();
            waitlistRes.put("status", "WAITLISTED");
            waitlistRes.put("mode", "WAITLIST");
            waitlistRes.put("subdomain", subdomain);
            waitlistRes.put("message", "Registration submitted! Your organization has been placed on the waitlist pending Super-Admin review and approval.");
            return ResponseEntity.ok(waitlistRes);
        }

        // SCENARIO 3: ENABLED (or VIP code bypassed) -> Instant Active Organization
        Map<String, Object> successRes = new HashMap<>();
        successRes.put("status", "ACTIVE");
        successRes.put("mode", "ENABLED");
        successRes.put("subdomain", subdomain);
        successRes.put("message", "Organization and Admin user registered successfully! Access subdomain: " + subdomain);
        return ResponseEntity.ok(successRes);
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest, jakarta.servlet.http.HttpServletRequest request) {
        String email = loginRequest.getEmail() != null ? loginRequest.getEmail().trim().toLowerCase() : "";
        try {
            // Check Organization Onboarding & User Status before attempting authentication
            Optional<User> userLookup = userRepository.findByEmail(email);
            if (userLookup.isPresent()) {
                User u = userLookup.get();
                Organization org = u.getOrganization();
                String orgStatus = org != null && org.getStatus() != null ? org.getStatus().toUpperCase() : "ACTIVE";
                String userStatus = u.getStatus() != null ? u.getStatus().toUpperCase() : "ACTIVE";

                if ("PENDING_APPROVAL".equals(orgStatus) || "WAITLIST".equals(orgStatus) || "PENDING_APPROVAL".equals(userStatus)) {
                    userJourneyAuditService.logAuth(email, org, u, "LOGIN_BLOCKED", "WARNING", Map.of("reason", "Workspace waitlisted / pending approval"), request);
                    return ResponseEntity.status(403).body(new MessageResponse("Your organization registration is currently on the waitlist awaiting Super-Admin approval. You will receive an email once approved."));
                }
                if ("SUSPENDED".equals(orgStatus) || "DISABLED".equals(orgStatus) || "SUSPENDED".equals(userStatus)) {
                    userJourneyAuditService.logAuth(email, org, u, "LOGIN_BLOCKED", "WARNING", Map.of("reason", "Workspace suspended by administrator"), request);
                    return ResponseEntity.status(403).body(new MessageResponse("Your organization workspace has been suspended. Please contact platform support."));
                }
                if ("REJECTED".equals(orgStatus)) {
                    userJourneyAuditService.logAuth(email, org, u, "LOGIN_BLOCKED", "WARNING", Map.of("reason", "Application declined"), request);
                    return ResponseEntity.status(403).body(new MessageResponse("Your organization registration application was declined. Please contact support."));
                }

                // Stage 2: Post-Grace Period Lockdown — Only OWNER & ADMIN permitted to log in to renew
                if (org != null) {
                    boolean isSuperAdmin = u.getRoles() != null && u.getRoles().stream().anyMatch(r ->
                            r.getName() != null && (r.getName().equalsIgnoreCase("SUPER_ADMIN") || r.getName().equalsIgnoreCase("ROLE_SUPER_ADMIN")));

                    if (!isSuperAdmin && subscriptionEnforcementService.isPostGraceLockout(org)) {
                        boolean isOwnerOrAdmin = u.getRoles() != null && u.getRoles().stream().anyMatch(r ->
                                r.getName() != null && (
                                        r.getName().equalsIgnoreCase("OWNER") || r.getName().equalsIgnoreCase("ROLE_OWNER") ||
                                        r.getName().equalsIgnoreCase("ADMIN") || r.getName().equalsIgnoreCase("ROLE_ADMIN")));

                        if (!isOwnerOrAdmin) {
                            userJourneyAuditService.logAuth(email, org, u, "LOGIN_BLOCKED", "WARNING", Map.of("reason", "Grace period expired; non-admin login locked"), request);
                            return ResponseEntity.status(403).body(new MessageResponse("Your organization workspace subscription has ended and the grace period has expired. Only the Workspace Administrator can log in to renew. Please contact your owner/admin."));
                        }
                    }
                }
            }

            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, loginRequest.getPassword()));

            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            User user = userLookup.orElseGet(() -> userRepository.findById(userDetails.getId()).orElse(null));

            if (user != null && Boolean.TRUE.equals(user.getIsTwoFactorEnabled())) {
                String otp = String.format("%06d", new java.security.SecureRandom().nextInt(1000000));
                user.setTwoFactorOtp(otp);
                user.setTwoFactorOtpExpiry(java.time.OffsetDateTime.now().plusMinutes(5));
                userRepository.save(user);

                try {
                    emailService.sendTwoFactorOtpEmail(user.getEmail(), user.getFirstName(), otp);
                } catch (Exception ignored) {
                }

                userJourneyAuditService.logAuth(email, user.getOrganization(), user, "2FA_CHALLENGE_ISSUED", "PENDING", Map.of("message", "2FA OTP dispatched"), request);

                Map<String, Object> twoFaRes = new HashMap<>();
                twoFaRes.put("requires2FA", true);
                twoFaRes.put("email", user.getEmail());
                twoFaRes.put("otpDev", otp);
                twoFaRes.put("message",
                        "Two-Factor Authentication is enabled. A 6-digit verification code has been sent to your email.");
                return ResponseEntity.ok(twoFaRes);
            }

            if (user != null && Boolean.TRUE.equals(user.getMustChangePassword())) {
                Map<String, Object> pwdRes = new HashMap<>();
                pwdRes.put("mustChangePassword", true);
                pwdRes.put("email", user.getEmail());
                pwdRes.put("message",
                        "First-time login detected. You must set a new password before accessing the platform.");
                return ResponseEntity.ok(pwdRes);
            }

            SecurityContextHolder.getContext().setAuthentication(authentication);

            String jwt = jwtUtils.generateJwtToken(authentication);

            List<String> roles = userDetails.getAuthorities().stream()
                    .map(item -> item.getAuthority())
                    .collect(Collectors.toList());

            // Generate/rotate refresh token in single transaction
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());
            org.springframework.http.ResponseCookie cookie = jwtUtils.generateRefreshTokenCookie(refreshToken.getToken());

            auditLogService.logUser(user, "User logged in successfully.", null);
            userJourneyAuditService.logAuth(email, user != null ? user.getOrganization() : null, user, "LOGIN_SUCCESS", "SUCCESS", Map.of("roles", roles), request);

            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(new JwtResponse(jwt,
                            refreshToken.getToken(),
                            userDetails.getId(),
                            userDetails.getEmail(),
                            user != null && user.getFirstName() != null ? user.getFirstName() : userDetails.getEmail(),
                            user != null ? user.getMobile() : null,
                            user != null ? user.getAvatarUrl() : null,
                            userDetails.getOrgId(),
                            roles));
        } catch (org.springframework.security.core.AuthenticationException e) {
            userJourneyAuditService.logAuth(email, null, null, "LOGIN_FAILED", "FAILURE", Map.of("reason", "Invalid credentials / password mismatch"), request);
            return ResponseEntity.status(401).body(new MessageResponse("Invalid email or password."));
        } catch (Exception e) {
            userJourneyAuditService.logAuth(email, null, null, "LOGIN_ERROR", "FAILURE", Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"), request);
            return ResponseEntity.status(401).body(new MessageResponse("Authentication failed: " + e.getMessage()));
        }
    }

    @PostMapping("/verify-2fa")
    public ResponseEntity<?> verifyTwoFactorOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otp = request.get("otp");

        if (email == null || otp == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Email and OTP code are required."));
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(new MessageResponse("User not found."));
        }

        if (user.getTwoFactorOtp() == null || !user.getTwoFactorOtp().equals(otp.trim())) {
            return ResponseEntity.status(400).body(new MessageResponse("Invalid 2FA verification code."));
        }

        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            Map<String, Object> pwdRes = new HashMap<>();
            pwdRes.put("mustChangePassword", true);
            pwdRes.put("email", user.getEmail());
            pwdRes.put("message",
                    "First-time login detected. You must set a new password before accessing the platform.");
            return ResponseEntity.ok(pwdRes);
        }

        if (user.getTwoFactorOtpExpiry() == null
                || user.getTwoFactorOtpExpiry().isBefore(java.time.OffsetDateTime.now())) {
            return ResponseEntity.status(400)
                    .body(new MessageResponse("2FA OTP code has expired. Please request a new code."));
        }

        // OTP Verified successfully! Clear OTP fields
        user.setTwoFactorOtp(null);
        user.setTwoFactorOtpExpiry(null);
        user.setLastLogin(java.time.OffsetDateTime.now());
        userRepository.save(user);

        UserDetailsImpl userDetails = (UserDetailsImpl) userDetailsService.loadUserByUsername(user.getEmail());
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        String jwt = jwtUtils.generateJwtToken(authentication);

        List<String> roles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        try {
            refreshTokenService.deleteByUserId(userDetails.getId());
        } catch (Exception ignored) {
        }

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());
        org.springframework.http.ResponseCookie cookie = jwtUtils.generateRefreshTokenCookie(refreshToken.getToken());
        auditLogService.log("User logged in successfully via 2FA.", null);

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new JwtResponse(jwt,
                        refreshToken.getToken(),
                        userDetails.getId(),
                        userDetails.getEmail(),
                        user != null && user.getFirstName() != null ? user.getFirstName() : userDetails.getEmail(),
                        user != null ? user.getMobile() : null,
                        user != null ? user.getAvatarUrl() : null,
                        userDetails.getOrgId(),
                        roles));
    }

    @PostMapping("/resend-2fa")
    public ResponseEntity<?> resendTwoFactorOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Email is required."));
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(new MessageResponse("User not found."));
        }

        String otp = String.format("%06d", new java.security.SecureRandom().nextInt(1000000));
        user.setTwoFactorOtp(otp);
        user.setTwoFactorOtpExpiry(java.time.OffsetDateTime.now().plusMinutes(5));
        userRepository.save(user);

        try {
            emailService.sendTwoFactorOtpEmail(user.getEmail(), user.getFirstName(), otp);
        } catch (Exception ignored) {
        }

        Map<String, Object> res = new HashMap<>();
        res.put("message", "A new 2FA code has been sent to your email.");
        res.put("otpDev", otp);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() instanceof String) {
            return ResponseEntity.status(401).body(new MessageResponse("Not authenticated"));
        }
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        return ResponseEntity.ok(new java.util.HashMap<String, Object>() {
            {
                put("email", userDetails.getEmail());
                put("roles", userDetails.getAuthorities().stream().map(item -> item.getAuthority())
                        .collect(Collectors.toList()));
            }
        });
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(jakarta.servlet.http.HttpServletRequest httpRequest,
                                          @RequestBody(required = false) TokenRefreshRequest request) {
        String requestRefreshToken = jwtUtils.getRefreshTokenFromCookies(httpRequest);
        if ((requestRefreshToken == null || requestRefreshToken.isBlank()) && request != null) {
            requestRefreshToken = request.getRefreshToken();
        }

        if (requestRefreshToken == null || requestRefreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new MessageResponse("Refresh token is missing from cookie/request. Please log in."));
        }

        final String finalRefreshToken = requestRefreshToken;
        return refreshTokenService.findByToken(finalRefreshToken)
                .map(refreshTokenService::verifyExpiration)
                .map(token -> {
                    User user = token.getUser();
                    RefreshToken rotatedToken = refreshTokenService.rotateRefreshToken(token);
                    String newJwt = jwtUtils.generateTokenFromUsername(user.getEmail());
                    org.springframework.http.ResponseCookie newCookie = jwtUtils.generateRefreshTokenCookie(rotatedToken.getToken());

                    return ResponseEntity.ok()
                            .header(org.springframework.http.HttpHeaders.SET_COOKIE, newCookie.toString())
                            .body(new TokenRefreshResponse(newJwt, rotatedToken.getToken()));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new TokenRefreshResponse(null, null)));
    }

    @PostMapping({"/logout", "/signout"})
    public ResponseEntity<?> logoutUser(jakarta.servlet.http.HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String jwt = authHeader.substring(7);
            java.util.Date exp = jwtUtils.getExpirationDateFromJwtToken(jwt);
            tokenBlacklistService.blacklistToken(jwt, exp != null ? exp.getTime() : System.currentTimeMillis() + (24 * 60 * 60 * 1000L));
        }

        Object principal = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getPrincipal()
                : null;
        if (principal instanceof UserDetailsImpl userDetails) {
            refreshTokenService.deleteByUserId(userDetails.getId());
        }

        SecurityContextHolder.clearContext();
        org.springframework.http.ResponseCookie cleanCookie = jwtUtils.getCleanRefreshTokenCookie();

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.SET_COOKIE, cleanCookie.toString())
                .body(new MessageResponse("Log out successful!"));
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
    public ResponseEntity<?> createSubscriptionOrder(
            @Valid @RequestBody com.stayeaze.backend.payload.request.OnboardingRequest req) {
        if (userRepository.existsByEmail(req.getOwnerEmail())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Owner Email is already registered!"));
        }
        if (userRepository.existsByMobile(req.getOwnerPhone())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number is already registered!"));
        }

        String cleanSub = req.getOrgSubdomain().trim().toLowerCase().replaceAll("[^a-z0-9-]", "");
        if (organizationRepository.existsBySubdomain(cleanSub)) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                    "Error: Subdomain '" + cleanSub + "' is already taken. Please choose another subdomain."));
        }

        // Fetch Super Admin Master Razorpay Credentials from SystemConfig
        String activeKeyId = "rzp_test_StayeazeMasterKey";
        String activeKeySecret = "mockSecret123";

        java.util.Optional<SystemConfig> sysOpt = systemConfigRepository.findAll().stream().findFirst();
        if (sysOpt.isPresent() && sysOpt.get().getRazorpayKeyId() != null
                && !sysOpt.get().getRazorpayKeyId().isBlank()) {
            activeKeyId = sysOpt.get().getRazorpayKeyId().trim();
            if (sysOpt.get().getRazorpayKeySecret() != null && !sysOpt.get().getRazorpayKeySecret().isBlank()) {
                activeKeySecret = sysOpt.get().getRazorpayKeySecret().trim();
            }
        }

        java.math.BigDecimal price = req.isTrial() ? java.math.BigDecimal.ZERO
                : (req.getPlanPrice() != null ? req.getPlanPrice() : new java.math.BigDecimal("1499"));
        long amountInPaise = price.multiply(new java.math.BigDecimal(100)).longValue();
        String orderId = "sub_order_" + System.currentTimeMillis() + "_"
                + java.util.UUID.randomUUID().toString().substring(0, 8);

        if (!req.isTrial() && activeKeyId.startsWith("rzp_") && !activeKeyId.contains("MasterKey")
                && activeKeySecret != null && !activeKeySecret.contains("mockSecret")) {
            try {
                com.razorpay.RazorpayClient razorpayClient = new com.razorpay.RazorpayClient(activeKeyId,
                        activeKeySecret);
                org.json.JSONObject orderReq = new org.json.JSONObject();
                orderReq.put("amount", amountInPaise);
                orderReq.put("currency", "INR");
                orderReq.put("receipt", "SaaS-" + req.getOrgSubdomain());
                com.razorpay.Order order = razorpayClient.orders.create(orderReq);
                if (order.has("id")) {
                    orderId = order.get("id");
                }
            } catch (Exception ignored) {
            }
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
    public ResponseEntity<?> completeOnboarding(
            @Valid @RequestBody com.stayeaze.backend.payload.request.OnboardingRequest req) {
        if (userRepository.existsByEmail(req.getOwnerEmail())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Owner Email is already registered!"));
        }
        if (userRepository.existsByMobile(req.getOwnerPhone())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Mobile number is already registered!"));
        }

        String cleanSub = req.getOrgSubdomain().trim().toLowerCase().replaceAll("[^a-z0-9-]", "");
        if (organizationRepository.existsBySubdomain(cleanSub)) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Subdomain '" + cleanSub + "' is already taken."));
        }

        // 1. Create Organization
        Organization savedOrg = organizationRepository.save(new Organization(req.getOrgName().trim(), cleanSub));

        // 2. Create Owner Account (ROLE_OWNER & ROLE_ADMIN)
        User owner = new User(savedOrg, req.getOwnerEmail().trim().toLowerCase(),
                encoder.encode(req.getOwnerPassword()), req.getOwnerPhone().trim());
        owner.setFirstName(req.getOwnerName());
        Role ownerRole = roleRepository.findByName(ERole.OWNER)
                .orElseGet(() -> roleRepository.save(new Role(ERole.OWNER, "[\"ALL\"]")));
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_ADMIN", "[\"ALL\"]")));
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
        property.setManager(
                req.getManager() != null && !req.getManager().isBlank() ? req.getManager().trim() : req.getOwnerName());
        property.setPhone(
                req.getPhone() != null && !req.getPhone().isBlank() ? req.getPhone().trim() : req.getOwnerPhone());
        property.setEmail(
                req.getEmail() != null && !req.getEmail().isBlank() ? req.getEmail().trim() : req.getOwnerEmail());
        if (req.getLandlordPan() != null)
            property.setLandlordPan(req.getLandlordPan().trim());
        if (req.getPgLicenseNo() != null)
            property.setPgLicenseNo(req.getPgLicenseNo().trim());
        if (req.getBankAccountName() != null)
            property.setBankAccountName(req.getBankAccountName().trim());
        if (req.getBankName() != null)
            property.setBankName(req.getBankName().trim());
        if (req.getBankAccountNumber() != null)
            property.setBankAccountNumber(req.getBankAccountNumber().trim());
        if (req.getBankIfsc() != null)
            property.setBankIfsc(req.getBankIfsc().trim());
        if (req.getUpiVpa() != null)
            property.setUpiVpa(req.getUpiVpa().trim());
        if (req.getAuthorizedSignatory() != null)
            property.setAuthorizedSignatory(req.getAuthorizedSignatory().trim());
        if (req.getGstin() != null)
            property.setGstin(req.getGstin().trim());

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
        if (req.getGstin() != null)
            bp.setGstin(req.getGstin().trim());
        if (req.getLandlordPan() != null && !req.getLandlordPan().isBlank()) {
            bp.setPan(req.getLandlordPan().trim().toUpperCase());
        }
        if (req.getPgLicenseNo() != null && !req.getPgLicenseNo().isBlank()) {
            bp.setRegistrationNumber(req.getPgLicenseNo().trim());
        }
        bp.setBankAccountName(req.getBankAccountName());
        bp.setBankName(req.getBankName());
        bp.setBankAccountNumber(req.getBankAccountNumber());
        bp.setBankIfsc(req.getBankIfsc());
        bp.setUpiVpa(req.getUpiVpa());
        bp.setAuthorizedSignatory(
                req.getAuthorizedSignatory() != null ? req.getAuthorizedSignatory().trim() : req.getOwnerName());
        bp.setDefaultSecurityDeposit(new java.math.BigDecimal("16000.00"));

        bp.setSubscriptionPlanName(req.getPlanName() != null ? req.getPlanName() : "Starter PG Plan");
        bp.setSubscriptionPlanPrice(req.getPlanPrice() != null ? req.getPlanPrice() : new java.math.BigDecimal("1499"));
        bp.setSubscriptionBillingCycle(req.getBillingCycle() != null ? req.getBillingCycle() : "MONTHLY");
        bp.setSubscriptionStartDate(java.time.OffsetDateTime.now());
        bp.setSubscriptionEndDate(req.isTrial() ? java.time.OffsetDateTime.now().plusDays(14)
                : ("ANNUAL".equalsIgnoreCase(req.getBillingCycle()) ? java.time.OffsetDateTime.now().plusYears(1)
                        : java.time.OffsetDateTime.now().plusMonths(1)));
        bp.setSubscriptionStatus(req.isTrial() ? "TRIAL" : "ACTIVE");
        bp.setSubscriptionPaymentId(req.getRazorpayPaymentId() != null ? req.getRazorpayPaymentId()
                : "pay_sub_" + System.currentTimeMillis());
        bp.setSubscriptionOrderId(req.getRazorpayOrderId());
        organizationBillingProfileRepository.save(bp);

        // 4b. Dispatch Property Owner Onboarding Welcome & Invoice Email
        try {
            String invoiceNum = "INV-PROP-" + savedProperty.getCode();
            String checkoutPaymentUrl = "http://localhost:5173/subscription";
            emailService.sendPropertyOwnerRegistrationInvoice(
                    owner.getEmail(),
                    owner.getFirstName() != null ? owner.getFirstName() : owner.getEmail(),
                    savedProperty.getName(),
                    savedProperty.getCode(),
                    invoiceNum,
                    req.getPlanPrice() != null ? req.getPlanPrice() : new java.math.BigDecimal("1499"),
                    checkoutPaymentUrl);
        } catch (Exception e) {
            // Log non-blocking exception
        }

        // 5. Optional Demo / Sample Data Seeding
        if (req.isSeedSampleData()) {
            try {
                Building b = new Building(savedProperty, "Tower A", "BLD-A");
                b = buildingRepository.save(b);

                Floor f1 = new Floor(b, 1);
                f1 = floorRepository.save(f1);

                Floor f2 = new Floor(b, 2);
                f2 = floorRepository.save(f2);

                Room r101 = new Room(f1, "101", "DOUBLE", new java.math.BigDecimal("8500"));
                if (r101.getAmenities() != null)
                    r101.getAmenities().add("Non-AC");
                r101 = roomRepository.save(r101);

                Room r102 = new Room(f1, "102", "DOUBLE", new java.math.BigDecimal("9500"));
                if (r102.getAmenities() != null)
                    r102.getAmenities().add("AC");
                r102 = roomRepository.save(r102);

                Room r201 = new Room(f2, "201", "DOUBLE", new java.math.BigDecimal("8500"));
                if (r201.getAmenities() != null)
                    r201.getAmenities().add("Non-AC");
                r201 = roomRepository.save(r201);

                Room r202 = new Room(f2, "202", "DOUBLE", new java.math.BigDecimal("9500"));
                if (r202.getAmenities() != null)
                    r202.getAmenities().add("AC");
                r202 = roomRepository.save(r202);

                bedRepository.save(new Bed(r101, "101-A"));
                bedRepository.save(new Bed(r101, "101-B"));
                bedRepository.save(new Bed(r102, "102-A"));
                bedRepository.save(new Bed(r102, "102-B"));
                bedRepository.save(new Bed(r201, "201-A"));
                bedRepository.save(new Bed(r201, "201-B"));
                bedRepository.save(new Bed(r202, "202-A"));
                bedRepository.save(new Bed(r202, "202-B"));

                savedProperty.setTotalBuildings(1);
                savedProperty.setTotalRooms(4);
                savedProperty.setTotalBeds(8);
                savedProperty.setOccupiedBeds(0);
                propertyRepository.save(savedProperty);
            } catch (Exception ignored) {
            }
        }

        // 6. Generate Authentication JWT Token & Auto-Login Response
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getOwnerEmail().trim().toLowerCase(),
                        req.getOwnerPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();

        String jwt = jwtUtils.generateJwtToken(authentication);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());
        org.springframework.http.ResponseCookie cookie = jwtUtils.generateRefreshTokenCookie(refreshToken.getToken());

        List<String> userRoles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new JwtResponse(jwt,
                        refreshToken.getToken(),
                        userDetails.getId(),
                        userDetails.getEmail(),
                        userDetails.getOrgId(),
                        userRoles));
    }

    @PostMapping("/first-time-change-password")
    public ResponseEntity<?> firstTimeChangePassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String currentPassword = request.get("currentPassword");
        String newPassword = request.get("newPassword");

        if (email == null || currentPassword == null || newPassword == null || newPassword.trim().length() < 6) {
            return ResponseEntity.badRequest().body(new MessageResponse(
                    "Email, current temporary password, and valid new password (min 6 characters) are required."));
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("User account not found."));
        }

        if (!encoder.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_REQUEST)
                    .body(new MessageResponse("Invalid current temporary password."));
        }

        user.setPassword(encoder.encode(newPassword.trim()));
        user.setMustChangePassword(false);
        userRepository.save(user);

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(user.getEmail(), newPassword.trim()));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String jwt = jwtUtils.generateJwtToken(authentication);

        List<String> roles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        try {
            refreshTokenService.deleteByUserId(userDetails.getId());
        } catch (Exception ignored) {
        }

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());
        auditLogService.logUser(user, "Updated first-time temporary password successfully and logged in.", null);

        return ResponseEntity.ok(new JwtResponse(jwt,
                refreshToken.getToken(),
                userDetails.getId(),
                userDetails.getEmail(),
                user.getFirstName() != null ? user.getFirstName() : userDetails.getEmail(),
                user.getMobile(),
                user.getAvatarUrl(),
                userDetails.getOrgId(),
                roles));
    }

    @Autowired
    private com.stayeaze.backend.repository.SaaSPlanRepository saasPlanRepository;

    @GetMapping("/public-plans")
    public ResponseEntity<?> getPublicSaaSPlans() {
        List<SaaSPlan> plans = saasPlanRepository.findAll();
        if (plans.isEmpty()) {
            SaaSPlan starter = new SaaSPlan();
            starter.setPlanKey("STARTER");
            starter.setName("Starter PG");
            starter.setMonthlyPrice(new java.math.BigDecimal("1499.0"));
            starter.setAnnualPrice(new java.math.BigDecimal("14390.0"));
            starter.setMaxBeds(30);
            starter.setMaxProperties(1);
            starter.setIsActive(true);

            SaaSPlan pro = new SaaSPlan();
            pro.setPlanKey("PROFESSIONAL");
            pro.setName("Professional PG");
            pro.setMonthlyPrice(new java.math.BigDecimal("2999.0"));
            pro.setAnnualPrice(new java.math.BigDecimal("28790.0"));
            pro.setMaxBeds(100);
            pro.setMaxProperties(3);
            pro.setIsActive(true);

            SaaSPlan enterprise = new SaaSPlan();
            enterprise.setPlanKey("ENTERPRISE");
            enterprise.setName("Enterprise Chain");
            enterprise.setMonthlyPrice(new java.math.BigDecimal("5999.0"));
            enterprise.setAnnualPrice(new java.math.BigDecimal("57590.0"));
            enterprise.setMaxBeds(500);
            enterprise.setMaxProperties(10);
            enterprise.setIsActive(true);

            saasPlanRepository.saveAll(List.of(starter, pro, enterprise));
            plans = saasPlanRepository.findAll();
        }
        return ResponseEntity.ok(plans);
    }
}
