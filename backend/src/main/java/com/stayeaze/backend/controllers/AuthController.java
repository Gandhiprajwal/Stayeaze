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
}
