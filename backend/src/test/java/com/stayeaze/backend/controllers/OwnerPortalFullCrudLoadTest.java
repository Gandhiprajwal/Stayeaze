package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.LoginRequest;
import com.stayeaze.backend.payload.request.RoomRequest;
import com.stayeaze.backend.payload.request.TokenRefreshRequest;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.SecurityRateLimitFilter;
import com.stayeaze.backend.security.services.RefreshTokenService;
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
import java.time.OffsetDateTime;
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
public class OwnerPortalFullCrudLoadTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

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
    private BookingRepository bookingRepository;

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

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken authPrincipal;
    private Property propertyAlpha;
    private Property propertyBeta;
    private final List<Building> seededBuildings = new ArrayList<>();
    private final List<Floor> seededFloors = new ArrayList<>();
    private final List<Room> seededRooms = new ArrayList<>();
    private final List<Bed> seededBeds = new ArrayList<>();
    private final List<Tenant> seededTenants = new ArrayList<>();
    private final List<User> authUsers = new ArrayList<>();

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    @BeforeEach
    public void setupAndSeedRelationalBaseline() {
        SecurityRateLimitFilter.bypassForTesting = true;
        rateLimitFilter.clearRateLimits();

        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst()
                .orElseGet(SystemIntegrationSettings::new);
        settings.setRateLimitingEnabled(false);
        settingsRepository.save(settings);

        // 1. Setup SaaS Plan & Organization
        SaaSPlan plan = saasPlanRepository.findByPlanKey("ENTERPRISE").orElseGet(() -> {
            SaaSPlan p = new SaaSPlan("ENTERPRISE", "Enterprise Plan", BigDecimal.valueOf(9999),
                    BigDecimal.valueOf(99999), 50, 5000, 10, true, true, "MONTHLY");
            return saasPlanRepository.save(p);
        });

        testOrg = new Organization("Test Load PG Group", "load-pg-" + UUID.randomUUID().toString().substring(0, 6));
        testOrg.setStatus("ACTIVE");
        testOrg = organizationRepository.saveAndFlush(testOrg);

        OrganizationBillingProfile profile = new OrganizationBillingProfile(testOrg);
        profile.setSubscriptionPlanName("ENTERPRISE");
        billingProfileRepository.saveAndFlush(profile);

        // 2. Setup Roles & Owner Users
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.saveAndFlush(new Role("OWNER", "{}")));

        String rawPassword = "Password@123";
        ownerUser = new User(testOrg, "owner_load_" + UUID.randomUUID().toString().substring(0, 6) + "@stayeaze.com",
                passwordEncoder.encode(rawPassword), "987" + (int) (Math.random() * 9000000 + 1000000));
        ownerUser.setFirstName("Test Owner");
        ownerUser.setStatus("ACTIVE");
        ownerUser.setIsTwoFactorEnabled(false);
        ownerUser.setMustChangePassword(false);
        Set<Role> roles = new HashSet<>();
        roles.add(ownerRole);
        ownerUser.setRoles(roles);
        ownerUser = userRepository.saveAndFlush(ownerUser);

        authUsers.clear();
        for (int i = 0; i < 20; i++) {
            User u = new User(testOrg,
                    "owner_worker_" + i + "_" + UUID.randomUUID().toString().substring(0, 4) + "@stayeaze.com",
                    passwordEncoder.encode(rawPassword), "98" + (int) (Math.random() * 90000000 + 10000000));
            u.setFirstName("Worker " + i);
            u.setStatus("ACTIVE");
            u.setIsTwoFactorEnabled(false);
            u.setMustChangePassword(false);
            Set<Role> uRoles = new HashSet<>();
            uRoles.add(ownerRole);
            u.setRoles(uRoles);
            u = userRepository.saveAndFlush(u);
            authUsers.add(u);
        }

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        authPrincipal = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authPrincipal);

        // 3. Seed 2 Properties
        propertyAlpha = new Property(testOrg, "Test Property Alpha", "100 Innovation Park, Bengaluru");
        propertyAlpha.setCode("TPA-" + UUID.randomUUID().toString().substring(0, 4));
        propertyAlpha.setType("PG");
        propertyAlpha = propertyRepository.save(propertyAlpha);

        propertyBeta = new Property(testOrg, "Test Property Beta", "200 Tech Vista, Bengaluru");
        propertyBeta.setCode("TPB-" + UUID.randomUUID().toString().substring(0, 4));
        propertyBeta.setType("PG");
        propertyBeta = propertyRepository.save(propertyBeta);

        // 4. Seed 6 Buildings across the 2 properties
        String[] buildingNames = { "Test Building A", "Test Building B", "Test Building C", "Test Building D",
                "Test Building E", "Test Building F" };
        for (int i = 0; i < 6; i++) {
            Property targetProp = (i < 3) ? propertyAlpha : propertyBeta;
            Building b = new Building(targetProp, buildingNames[i], "BLK-" + (char) ('A' + i));
            b = buildingRepository.save(b);
            seededBuildings.add(b);
        }

        // 5. Seed 18 Floors (3 floors per building)
        for (Building b : seededBuildings) {
            for (int f = 1; f <= 3; f++) {
                Floor fl = new Floor(b, f, "Floor " + f);
                fl = floorRepository.save(fl);
                seededFloors.add(fl);
            }
        }

        // 6. Seed 72 Rooms (4 rooms per floor)
        for (Floor fl : seededFloors) {
            for (int r = 1; r <= 4; r++) {
                String rNum = String.valueOf(fl.getFloorNumber() * 100 + r);
                String sharing = (r % 2 == 0) ? "DOUBLE" : "TRIPLE";
                Room rm = new Room(fl, rNum, sharing, BigDecimal.valueOf(8500));
                rm = roomRepository.save(rm);
                seededRooms.add(rm);
            }
        }

        // 7. Seed Beds (2 to 3 beds per room)
        for (Room rm : seededRooms) {
            int cap = "DOUBLE".equals(rm.getSharingType()) ? 2 : 3;
            for (int b = 1; b <= cap; b++) {
                Bed bd = new Bed(rm, "Bed " + b);
                bd.setStatus(seededBeds.size() % 2 == 0 ? "OCCUPIED" : "AVAILABLE");
                bd = bedRepository.save(bd);
                seededBeds.add(bd);
            }
        }

        // 8. Seed 120 Test Tenants & Bookings
        int tenantCount = 0;
        for (Bed bd : seededBeds) {
            if (tenantCount >= 120)
                break;
            int tIdx = tenantCount + 1;
            String tEmail = "test_tenant_" + tIdx + "_" + UUID.randomUUID().toString().substring(0, 4)
                    + "@stayeaze.com";
            String tPhone = "99" + (int) (Math.random() * 90000000 + 10000000);

            Tenant t = new Tenant(testOrg, "Test", "Tenant " + tIdx, tPhone);
            t.setEmail(tEmail);
            t.setStatus("ACTIVE");
            t.setPropertyId(propertyAlpha.getId());
            t.setRoomNumber(bd.getRoom().getRoomNumber());
            t.setBedNumber(bd.getBedNumber());
            t.setRent(bd.getRoom().getBaseRent());
            t.setDeposit(BigDecimal.valueOf(15000));
            t = tenantRepository.save(t);
            seededTenants.add(t);

            // Active Booking linking Tenant -> Bed
            Booking bk = new Booking();
            bk.setTenant(t);
            bk.setBed(bd);
            bk.setCheckinDate(LocalDate.now().minusDays(20));
            bk.setCheckoutDate(LocalDate.now().plusMonths(6));
            bk.setStatus("CONFIRMED");
            bk.setRentAgreed(bd.getRoom().getBaseRent());
            bk.setDepositAgreed(BigDecimal.valueOf(15000));
            bookingRepository.save(bk);

            tenantCount++;
        }

        // 9. Seed Utility Meter Readings
        for (int i = 0; i < Math.min(150, seededRooms.size()); i++) {
            Room rm = seededRooms.get(i);
            MeterReading mr = new MeterReading();
            mr.setRoom(rm);
            mr.setBillingMonth(8);
            mr.setBillingYear(2026);
            mr.setReadingDate(LocalDate.now());
            mr.setPreviousReadingValue(BigDecimal.valueOf(100));
            mr.setReadingValue(BigDecimal.valueOf(220));
            mr.setUnitsConsumed(BigDecimal.valueOf(120));
            mr.setUnitRate(BigDecimal.valueOf(10.00));
            mr.setTotalAmount(BigDecimal.valueOf(1200));
            meterReadingRepository.save(mr);
        }

        // 10. Seed Complaints & Visitors
        for (int i = 0; i < Math.min(80, seededTenants.size()); i++) {
            Tenant t = seededTenants.get(i);
            Complaint c = new Complaint(t, "PLUMBING", "Routine tap check for tenant " + (i + 1));
            c.setRoom(seededRooms.get(i % seededRooms.size()));
            c.setStatus(i % 2 == 0 ? "RESOLVED" : "OPEN");
            c.setPriority("MEDIUM");
            complaintRepository.save(c);

            Visitor v = new Visitor();
            v.setProperty(propertyAlpha);
            v.setOrganization(testOrg);
            v.setTenant(t);
            v.setVisitorName("Visitor " + (i + 1));
            v.setMobileNumber("98111" + String.format("%05d", i + 1));
            v.setExpectedArrival(OffsetDateTime.now().minusHours(2));
            v.setStatus(i % 2 == 0 ? "CHECKED_OUT" : "INSIDE");
            visitorRepository.save(v);
        }
    }

    @Test
    @DisplayName("🚀 High-Concurrency Full CRUD & Auth Load Benchmark Test")
    public void runFullCrudAndAuthConcurrencyLoadTest() throws Exception {
        System.out.println("===============================================================================");
        System.out.println("  STARTING FULL CRUD & AUTH LIFECYCLE LOAD BENCHMARK (20 VIRTUAL WORKERS)");
        System.out.println("  Database Seeded: 2 Properties, 6 Towers, 18 Floors, 72 Rooms, 200 Beds, 120 Tenants");
        System.out.println("===============================================================================");

        int concurrentThreads = 20;
        ExecutorService executor = Executors.newFixedThreadPool(concurrentThreads);

        Map<String, List<Long>> latencyMetrics = new ConcurrentHashMap<>();
        AtomicInteger totalRequests = new AtomicInteger(0);
        AtomicInteger successfulRequests = new AtomicInteger(0);
        AtomicInteger failedRequests = new AtomicInteger(0);

        List<Callable<Void>> tasks = new ArrayList<>();

        // 1. AUTH BENCHMARKS: POST /auth/login, POST /auth/refresh, POST /auth/logout
        for (int i = 0; i < 20; i++) {
            final int workerIdx = i;
            final User targetUser = authUsers.get(workerIdx);
            tasks.add(() -> {
                executeMetric("POST /api/v1/auth/login", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            LoginRequest loginReq = new LoginRequest();
                            loginReq.setEmail(targetUser.getEmail());
                            loginReq.setPassword("Password@123");
                            mockMvc.perform(post("/api/v1/auth/login")
                                    .header("X-Stress-Test", "true")
                                    .header("X-Forwarded-For", "10.0.1." + (workerIdx + 1))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(loginReq)))
                                    .andExpect(status().isOk());
                        });

                // Refresh token benchmark
                executeMetric("POST /api/v1/auth/refresh", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            RefreshToken rt = refreshTokenService.createRefreshToken(targetUser.getId());
                            TokenRefreshRequest refreshReq = new TokenRefreshRequest();
                            refreshReq.setRefreshToken(rt.getToken());
                            mockMvc.perform(post("/api/v1/auth/refresh")
                                    .header("X-Stress-Test", "true")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(refreshReq)))
                                    .andExpect(status().isOk());
                        });

                // Logout benchmark
                executeMetric("POST /api/v1/auth/logout", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            UserDetailsImpl uDetails = UserDetailsImpl.build(targetUser);
                            var uPrincipal = new UsernamePasswordAuthenticationToken(uDetails, null,
                                    uDetails.getAuthorities());
                            mockMvc.perform(post("/api/v1/auth/logout")
                                    .header("X-Stress-Test", "true")
                                    .with(authentication(uPrincipal)))
                                    .andExpect(status().isOk());
                        });
                return null;
            });
        }

        // 2. READ BENCHMARKS: Properties, Buildings, Floors, Rooms, Tenants, Bookings,
        // Utilities, Complaints, Visitors
        for (int i = 0; i < 25; i++) {
            tasks.add(() -> {
                executeMetric("GET /api/v1/properties", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            mockMvc.perform(get("/api/v1/properties").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/buildings", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            mockMvc.perform(get("/api/v1/properties/" + propertyAlpha.getId() + "/buildings")
                                    .with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/floors", latencyMetrics, totalRequests, successfulRequests, failedRequests,
                        () -> {
                            mockMvc.perform(get("/api/v1/properties/" + propertyAlpha.getId() + "/buildings/"
                                    + seededBuildings.get(0).getId() + "/floors").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/rooms", latencyMetrics, totalRequests, successfulRequests, failedRequests,
                        () -> {
                            mockMvc.perform(get("/api/v1/properties/" + propertyAlpha.getId() + "/buildings/"
                                    + seededBuildings.get(0).getId() + "/floors/" + seededFloors.get(0).getId()
                                    + "/rooms").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/tenants", latencyMetrics, totalRequests, successfulRequests, failedRequests,
                        () -> {
                            mockMvc.perform(
                                    get("/api/v1/tenants?page=1&pageSize=20").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/bookings", latencyMetrics, totalRequests, successfulRequests, failedRequests,
                        () -> {
                            mockMvc.perform(get("/api/v1/bookings").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/utilities/stats", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            mockMvc.perform(get("/api/v1/utilities/properties/" + propertyAlpha.getId()
                                    + "/stats?month=8&year=2026").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/utilities/meter-sheet", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            mockMvc.perform(get("/api/v1/utilities/properties/" + propertyAlpha.getId()
                                    + "/meter-sheet?month=8&year=2026").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/complaints", latencyMetrics, totalRequests, successfulRequests,
                        failedRequests, () -> {
                            mockMvc.perform(get("/api/v1/complaints").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                executeMetric("GET /api/v1/visitors", latencyMetrics, totalRequests, successfulRequests, failedRequests,
                        () -> {
                            mockMvc.perform(get("/api/v1/visitors").with(authentication(authPrincipal)))
                                    .andExpect(status().isOk());
                        });
                return null;
            });
        }

        // 3. WRITE BENCHMARKS: POST, PUT, DELETE (Rooms, Complaints)
        for (int i = 0; i < 10; i++) {
            final int idx = i + 1;
            tasks.add(() -> {
                // POST /rooms
                final String[] createdRoomId = new String[1];
                executeMetric("POST /api/v1/rooms", latencyMetrics, totalRequests, successfulRequests, failedRequests,
                        () -> {
                            RoomRequest roomReq = new RoomRequest();
                            roomReq.setRoomNumber("LoadRoom-" + idx);
                            roomReq.setSharingType("SINGLE");
                            roomReq.setBaseRent(BigDecimal.valueOf(9500));
                            MvcResult res = mockMvc
                                    .perform(post("/api/v1/properties/" + propertyAlpha.getId() + "/buildings/"
                                            + seededBuildings.get(0).getId() + "/floors/" + seededFloors.get(0).getId()
                                            + "/rooms")
                                            .with(authentication(authPrincipal))
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(objectMapper.writeValueAsString(roomReq)))
                                    .andExpect(status().isCreated())
                                    .andReturn();
                            Map<String, Object> map = objectMapper.readValue(res.getResponse().getContentAsString(),
                                    Map.class);
                            if (map != null && map.containsKey("id"))
                                createdRoomId[0] = map.get("id").toString();
                        });

                // PUT /rooms/{id}
                if (createdRoomId[0] != null) {
                    executeMetric("PUT /api/v1/rooms/{id}", latencyMetrics, totalRequests, successfulRequests,
                            failedRequests, () -> {
                                RoomRequest updateReq = new RoomRequest();
                                updateReq.setRoomNumber("LoadRoom-" + idx);
                                updateReq.setSharingType("SINGLE");
                                updateReq.setBaseRent(BigDecimal.valueOf(9900));
                                mockMvc.perform(put("/api/v1/properties/" + propertyAlpha.getId() + "/buildings/"
                                        + seededBuildings.get(0).getId() + "/floors/" + seededFloors.get(0).getId()
                                        + "/rooms/" + createdRoomId[0])
                                        .with(authentication(authPrincipal))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(updateReq)))
                                        .andExpect(status().isOk());
                            });

                    // DELETE /rooms/{id}
                    executeMetric("DELETE /api/v1/rooms/{id}", latencyMetrics, totalRequests, successfulRequests,
                            failedRequests, () -> {
                                mockMvc.perform(delete("/api/v1/properties/" + propertyAlpha.getId() + "/buildings/"
                                        + seededBuildings.get(0).getId() + "/floors/" + seededFloors.get(0).getId()
                                        + "/rooms/" + createdRoomId[0])
                                        .with(authentication(authPrincipal)))
                                        .andExpect(status().isOk());
                            });
                }
                return null;
            });
        }

        // Execute all tasks in parallel
        long startTime = System.currentTimeMillis();
        List<Future<Void>> futures = executor.invokeAll(tasks);
        for (Future<Void> f : futures) {
            f.get();
        }
        long totalDurationMs = System.currentTimeMillis() - startTime;
        executor.shutdown();

        // Output Results Table
        System.out.println("===============================================================================");
        System.out.println("                     LOAD BENCHMARK PERFORMANCE RESULTS                        ");
        System.out.println("===============================================================================");
        System.out.printf("%-35s | %-6s | %-8s | %-8s | %-8s | %-8s%n", "Endpoint / Operation", "Calls", "Avg(ms)",
                "P50(ms)", "P95(ms)", "P99(ms)");
        System.out.println("------------------------------------+--------+----------+----------+----------+---------");

        for (Map.Entry<String, List<Long>> entry : latencyMetrics.entrySet()) {
            List<Long> times = entry.getValue();
            Collections.sort(times);
            int size = times.size();
            long avg = (long) times.stream().mapToLong(Long::longValue).average().orElse(0.0);
            long p50 = times.get((int) (size * 0.50));
            long p95 = times.get(Math.min(size - 1, (int) (size * 0.95)));
            long p99 = times.get(Math.min(size - 1, (int) (size * 0.99)));
            System.out.printf("%-35s | %-6d | %-8d | %-8d | %-8d | %-8d%n", entry.getKey(), size, avg, p50, p95, p99);
        }

        System.out.println("-------------------------------------------------------------------------------");
        double rps = (totalRequests.get() * 1000.0) / totalDurationMs;
        System.out.printf("Total Requests Executed: %d%n", totalRequests.get());
        System.out.printf("Successful Requests:     %d (%.2f%%)%n", successfulRequests.get(),
                (successfulRequests.get() * 100.0) / totalRequests.get());
        System.out.printf("Failed Requests:         %d%n", failedRequests.get());
        System.out.printf("Total Duration:          %d ms (%.2f seconds)%n", totalDurationMs, totalDurationMs / 1000.0);
        System.out.printf("Throughput (RPS):        %.2f requests/sec%n", rps);
        System.out.println("===============================================================================");

        assertEquals(0, failedRequests.get(), "Expected 0 failed requests during load test execution!");
    }

    private void executeMetric(String name, Map<String, List<Long>> map, AtomicInteger total, AtomicInteger success,
            AtomicInteger fail, TestAction action) {
        total.incrementAndGet();
        long start = System.currentTimeMillis();
        try {
            action.run();
            long elapsed = System.currentTimeMillis() - start;
            success.incrementAndGet();
            map.computeIfAbsent(name, k -> Collections.synchronizedList(new ArrayList<>())).add(elapsed);
        } catch (Exception e) {
            fail.incrementAndGet();
            System.err.println("Load test failed on " + name + ": " + e.getMessage());
        }
    }

    @FunctionalInterface
    private interface TestAction {
        void run() throws Exception;
    }
}
