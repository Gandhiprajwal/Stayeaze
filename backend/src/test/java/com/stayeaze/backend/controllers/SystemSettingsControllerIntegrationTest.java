package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SystemSettingsControllerIntegrationTest {

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
    private SystemIntegrationSettingsRepository settingsRepository;

    private User superAdminUser;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role superAdminRole = roleRepository.findByName("ROLE_SUPER_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_SUPER_ADMIN", "{\"permissions\":[\"*\"]}")));

        Organization sysOrg = new Organization();
        sysOrg.setName("Platform HQ " + System.currentTimeMillis());
        sysOrg.setSubdomain("syshq" + System.currentTimeMillis());
        sysOrg = organizationRepository.saveAndFlush(sysOrg);

        String email = "super_admin_" + System.currentTimeMillis() + "@stayeaze.com";
        superAdminUser = new User(sysOrg, email, "password123", "78" + (System.currentTimeMillis() % 100000000L));
        superAdminUser.setFirstName("Super Admin");
        superAdminUser.setRoles(new HashSet<>(Collections.singleton(superAdminRole)));
        superAdminUser = userRepository.saveAndFlush(superAdminUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(superAdminUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("GET /super-admin/settings - Retrieve global system integration settings")
    void testGetSettings() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/settings")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /super-admin/clear-cache - Flush system caches")
    void testClearCache() throws Exception {
        mockMvc.perform(post("/api/v1/super-admin/clear-cache")
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Successfully flushed Redis")));
    }
}
