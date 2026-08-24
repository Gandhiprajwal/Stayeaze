package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.RefreshToken;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.payload.request.TokenRefreshRequest;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RefreshTokenRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.jwt.JwtUtils;
import com.stayeaze.backend.security.services.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AuthRefreshTokenIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Organization testOrg;
    private User testUser;

    @BeforeEach
    void setUp() {
        testOrg = organizationRepository.findBySubdomain("auth-test-org").orElseGet(() -> {
            Organization org = new Organization("Auth Test PG", "auth-test-org");
            return organizationRepository.save(org);
        });

        Role ownerRole = roleRepository.findByName("OWNER").orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testUser = userRepository.findByEmail("auth.user@test.com").orElseGet(() -> {
            User u = new User(testOrg, "auth.user@test.com", passwordEncoder.encode("Password@123"), "9112233445");
            u.setFirstName("Auth Tester");
            Set<Role> roles = new HashSet<>();
            roles.add(ownerRole);
            u.setRoles(roles);
            return userRepository.save(u);
        });
    }

    // =========================================================================
    // POSITIVE SCENARIOS (HAPPY PATH)
    // =========================================================================

    @Test
    @DisplayName("POSITIVE: Valid refresh token in request body generates new JWT access token and rotates refresh token")
    void testValidRefreshTokenInBodyGeneratesNewJwtAndRotatesRefreshToken() throws Exception {
        // 1. Create initial active refresh token
        RefreshToken initialToken = refreshTokenService.createRefreshToken(testUser.getId());
        String initialTokenString = initialToken.getToken();

        TokenRefreshRequest refreshRequest = new TokenRefreshRequest();
        refreshRequest.setRefreshToken(initialTokenString);

        // 2. Call /api/v1/auth/refresh
        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.refreshToken", notNullValue()))
                .andExpect(jsonPath("$.tokenType", is("Bearer")))
                .andReturn();

        String responseJson = result.getResponse().getContentAsString();
        String newAccessToken = objectMapper.readTree(responseJson).get("accessToken").asText();
        String newRefreshToken = objectMapper.readTree(responseJson).get("refreshToken").asText();

        // 3. Verify JWT is valid and belongs to user
        assertTrue(jwtUtils.validateJwtToken(newAccessToken));
        assertEquals(testUser.getEmail(), jwtUtils.getUserNameFromJwtToken(newAccessToken));

        // 4. Verify refresh token rotation: Old token deleted, new token stored
        assertNotEquals(initialTokenString, newRefreshToken);
        Optional<RefreshToken> oldTokenInDb = refreshTokenRepository.findByToken(initialTokenString);
        assertTrue(oldTokenInDb.isEmpty(), "Old refresh token should be deleted upon rotation");

        Optional<RefreshToken> newTokenInDb = refreshTokenRepository.findByToken(newRefreshToken);
        assertTrue(newTokenInDb.isPresent(), "New rotated refresh token must exist in database");
        assertEquals(testUser.getId(), newTokenInDb.get().getUser().getId());
    }

    @Test
    @DisplayName("POSITIVE: Valid refresh token in HttpOnly cookie generates new JWT and sets updated cookie")
    void testValidRefreshTokenInCookieGeneratesNewJwtAndSetsNewCookie() throws Exception {
        RefreshToken initialToken = refreshTokenService.createRefreshToken(testUser.getId());
        String initialTokenString = initialToken.getToken();

        Cookie cookie = new Cookie("refreshToken", initialTokenString);
        cookie.setHttpOnly(true);
        cookie.setPath("/");

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", containsString("stayeaze_refresh_token=")));
    }

    @Test
    @DisplayName("POSITIVE: Newly issued JWT access token can access protected API endpoints")
    void testNewlyGeneratedJwtCanAccessProtectedEndpoints() throws Exception {
        // 1. Refresh to get a fresh access token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(testUser.getId());
        TokenRefreshRequest refreshRequest = new TokenRefreshRequest();
        refreshRequest.setRefreshToken(refreshToken.getToken());

        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String newAccessToken = objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();

        // 2. Access protected endpoint with the new Bearer token
        mockMvc.perform(get("/api/v1/properties")
                        .header("Authorization", "Bearer " + newAccessToken))
                .andExpect(status().isOk());
    }

    // =========================================================================
    // NEGATIVE & DATA VALIDATION SCENARIOS
    // =========================================================================

    @Test
    @DisplayName("NEGATIVE: Expired refresh token returns 401 Unauthorized and is purged from database")
    void testExpiredRefreshTokenFailsWith401AndPurgesFromDatabase() throws Exception {
        // 1. Create an expired refresh token
        RefreshToken expiredToken = new RefreshToken();
        expiredToken.setUser(testUser);
        expiredToken.setToken(UUID.randomUUID().toString());
        expiredToken.setExpiryDate(OffsetDateTime.now().minusHours(2)); // Expired 2 hours ago
        RefreshToken savedExpiredToken = refreshTokenRepository.save(expiredToken);
        String expiredTokenString = savedExpiredToken.getToken();

        TokenRefreshRequest request = new TokenRefreshRequest();
        request.setRefreshToken(expiredTokenString);

        // 2. Call /api/v1/auth/refresh
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail", containsStringIgnoringCase("expired")));

        // 3. Verify expired token is purged from database
        Optional<RefreshToken> tokenInDb = refreshTokenRepository.findByToken(expiredTokenString);
        assertTrue(tokenInDb.isEmpty(), "Expired refresh token must be purged upon verification failure");
    }

    @Test
    @DisplayName("NEGATIVE: Non-existent or forged refresh token returns 401 Unauthorized")
    void testInvalidNonExistentRefreshTokenReturns401() throws Exception {
        TokenRefreshRequest request = new TokenRefreshRequest();
        request.setRefreshToken(UUID.randomUUID().toString()); // Random forged token

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("DATA VALIDATION: Missing refresh token in body and cookie returns 401 Unauthorized")
    void testMissingRefreshTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("missing from cookie/request")));
    }

    @Test
    @DisplayName("DATA VALIDATION: Blank or whitespace-only refresh token returns 401 Unauthorized")
    void testBlankOrWhitespaceRefreshTokenReturns401() throws Exception {
        TokenRefreshRequest request = new TokenRefreshRequest();
        request.setRefreshToken("   ");

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("missing from cookie/request")));
    }

    // =========================================================================
    // SECURITY & REPLAY PROTECTION SCENARIOS
    // =========================================================================

    @Test
    @DisplayName("SECURITY: Previously rotated refresh token cannot be reused (Replay Attack Prevention)")
    void testOldRotatedRefreshTokenCannotBeReused() throws Exception {
        // 1. Initial active token
        RefreshToken initialToken = refreshTokenService.createRefreshToken(testUser.getId());
        String oldToken = initialToken.getToken();

        // 2. Perform first valid refresh -> Rotates token
        TokenRefreshRequest firstRefresh = new TokenRefreshRequest();
        firstRefresh.setRefreshToken(oldToken);

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstRefresh)))
                .andExpect(status().isOk());

        // 3. Attempt to REPLAY the old token
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstRefresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("SECURITY: Logout invalidates and deletes refresh token, preventing subsequent refresh")
    void testLogoutPurgesRefreshTokenAndPreventsSubsequentRefresh() throws Exception {
        // 1. Create active token
        RefreshToken initialToken = refreshTokenService.createRefreshToken(testUser.getId());
        String tokenString = initialToken.getToken();
        String validJwt = jwtUtils.generateTokenFromUsername(testUser.getEmail());

        // 2. Perform Logout with authenticated Bearer token
        mockMvc.perform(post("/api/v1/auth/logout")
                        .header("Authorization", "Bearer " + validJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("Log out successful")));

        // 3. Confirm refresh token deleted from DB
        Optional<RefreshToken> inDb = refreshTokenRepository.findByToken(tokenString);
        assertTrue(inDb.isEmpty(), "User's refresh tokens should be deleted upon logout");

        // 4. Attempting to refresh using the pre-logout token fails
        TokenRefreshRequest refreshRequest = new TokenRefreshRequest();
        refreshRequest.setRefreshToken(tokenString);

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isUnauthorized());
    }
}
