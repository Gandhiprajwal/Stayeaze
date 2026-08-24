package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.UserRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for GET /api/v1/properties/minimal
 *
 * Auth strategy: uses SecurityMockMvcRequestPostProcessors.user(UserDetailsImpl) which
 * builds the principal directly from the in-transaction seeded entities — no UserDetailsService
 * lookup needed, so it works correctly with @Transactional (uncommitted data).
 *
 * Verifies:
 *  1. Super-admin sees all properties across all orgs
 *  2. Org-scoped owner sees only their org's properties
 *  3. Cross-org isolation — Org B owner cannot see Org A properties
 *  4. Unauthenticated request returns 401 (no data leaked)
 *  5. Minimal field shape — only the expected fields present
 *  6. Sensitive field exclusion — no bank, razorpay, PAN, license data
 *  7. Correct data values returned for org A
 *  8. Cache eviction and refetch returns fresh consistent data
 *  9. Response is a flat JSON array, not a paginated wrapper
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("GET /api/v1/properties/minimal — Optimised Projection Tests")
public class PropertyMinimalEndpointIntegrationTest {

    private static final String ENDPOINT = "/api/v1/properties/minimal";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private CacheManager cacheManager;

    private Organization orgA;
    private Organization orgB;
    private Organization systemOrg;

    // Principals built from seeded entities — used in .with(user(...))
    private UserDetailsImpl ownerADetails;
    private UserDetailsImpl ownerBDetails;
    private UserDetailsImpl superAdminDetails;

    @BeforeEach
    void setUp() {
        systemOrg = organizationRepository.findBySubdomain("system").orElseGet(() -> {
            Organization so = new Organization("StayEaze Platform", "system");
            return organizationRepository.save(so);
        });

        orgA = organizationRepository.findBySubdomain("minimal-org-a").orElseGet(() -> {
            Organization o = new Organization("Org Alpha PG", "minimal-org-a");
            o.setStatus("ACTIVE");
            return organizationRepository.save(o);
        });

        orgB = organizationRepository.findBySubdomain("minimal-org-b").orElseGet(() -> {
            Organization o = new Organization("Org Beta PG", "minimal-org-b");
            o.setStatus("ACTIVE");
            return organizationRepository.save(o);
        });

        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));
        Role superRole = roleRepository.findByName("SUPER_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("SUPER_ADMIN", "{}")));

        User ownerA = userRepository.findByEmail("minimal_owner_a@test.com").orElseGet(() -> {
            User u = new User(orgA, "minimal_owner_a@test.com", "pass123", "9876000001");
            u.setFirstName("Alpha Owner");
            u.setRoles(new HashSet<>(Set.of(ownerRole)));
            return userRepository.save(u);
        });

        User ownerB = userRepository.findByEmail("minimal_owner_b@test.com").orElseGet(() -> {
            User u = new User(orgB, "minimal_owner_b@test.com", "pass123", "9876000002");
            u.setFirstName("Beta Owner");
            u.setRoles(new HashSet<>(Set.of(ownerRole)));
            return userRepository.save(u);
        });

        User superAdmin = userRepository.findByEmail("minimal_superadmin@test.com").orElseGet(() -> {
            User u = new User(systemOrg, "minimal_superadmin@test.com", "pass123", "9876000003");
            u.setFirstName("Minimal SuperAdmin");
            u.setRoles(new HashSet<>(Set.of(superRole)));
            return userRepository.save(u);
        });

        // Build UserDetailsImpl principals directly from seeded entities.
        // This avoids the UserDetailsService DB lookup that fails inside @Transactional
        // because the seeded data is not yet committed to the database.
        ownerADetails     = UserDetailsImpl.build(ownerA);
        ownerBDetails     = UserDetailsImpl.build(ownerB);
        superAdminDetails = UserDetailsImpl.build(superAdmin);

        seedProperty(orgA, "Alpha Property 1", "ALP-001", "Bengaluru");
        seedProperty(orgA, "Alpha Property 2", "ALP-002", "Mysuru");
        seedProperty(orgB, "Beta Property 1",  "BTP-001", "Pune");

        // Evict cache so tests always exercise the DB path
        try {
            var cache = cacheManager.getCache("minimalProperties");
            if (cache != null) cache.clear();
        } catch (Exception ignored) {}
    }

    private void seedProperty(Organization org, String name, String code, String city) {
        boolean exists = propertyRepository.findAllSuperAdmin().stream()
                .anyMatch(p -> code.equals(p.getCode()));
        if (!exists) {
            Property p = new Property();
            p.setName(name);
            p.setCode(code);
            p.setAddress("123 Test Street, " + city);
            p.setCity(city);
            p.setOrganization(org);
            p.setTotalBeds(20);
            p.setOccupiedBeds(10);
            // Sensitive fields stored in DB — must NOT appear in /minimal response
            p.setBankAccountNumber("502000112233");
            p.setBankIfsc("HDFC0009999");
            p.setRazorpayKeyId("rzp_live_secret_key");
            p.setRazorpayKeySecret("rzp_secret_value");
            propertyRepository.save(p);
        }
    }

    // ── 1. Super-admin cross-org visibility ───────────────────────────────────

    @Test
    @DisplayName("Super-admin gets all properties across all orgs")
    void superAdminSeesAllProperties() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(superAdminDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.List.class)))
                .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(3)));
    }

    // ── 2 & 3. Org-scoped isolation ───────────────────────────────────────────

    @Test
    @DisplayName("Org A owner only sees properties from org A")
    void orgOwnerSeesOnlyOwnOrgProperties() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(ownerADetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].orgId",
                        everyItem(is(orgA.getId().toString()))));
    }

    @Test
    @DisplayName("Org B owner cannot see Org A properties")
    void orgBOwnerCannotSeeOrgAProperties() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(ownerBDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].orgId",
                        not(hasItem(orgA.getId().toString()))));
    }

    // ── 4. Unauthenticated access ─────────────────────────────────────────────

    @Test
    @DisplayName("Unauthenticated request returns 401 — no data leaked")
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isUnauthorized());
    }

    // ── 5. Minimal field shape validation ─────────────────────────────────────

    @Test
    @DisplayName("Response contains expected minimal fields: id, name, code, orgId, totalBeds, occupiedBeds")
    void responseHasRequiredMinimalFields() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(ownerADetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].name").exists())
                .andExpect(jsonPath("$[0].code").exists())
                .andExpect(jsonPath("$[0].orgId").exists())
                .andExpect(jsonPath("$[0].totalBeds").exists())
                .andExpect(jsonPath("$[0].occupiedBeds").exists());
    }

    // ── 6. Sensitive field exclusion ──────────────────────────────────────────

    @Test
    @DisplayName("Response does NOT expose sensitive fields: bank, Razorpay, PAN, license")
    void responseExcludesSensitiveFields() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(superAdminDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].bankAccountNumber").doesNotExist())
                .andExpect(jsonPath("$[*].bankIfsc").doesNotExist())
                .andExpect(jsonPath("$[*].razorpayKeyId").doesNotExist())
                .andExpect(jsonPath("$[*].razorpayKeySecret").doesNotExist())
                .andExpect(jsonPath("$[*].pgLicenseNo").doesNotExist())
                .andExpect(jsonPath("$[*].landlordPan").doesNotExist())
                .andExpect(jsonPath("$[*].description").doesNotExist());
    }

    // ── 7. Correct data values ────────────────────────────────────────────────

    @Test
    @DisplayName("Correct property names, codes, and cities returned for org A")
    void orgADataValuesAreCorrect() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(ownerADetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code", hasItems("ALP-001", "ALP-002")))
                .andExpect(jsonPath("$[*].name", hasItems("Alpha Property 1", "Alpha Property 2")))
                .andExpect(jsonPath("$[*].city", hasItems("Bengaluru", "Mysuru")))
                .andExpect(jsonPath("$[*].totalBeds", everyItem(greaterThanOrEqualTo(0))))
                .andExpect(jsonPath("$[*].occupiedBeds", everyItem(greaterThanOrEqualTo(0))));
    }

    // ── 8. Cache eviction consistency ─────────────────────────────────────────

    @Test
    @DisplayName("After cache eviction, second call returns fresh consistent data")
    void cacheEvictionReturnsConsistentData() throws Exception {
        // First call — populates cache
        int firstCount = mockMvc.perform(get(ENDPOINT).with(user(superAdminDetails)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()
                .split("\\{").length - 1;

        // Evict cache
        try {
            var cache = cacheManager.getCache("minimalProperties");
            if (cache != null) cache.clear();
        } catch (Exception ignored) {}

        // Second call — must return at least the same count
        mockMvc.perform(get(ENDPOINT).with(user(superAdminDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(firstCount)));
    }

    // ── 9. Flat JSON array (not a paginated wrapper) ──────────────────────────

    @Test
    @DisplayName("/minimal returns a flat JSON array — not a paginated wrapper object")
    void responseIsArrayNotPaginatedWrapper() throws Exception {
        mockMvc.perform(get(ENDPOINT).with(user(ownerADetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", isA(java.util.List.class)))
                .andExpect(jsonPath("$.content").doesNotExist())
                .andExpect(jsonPath("$.totalElements").doesNotExist())
                .andExpect(jsonPath("$.pageable").doesNotExist());
    }
}
