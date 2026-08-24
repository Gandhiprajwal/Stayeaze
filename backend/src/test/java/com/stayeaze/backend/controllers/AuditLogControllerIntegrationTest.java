package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.jwt.JwtUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AuditLogControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private PasswordEncoder encoder;

    private String superAdminToken;
    private String ownerToken;
    private String adminToken;
    private Organization org;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        userRepository.findByEmail("superadmin_audit@stayeaze.com").ifPresent(userRepository::delete);
        userRepository.findByEmail("audit_owner@stayeaze.com").ifPresent(userRepository::delete);
        userRepository.findByEmail("audit_admin@stayeaze.com").ifPresent(userRepository::delete);

        org = organizationRepository.findAll().stream().findFirst().orElseGet(() -> {
            Organization o = new Organization("Audit Test Org", "audittestorg" + System.currentTimeMillis());
            return organizationRepository.save(o);
        });

        Role superAdminRole = roleRepository.findByName(ERole.SUPER_ADMIN).orElseGet(() ->
                roleRepository.save(new Role(ERole.SUPER_ADMIN, "[\"ALL\"]")));
        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElseGet(() ->
                roleRepository.save(new Role(ERole.OWNER, "[\"ALL\"]")));
        Role managerRole = roleRepository.findByName(ERole.PROPERTY_MANAGER).orElseGet(() ->
                roleRepository.save(new Role(ERole.PROPERTY_MANAGER, "[\"ALL\"]")));

        User sa = userRepository.findByEmail("superadmin@stayeaze.com").orElseGet(() -> {
            User u = new User(org, "superadmin@stayeaze.com", encoder.encode("Friend@2010"), "99" + (System.currentTimeMillis() % 100000000) + "1");
            u.setRoles(Set.of(superAdminRole));
            return userRepository.save(u);
        });
        superAdminToken = jwtUtils.generateTokenFromUsername(sa.getEmail());

        User owner = userRepository.findByEmail("audit_owner@stayeaze.com").orElseGet(() -> {
            User u = new User(org, "audit_owner@stayeaze.com", encoder.encode("Pass@123"), "99" + (System.currentTimeMillis() % 100000000) + "2");
            u.setRoles(Set.of(ownerRole));
            return userRepository.save(u);
        });
        ownerToken = jwtUtils.generateTokenFromUsername(owner.getEmail());

        User admin = userRepository.findByEmail("audit_admin@stayeaze.com").orElseGet(() -> {
            User u = new User(org, "audit_admin@stayeaze.com", encoder.encode("Pass@123"), "99" + (System.currentTimeMillis() % 100000000) + "3");
            u.setRoles(Set.of(managerRole));
            return userRepository.save(u);
        });
        adminToken = jwtUtils.generateTokenFromUsername(admin.getEmail());

        // Create sample audit logs
        auditLogRepository.save(new AuditLog(org, "audit_owner@stayeaze.com", "LOGIN: User logged in", "192.168.1.1"));
        auditLogRepository.save(new AuditLog(org, "audit_admin@stayeaze.com", "CREATE: Property created", "192.168.1.2"));
    }

    @Test
    void testSuperAdminCanGetAuditLogs() throws Exception {
        mockMvc.perform(get("/api/v1/audit-logs")
                        .header("Authorization", "Bearer " + superAdminToken)
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void testOwnerCanGetAuditLogs() throws Exception {
        mockMvc.perform(get("/api/v1/audit-logs")
                        .header("Authorization", "Bearer " + ownerToken)
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void testAdminCanGetAuditLogs() throws Exception {
        mockMvc.perform(get("/api/v1/audit-logs")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void testWriteCustomAuditLog() throws Exception {
        mockMvc.perform(post("/api/v1/audit-logs")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("action", "UPDATE: Tenant room assignment modified"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.action").value("UPDATE: Tenant room assignment modified"));
    }
}
