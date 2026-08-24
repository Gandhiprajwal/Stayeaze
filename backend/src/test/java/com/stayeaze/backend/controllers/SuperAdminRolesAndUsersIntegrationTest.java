package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.ERole;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class SuperAdminRolesAndUsersIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization testOrg;
    private Role superAdminRole;

    @BeforeEach
    public void setup() {
        superAdminRole = roleRepository.findByName(ERole.SUPER_ADMIN)
                .orElseGet(() -> roleRepository.save(new Role("ROLE_SUPER_ADMIN", "[\"ALL\"]")));

        roleRepository.findByName(ERole.OWNER)
                .orElseGet(() -> roleRepository.save(new Role("ROLE_OWNER", "[\"ALL\"]")));

        testOrg = organizationRepository.findBySubdomain("system").orElseGet(() -> {
            Organization org = new Organization();
            org.setName("StayEaze SaaS System");
            org.setSubdomain("system");
            org.setStatus("ACTIVE");
            return organizationRepository.save(org);
        });

        if (userRepository.findByEmail("superadmin@stayeaze.com").isEmpty()) {
            User u = new User();
            u.setEmail("superadmin@stayeaze.com");
            u.setPassword("Friend@2010");
            u.setFirstName("Super Admin");
            u.setMobile("9999999999");
            u.setOrganization(testOrg);
            u.setStatus("ACTIVE");
            u.setRoles(Set.of(superAdminRole));
            userRepository.save(u);
        }
    }

    @Test
    @DisplayName("Super Admin can fetch categorized permissions catalog")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testGetPermissionsCatalog() throws Exception {
        mockMvc.perform(get("/api/v1/roles/permissions")
                        .header("X-Stress-Test", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(List.class)))
                .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$[0].category", notNullValue()))
                .andExpect(jsonPath("$[0].permissions", isA(List.class)));
    }

    @Test
    @DisplayName("Super Admin can create a custom role with fine-grained permissions")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSuperAdminCreateCustomRole() throws Exception {
        String roleName = "CUSTOM_AUDITOR_" + System.currentTimeMillis();
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", roleName);
        payload.put("description", "Auditor with read-only access to finances and logs");
        payload.put("permissions", List.of("payment.read", "invoice.read", "audit.read"));

        mockMvc.perform(post("/api/v1/roles")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", containsString(roleName)))
                .andExpect(jsonPath("$.permissions", containsString("payment.read")))
                .andExpect(jsonPath("$.permissions", containsString("invoice.read")))
                .andExpect(jsonPath("$.permissions", containsString("audit.read")));
    }

    @Test
    @DisplayName("Non-Super Admin (Owner) CANNOT create custom roles (403 Forbidden)")
    @WithMockUser(roles = "OWNER")
    public void testOwnerCannotCreateCustomRole() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", "ILLEGAL_ROLE_" + System.currentTimeMillis());
        payload.put("description", "Attempting unauthorized role creation");
        payload.put("permissions", List.of("ALL"));

        mockMvc.perform(post("/api/v1/roles")
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Super Admin can update an existing custom role's permissions")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSuperAdminUpdateRole() throws Exception {
        Role customRole = roleRepository.save(new Role("ROLE_NIGHT_STAFF_" + System.currentTimeMillis(), "[\"property.read\"]"));

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("description", "Updated Night Staff with security privileges");
        updatePayload.put("permissions", List.of("property.read", "visitor.write", "complaint.write"));

        mockMvc.perform(put("/api/v1/roles/" + customRole.getId())
                        .header("X-Stress-Test", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updatePayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions", containsString("property.read")))
                .andExpect(jsonPath("$.permissions", containsString("visitor.write")))
                .andExpect(jsonPath("$.permissions", containsString("complaint.write")));
    }

    @Test
    @DisplayName("Built-in system core roles cannot be deleted")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSystemCoreRoleCannotBeDeleted() throws Exception {
        mockMvc.perform(delete("/api/v1/roles/" + superAdminRole.getId())
                        .header("X-Stress-Test", "true"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Super Admin can fetch Global Users Directory with pagination and role counts")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSuperAdminFetchGlobalUsers() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .header("X-Stress-Test", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", isA(List.class)))
                .andExpect(jsonPath("$.total", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data[0].email", notNullValue()));
    }

    @Test
    @DisplayName("Super Admin can search users by email, name, or mobile")
    @WithMockUser(roles = "SUPER_ADMIN")
    public void testSearchUsersByQuery() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .param("search", "superadmin")
                        .header("X-Stress-Test", "true")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].email", containsString("superadmin@stayeaze.com")));
    }
}
