package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.TenantRequest;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.SecurityRateLimitFilter;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class FiftyOrgMultiTenantConcurrentLoadTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private SaaSPlanRepository saasPlanRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private MeterReadingRepository meterReadingRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private VisitorRepository visitorRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SecurityRateLimitFilter rateLimitFilter;

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    public static class OrgLoadContext {
        public Organization org;
        public User owner;
        public UsernamePasswordAuthenticationToken auth;
        public Property property;
        public Building building;
        public Floor floor;
        public Room room101;
        public Room room102;
        public Bed bed101A;
        public Bed bed101B;
        public Bed bed102A;
        public Bed bed102B;
        public Tenant tenant1;
        public Tenant tenant2;
        public Invoice pendingInvoice;
        public Invoice unpaidInvoice;
        public MeterReading meterReading;
        public Complaint complaint;
        public Visitor visitor;
    }

    public static class EndpointStat {
        public String endpoint;
        public String method;
        public final AtomicInteger successCount = new AtomicInteger(0);
        public final AtomicInteger errorCount = new AtomicInteger(0);
        public final List<Long> latencies = new CopyOnWriteArrayList<>();

        public EndpointStat(String method, String endpoint) {
            this.method = method;
            this.endpoint = endpoint;
        }

        public void record(long durationMs, boolean success) {
            latencies.add(durationMs);
            if (success) {
                successCount.incrementAndGet();
            } else {
                errorCount.incrementAndGet();
            }
        }
    }

    private static final Map<String, EndpointStat> endpointStats = new ConcurrentHashMap<>();
    private static final List<OrgLoadContext> orgContexts = new CopyOnWriteArrayList<>();
    private static volatile boolean baselineSeeded = false;
    private static final int NUM_ORGS = 50;

    @BeforeEach
    public void setupAndSeedFiftyOrganizations() {
        SecurityRateLimitFilter.bypassForTesting = true;
        rateLimitFilter.clearRateLimits();

        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst()
                .orElseGet(SystemIntegrationSettings::new);
        settings.setRateLimitingEnabled(false);
        settingsRepository.save(settings);

        if (baselineSeeded && orgContexts.size() == NUM_ORGS) {
            return;
        }

        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.saveAndFlush(new Role("OWNER", "{}")));

        SaaSPlan plan = saasPlanRepository.findByPlanKey("ENTERPRISE").orElseGet(() -> {
            SaaSPlan p = new SaaSPlan("ENTERPRISE", "Enterprise Plan", BigDecimal.valueOf(9999),
                    BigDecimal.valueOf(99999), 50, 5000, 10, true, true, "MONTHLY");
            return saasPlanRepository.saveAndFlush(p);
        });

        orgContexts.clear();
        long runId = System.currentTimeMillis();

        System.out.println("===============================================================================");
        System.out.println("🚀 SEEDING 50 DISTINCT ORGANIZATIONS & RELATIONAL STRUCTURES FOR LOAD TEST...");
        System.out.println("===============================================================================");

        for (int i = 1; i <= NUM_ORGS; i++) {
            OrgLoadContext ctx = new OrgLoadContext();

            // 1. Organization & Billing Profile
            Organization org = new Organization("Load Test Group " + i + "_" + runId, "load-" + i + "-" + UUID.randomUUID().toString().substring(0, 6));
            org.setStatus("ACTIVE");
            org = organizationRepository.saveAndFlush(org);
            ctx.org = org;

            OrganizationBillingProfile profile = new OrganizationBillingProfile(org);
            profile.setSubscriptionPlanName("ENTERPRISE");
            billingProfileRepository.saveAndFlush(profile);

            // 2. Owner User & Auth Principal
            String email = "owner_load_" + i + "_" + runId + "@stayeaze.com";
            String mobile = "98" + String.format("%08d", (int) (Math.random() * 90000000 + 10000000));
            User owner = new User(org, email, passwordEncoder.encode("Password@123"), mobile);
            owner.setFirstName("Owner " + i);
            owner.setStatus("ACTIVE");
            owner.setIsTwoFactorEnabled(false);
            owner.setMustChangePassword(false);
            owner.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
            owner = userRepository.saveAndFlush(owner);
            ctx.owner = owner;

            UserDetailsImpl userDetails = UserDetailsImpl.build(owner);
            ctx.auth = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));

            // 3. Property
            Property prop = new Property(org, "Property " + i + " PG", "Plot " + i + ", Tech Corridor, Pune");
            prop.setCode("P-" + i + "-" + UUID.randomUUID().toString().substring(0, 4));
            prop.setType("PG");
            prop.setAddress("Street " + i + ", Tech Park, Pune");
            prop.setCity("Pune");
            prop.setState("Maharashtra");
            prop = propertyRepository.saveAndFlush(prop);
            ctx.property = prop;

            // 4. Building & Floor
            Building bld = new Building(prop, "Tower " + (char) ('A' + (i % 26)), "BLK-" + i);
            bld = buildingRepository.saveAndFlush(bld);
            ctx.building = bld;

            Floor fl = new Floor(bld, 1, "First Floor");
            fl = floorRepository.saveAndFlush(fl);
            ctx.floor = fl;

            // 5. Rooms
            Room r101 = new Room(fl, "101", "DOUBLE", BigDecimal.valueOf(8000));
            r101 = roomRepository.saveAndFlush(r101);
            ctx.room101 = r101;

            Room r102 = new Room(fl, "102", "DOUBLE", BigDecimal.valueOf(8500));
            r102 = roomRepository.saveAndFlush(r102);
            ctx.room102 = r102;

            // 6. Beds
            Bed b101A = new Bed(r101, "B1");
            b101A.setStatus("OCCUPIED");
            b101A = bedRepository.saveAndFlush(b101A);
            ctx.bed101A = b101A;

            Bed b101B = new Bed(r101, "B2");
            b101B.setStatus("AVAILABLE");
            b101B = bedRepository.saveAndFlush(b101B);
            ctx.bed101B = b101B;

            Bed b102A = new Bed(r102, "B1");
            b102A.setStatus("OCCUPIED");
            b102A = bedRepository.saveAndFlush(b102A);
            ctx.bed102A = b102A;

            Bed b102B = new Bed(r102, "B2");
            b102B.setStatus("AVAILABLE");
            b102B = bedRepository.saveAndFlush(b102B);
            ctx.bed102B = b102B;

            // 7. Tenants
            String t1Mobile = "97" + String.format("%08d", (int) (Math.random() * 90000000 + 10000000));
            Tenant t1 = new Tenant(org, "TenantA_" + i, "Sharma", t1Mobile);
            t1.setEmail("t1_org" + i + "_" + runId + "@stayeaze.com");
            t1.setPropertyId(prop.getId());
            t1.setRoomNumber("101");
            t1.setBedNumber("B1");
            t1.setStatus("ACTIVE");
            t1.setRent(BigDecimal.valueOf(8000));
            t1.setLeaseStart("2026-08-01");
            t1 = tenantRepository.saveAndFlush(t1);
            ctx.tenant1 = t1;

            b101A.setTenantId(t1.getId().toString());
            b101A.setTenantName(t1.getName());
            bedRepository.saveAndFlush(b101A);

            String t2Mobile = "96" + String.format("%08d", (int) (Math.random() * 90000000 + 10000000));
            Tenant t2 = new Tenant(org, "TenantB_" + i, "Verma", t2Mobile);
            t2.setEmail("t2_org" + i + "_" + runId + "@stayeaze.com");
            t2.setPropertyId(prop.getId());
            t2.setRoomNumber("102");
            t2.setBedNumber("B1");
            t2.setStatus("ACTIVE");
            t2.setRent(BigDecimal.valueOf(8500));
            t2.setLeaseStart("2026-08-01");
            t2 = tenantRepository.saveAndFlush(t2);
            ctx.tenant2 = t2;

            b102A.setTenantId(t2.getId().toString());
            b102A.setTenantName(t2.getName());
            bedRepository.saveAndFlush(b102A);

            // 8. Invoices (Pending Approval & Unpaid)
            Invoice inv1 = new Invoice();
            inv1.setTenant(t1);
            inv1.setInvoiceNumber("INV-LOAD-PA-" + i + "-" + UUID.randomUUID().toString().substring(0, 5));
            inv1.setAmountDue(BigDecimal.valueOf(8000));
            inv1.setAmountPaid(BigDecimal.ZERO);
            inv1.setStatus("PENDING_APPROVAL");
            inv1.setPaymentMethod("OFFLINE");
            inv1.setPaymentReference("UTR" + System.currentTimeMillis() + i);
            inv1.setDueDate(LocalDate.now().plusDays(5));
            inv1.setIssueDate(LocalDate.now());
            inv1 = invoiceRepository.saveAndFlush(inv1);
            ctx.pendingInvoice = inv1;

            Invoice inv2 = new Invoice();
            inv2.setTenant(t2);
            inv2.setInvoiceNumber("INV-LOAD-UNP-" + i + "-" + UUID.randomUUID().toString().substring(0, 5));
            inv2.setAmountDue(BigDecimal.valueOf(8500));
            inv2.setAmountPaid(BigDecimal.ZERO);
            inv2.setStatus("UNPAID");
            inv2.setDueDate(LocalDate.now().plusDays(10));
            inv2.setIssueDate(LocalDate.now());
            inv2 = invoiceRepository.saveAndFlush(inv2);
            ctx.unpaidInvoice = inv2;

            // 9. Meter Reading (Draft)
            MeterReading mr = new MeterReading();
            mr.setRoom(r101);
            mr.setBillingMonth(8);
            mr.setBillingYear(2026);
            mr.setPreviousReadingValue(BigDecimal.valueOf(100.0));
            mr.setReadingValue(BigDecimal.valueOf(160.0));
            mr.setUnitRate(BigDecimal.valueOf(10.0));
            mr.setUnitsConsumed(BigDecimal.valueOf(60.0));
            mr.setTotalAmount(BigDecimal.valueOf(500.0));
            mr.setStatus("UNBILLED");
            mr.setReadingDate(LocalDate.now());
            mr = meterReadingRepository.saveAndFlush(mr);
            ctx.meterReading = mr;

            // 10. Complaint & Visitor
            Complaint comp = new Complaint(t1, "ELECTRICAL", "Ceiling fan speed regulator faulty in room 101");
            comp.setStatus("OPEN");
            comp = complaintRepository.saveAndFlush(comp);
            ctx.complaint = comp;

            Visitor vis = new Visitor(t1, "Guest " + i, "99887700" + String.format("%02d", i % 100));
            vis.setOrganization(org);
            vis.setProperty(prop);
            vis.setPurpose("Friend visit");
            vis.setStatus("WAITING_APPROVAL");
            vis = visitorRepository.saveAndFlush(vis);
            ctx.visitor = vis;

            orgContexts.add(ctx);
        }

        baselineSeeded = true;
        System.out.println("✅ 50 ORGANIZATIONS SEEDED SUCCESSFULLY WITH FULL ISOLATED GRAPHS!");
        System.out.println("===============================================================================");
    }

    @Test
    @DisplayName("Load Test 1: 50 Concurrent Organization Owners Blasting All Read APIs (High Constant RPS)")
    void testFiftyOrgsConcurrentReadLoadStorm() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(50);
        int requestsPerOrg = 10;
        int totalExpectedHits = NUM_ORGS * requestsPerOrg * 8;

        AtomicInteger totalSuccess = new AtomicInteger(0);
        AtomicInteger totalErrors = new AtomicInteger(0);
        List<Long> latencies = new CopyOnWriteArrayList<>();

        System.out.println("⚡ STARTING 50-ORG CONCURRENT READ STORM (" + totalExpectedHits + " API HITS TOTAL)...");
        long startTime = System.nanoTime();
        CountDownLatch latch = new CountDownLatch(NUM_ORGS);

        for (int i = 0; i < NUM_ORGS; i++) {
            final OrgLoadContext ctx = orgContexts.get(i);
            executor.submit(() -> {
                try {
                    SecurityContextHolder.getContext().setAuthentication(ctx.auth);

                    for (int r = 0; r < requestsPerOrg; r++) {
                        // 1. GET /api/v1/properties
                        hitTrackedEndpoint("GET", "/api/v1/properties", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/properties").with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 2. GET /api/v1/buildings
                        hitTrackedEndpoint("GET", "/api/v1/buildings", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/buildings?propertyId=" + ctx.property.getId()).with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 3. GET /api/v1/rooms
                        hitTrackedEndpoint("GET", "/api/v1/rooms", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/rooms?propertyId=" + ctx.property.getId()).with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 4. GET /api/v1/beds
                        hitTrackedEndpoint("GET", "/api/v1/beds", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/beds?propertyId=" + ctx.property.getId()).with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 5. GET /api/v1/tenants
                        hitTrackedEndpoint("GET", "/api/v1/tenants", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/tenants").with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 6. GET /api/v1/invoices/pending-approvals
                        hitTrackedEndpoint("GET", "/api/v1/invoices/pending-approvals", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/invoices/pending-approvals").with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 7. GET /api/v1/complaints
                        hitTrackedEndpoint("GET", "/api/v1/complaints", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/complaints").with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));

                        // 8. GET /api/v1/visitors
                        hitTrackedEndpoint("GET", "/api/v1/visitors", latencies, totalSuccess, totalErrors, () ->
                                mockMvc.perform(get("/api/v1/visitors").with(authentication(ctx.auth)))
                                        .andExpect(status().isOk()));
                    }
                } catch (Exception e) {
                    totalErrors.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finished = latch.await(120, TimeUnit.SECONDS);
        long elapsedNanos = System.nanoTime() - startTime;
        double elapsedSeconds = elapsedNanos / 1_000_000_000.0;
        executor.shutdown();

        assertTrue(finished, "Load test completed within timeout");
        assertEquals(0, totalErrors.get(), "0 errors allowed across all 50 concurrent orgs");
        assertEquals(totalExpectedHits, totalSuccess.get(), "All requests executed successfully");

        printApiWiseResults("50-ORGANIZATION HIGH-CONCURRENCY READ LOAD BENCHMARK", totalSuccess.get(), elapsedSeconds);
    }

    @Test
    @DisplayName("Load Test 2: 50 Concurrent Organization Owners Blasting Full CRUD Write & Mutation Storm")
    void testFiftyOrgsConcurrentWriteCrudLoadStorm() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(50);
        AtomicInteger totalMutations = new AtomicInteger(0);
        AtomicInteger totalErrors = new AtomicInteger(0);
        List<Long> latencies = new CopyOnWriteArrayList<>();

        System.out.println("⚡ STARTING 50-ORG CONCURRENT WRITE & MUTATION STORM...");
        long startTime = System.nanoTime();
        CountDownLatch latch = new CountDownLatch(NUM_ORGS);

        for (int i = 0; i < NUM_ORGS; i++) {
            final OrgLoadContext ctx = orgContexts.get(i);
            executor.submit(() -> {
                try {
                    SecurityContextHolder.getContext().setAuthentication(ctx.auth);

                    // 1. Concurrent Room Transfer (Move Tenant 1 to Room 102 Bed B2)
                    hitTrackedEndpoint("PUT", "/api/v1/tenants/{id} (Room Transfer)", latencies, totalMutations, totalErrors, () -> {
                        TenantRequest tr = new TenantRequest();
                        tr.setFirstName(ctx.tenant1.getFirstName());
                        tr.setLastName(ctx.tenant1.getLastName());
                        tr.setEmail(ctx.tenant1.getEmail());
                        tr.setMobile(ctx.tenant1.getMobile());
                        tr.setPropertyId(ctx.property.getId());
                        tr.setRoomNumber("102");
                        tr.setBedNumber("B2");
                        tr.setRent(BigDecimal.valueOf(8500));
                        tr.setStatus("ACTIVE");

                        mockMvc.perform(put("/api/v1/tenants/" + ctx.tenant1.getId())
                                        .with(authentication(ctx.auth))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(tr)))
                                .andExpect(status().isOk());
                    });

                    // 2. Concurrent Offline UTR Payment Approval
                    hitTrackedEndpoint("POST", "/api/v1/invoices/{id}/approve-payment", latencies, totalMutations, totalErrors, () -> {
                        mockMvc.perform(post("/api/v1/invoices/" + ctx.pendingInvoice.getId() + "/approve-payment")
                                        .with(authentication(ctx.auth)))
                                .andExpect(status().isOk());
                    });

                    // 3. Concurrent Utility Reading Draft & Apply
                    hitTrackedEndpoint("POST", "/api/v1/utilities/{propId}/bulk-record-readings", latencies, totalMutations, totalErrors, () -> {
                        Map<String, Object> readingItem = Map.of(
                                "roomId", ctx.room101.getId().toString(),
                                "previousReading", 100,
                                "currentReading", 180,
                                "unitRate", 10.0,
                                "freeAllowanceUnits", 0,
                                "billingMonth", 8,
                                "billingYear", 2026,
                                "splitMode", "FAIR_PROPORTIONAL"
                        );
                        Map<String, Object> draftPayload = Map.of(
                                "readings", List.of(readingItem),
                                "appendToRentInvoices", false
                        );

                        mockMvc.perform(post("/api/v1/utilities/properties/" + ctx.property.getId() + "/bulk-record-readings")
                                        .with(authentication(ctx.auth))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(draftPayload)))
                                .andExpect(status().isOk());
                    });

                    // 4. Concurrent Complaint Status Transition (OPEN -> IN_PROGRESS)
                    hitTrackedEndpoint("PUT", "/api/v1/tenants/{tenantId}/complaints/{id}/status", latencies, totalMutations, totalErrors, () -> {
                        mockMvc.perform(put("/api/v1/tenants/" + ctx.tenant1.getId() + "/complaints/" + ctx.complaint.getId() + "/status")
                                        .with(authentication(ctx.auth))
                                        .param("status", "IN_PROGRESS"))
                                .andExpect(status().isOk());
                    });

                    // 5. Concurrent Visitor Check-out
                    hitTrackedEndpoint("PUT", "/api/v1/visitors/{id}", latencies, totalMutations, totalErrors, () -> {
                        mockMvc.perform(put("/api/v1/visitors/" + ctx.visitor.getId())
                                        .with(authentication(ctx.auth))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(Map.of("status", "CHECKED_OUT"))))
                                .andExpect(status().isOk());
                    });

                } catch (Exception e) {
                    totalErrors.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finished = latch.await(120, TimeUnit.SECONDS);
        long elapsedNanos = System.nanoTime() - startTime;
        double elapsedSeconds = elapsedNanos / 1_000_000_000.0;
        executor.shutdown();

        assertTrue(finished, "Mutation storm completed within timeout");
        assertEquals(0, totalErrors.get(), "0 errors allowed in high-concurrency write mutations");
        assertEquals(NUM_ORGS * 5, totalMutations.get(), "All 250 heavy mutations processed successfully");

        printApiWiseResults("50-ORGANIZATION HIGH-CONCURRENCY WRITE MUTATION BENCHMARK", totalMutations.get(), elapsedSeconds);
    }

    @Test
    @DisplayName("Load Test 3: Strict Cross-Tenant Data Isolation Under 50-Org Concurrent Load")
    void testCrossTenantIsolationUnderLoad() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(50);
        AtomicInteger isolationChecks = new AtomicInteger(0);
        AtomicInteger leaksDetected = new AtomicInteger(0);
        CountDownLatch latch = new CountDownLatch(NUM_ORGS);

        System.out.println("⚡ EXECUTING CROSS-TENANT DATA ISOLATION INTEGRITY AUDIT UNDER CONCURRENT LOAD...");

        for (int i = 0; i < NUM_ORGS; i++) {
            final OrgLoadContext ctx = orgContexts.get(i);
            final int orgIdx = i;
            executor.submit(() -> {
                try {
                    SecurityContextHolder.getContext().setAuthentication(ctx.auth);

                    // 1. Check Tenant Isolation: Org must ONLY see its own 2 tenants
                    MvcResult tenantRes = mockMvc.perform(get("/api/v1/tenants").with(authentication(ctx.auth)))
                            .andExpect(status().isOk())
                            .andReturn();

                    JsonNode tenantsNode = objectMapper.readTree(tenantRes.getResponse().getContentAsString());
                    JsonNode tenantList = tenantsNode.isArray() ? tenantsNode : (tenantsNode.has("data") ? tenantsNode.get("data") : tenantsNode.get("content"));

                    if (tenantList != null) {
                        for (JsonNode t : tenantList) {
                            String email = t.has("email") ? t.get("email").asText() : "";
                            if (!email.contains("org" + (orgIdx + 1) + "_") && !email.contains("TenantA_" + (orgIdx + 1)) && !email.contains("TenantB_" + (orgIdx + 1))) {
                                leaksDetected.incrementAndGet();
                            }
                        }
                    }
                    isolationChecks.incrementAndGet();

                    // 2. Check Property Isolation: Org must ONLY see its own 1 property
                    MvcResult propRes = mockMvc.perform(get("/api/v1/properties").with(authentication(ctx.auth)))
                            .andExpect(status().isOk())
                            .andReturn();

                    JsonNode propNode = objectMapper.readTree(propRes.getResponse().getContentAsString());
                    JsonNode propList = propNode.isArray() ? propNode : (propNode.has("data") ? propNode.get("data") : propNode.get("content"));
                    if (propList != null) {
                        for (JsonNode p : propList) {
                            String name = p.has("name") ? p.get("name").asText() : "";
                            if (!name.contains("Property " + (orgIdx + 1) + " PG")) {
                                leaksDetected.incrementAndGet();
                            }
                        }
                    }
                    isolationChecks.incrementAndGet();

                } catch (Exception e) {
                    leaksDetected.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(0, leaksDetected.get(), "Zero cross-tenant data leaks must occur across all 50 organizations!");
        assertEquals(NUM_ORGS * 2, isolationChecks.get(), "All cross-tenant isolation checks completed successfully!");

        System.out.println("===============================================================================");
        System.out.println("🛡️ CROSS-TENANT DATA ISOLATION AUDIT: 100% SECURE, 0 LEAKS ACROSS 50 ORGS!");
        System.out.println("===============================================================================");
    }

    @FunctionalInterface
    interface ThrowableRunnable {
        void run() throws Exception;
    }

    private void hitTrackedEndpoint(String method, String endpointKey, List<Long> globalLatencies, AtomicInteger totalSuccess, AtomicInteger totalErrors, ThrowableRunnable action) {
        EndpointStat stat = endpointStats.computeIfAbsent(method + " " + endpointKey, k -> new EndpointStat(method, endpointKey));
        long start = System.currentTimeMillis();
        boolean ok = false;
        try {
            action.run();
            ok = true;
            totalSuccess.incrementAndGet();
        } catch (Exception e) {
            totalErrors.incrementAndGet();
        } finally {
            long cost = System.currentTimeMillis() - start;
            stat.record(cost, ok);
            globalLatencies.add(cost);
        }
    }

    private void printApiWiseResults(String title, int totalHits, double elapsedSeconds) {
        System.out.println("=====================================================================================================================");
        System.out.println("📊 API-WISE PERFORMANCE METRICS FOR " + title + ":");
        System.out.println("---------------------------------------------------------------------------------------------------------------------");
        System.out.printf("%-6s | %-42s | %-6s | %-9s | %-9s | %-9s | %-9s | %-6s%n",
                "METHOD", "ENDPOINT", "HITS", "AVG (ms)", "P50 (ms)", "P95 (ms)", "MAX (ms)", "ERRORS");
        System.out.println("---------------------------------------------------------------------------------------------------------------------");

        List<EndpointStat> stats = new ArrayList<>(endpointStats.values());
        stats.sort(Comparator.comparing(s -> s.method + " " + s.endpoint));

        for (EndpointStat st : stats) {
            List<Long> l = new ArrayList<>(st.latencies);
            Collections.sort(l);
            double avg = l.stream().mapToLong(Long::longValue).average().orElse(0.0);
            long p50 = l.isEmpty() ? 0 : l.get((int) (l.size() * 0.50));
            long p95 = l.isEmpty() ? 0 : l.get((int) (l.size() * 0.95));
            long max = l.isEmpty() ? 0 : l.get(l.size() - 1);

            System.out.printf("%-6s | %-42s | %-6d | %-9.2f | %-9d | %-9d | %-9d | %-6d%n",
                    st.method, st.endpoint, st.successCount.get() + st.errorCount.get(), avg, p50, p95, max, st.errorCount.get());
        }
        System.out.println("---------------------------------------------------------------------------------------------------------------------");
        System.out.printf("Total Requests: %d | Total Duration: %.2f sec | Overall RPS: %.2f req/sec | Error Rate: 0.00%%%n",
                totalHits, elapsedSeconds, totalHits / elapsedSeconds);
        System.out.println("=====================================================================================================================");
    }
}
