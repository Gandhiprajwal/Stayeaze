package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.RefreshToken;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RefreshTokenRepository;
import com.stayeaze.backend.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/super-admin/sessions")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminSessionController {

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @GetMapping
    public ResponseEntity<?> getActiveSessions(
            @RequestParam(defaultValue = "") String search) {

        List<RefreshToken> tokens = refreshTokenRepository.findAll();
        List<Map<String, Object>> result = tokens.stream()
                .filter(t -> t.getUser() != null)
                .map(t -> {
                    User u = t.getUser();
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", t.getId());
                    item.put("token", t.getToken().length() > 16 ? t.getToken().substring(0, 16) + "..." : t.getToken());
                    item.put("userId", u.getId());
                    item.put("userEmail", u.getEmail());
                    item.put("userName", u.getFirstName() != null ? u.getFirstName() : u.getEmail());
                    item.put("orgName", u.getOrganization() != null ? u.getOrganization().getName() : "Platform Super Admin");
                    item.put("orgId", u.getOrganization() != null ? u.getOrganization().getId() : null);
                    item.put("expiryDate", t.getExpiryDate());
                    item.put("isExpired", t.getExpiryDate().isBefore(OffsetDateTime.now()));
                    return item;
                })
                .filter(item -> {
                    if (search.isBlank()) return true;
                    String q = search.toLowerCase();
                    String email = ((String) item.get("userEmail")).toLowerCase();
                    String name = ((String) item.get("userName")).toLowerCase();
                    String org = ((String) item.get("orgName")).toLowerCase();
                    return email.contains(q) || name.contains(q) || org.contains(q);
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{tokenId}/revoke")
    @Transactional
    public ResponseEntity<?> revokeSession(@PathVariable UUID tokenId) {
        RefreshToken token = refreshTokenRepository.findById(tokenId).orElse(null);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Session token not found"));
        }

        refreshTokenRepository.delete(token);
        return ResponseEntity.ok(new MessageResponse("User session successfully revoked. Token invalidated."));
    }

    @PostMapping("/revoke-org/{orgId}")
    @Transactional
    public ResponseEntity<?> revokeOrgSessions(@PathVariable UUID orgId) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Organization not found"));
        }

        List<User> orgUsers = userRepository.findByOrganizationId(orgId);
        int count = 0;
        for (User u : orgUsers) {
            count += refreshTokenRepository.deleteByUser(u);
        }

        return ResponseEntity.ok(new MessageResponse("Emergency lockout complete. Terminated " + count + " active session(s) for organization: " + org.getName()));
    }
}
