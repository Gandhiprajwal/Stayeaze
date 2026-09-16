package com.stayeaze.backend.config;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private SaaSPlanRepository saaSPlanRepository;

    @Autowired
    private SaaSInvoiceRepository saaSInvoiceRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

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
    private TenantDocumentRepository tenantDocumentRepository;

    @Autowired
    private com.stayeaze.backend.services.OccupancySyncService occupancySyncService;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private CheckOutRepository checkOutRepository;

    @Autowired
    private CheckinChecklistRepository checkinChecklistRepository;

    @Autowired
    private CheckoutAuditRepository checkoutAuditRepository;

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private PenaltyDiscountRepository penaltyDiscountRepository;

    @Autowired
    private MeterReadingRepository meterReadingRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private ComplaintChatMessageRepository complaintChatMessageRepository;

    @Autowired
    private MaintenanceRepository maintenanceRepository;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private FrontDeskShiftHandoverRepository frontDeskShiftHandoverRepository;

    @Autowired
    private VisitorRepository visitorRepository;

    @Autowired
    private ParcelRepository parcelRepository;

    @Autowired
    private KeyLoanRepository keyLoanRepository;

    @Autowired
    private LostAndFoundItemRepository lostAndFoundItemRepository;

    @Autowired
    private SafetyIncidentRepository safetyIncidentRepository;

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private InquiryRepository inquiryRepository;

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    @Autowired
    private SubscriptionExtensionRequestRepository subscriptionExtensionRequestRepository;

    @Autowired
    private SupportTicketMessageRepository supportTicketMessageRepository;

    @Autowired
    private OnboardingLeadRepository onboardingLeadRepository;

    @Autowired
    private SystemIntegrationSettingsRepository systemIntegrationSettingsRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private UserJourneyAuditRepository userJourneyAuditRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Override
    public void run(String... args) throws Exception {
        System.out.println("==================================================");
        System.out.println("🚀 STAYEAZE DATABASE SEEDER: INITIALIZING SCHEMA & DATA RESET...");
        System.out.println("==================================================");

        // Schema compatibility tweaks
        try {
            jdbcTemplate.execute("ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_check");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE rooms DROP COLUMN IF EXISTS wifi_ssid");
            jdbcTemplate.execute("ALTER TABLE rooms DROP COLUMN IF EXISTS wifi_password");
            jdbcTemplate.execute("ALTER TABLE floors DROP COLUMN IF EXISTS wifi_ssid");
            jdbcTemplate.execute("ALTER TABLE floors DROP COLUMN IF EXISTS wifi_password");
        } catch (Exception ignored) {}

        seedAllFresh();

        System.out.println("==================================================");
        System.out.println("✅ STAYEAZE DATABASE SEEDING COMPLETED SUCCESSFULLY!");
        System.out.println("   Super Admin: superadmin@stayeaze.com / Friend@2010");
        System.out.println("   Support:     support@stayeaze.com    / Friend@2010");
        System.out.println("   Owner:       owner@stayeaze.com      / Password@123");
        System.out.println("   Manager:     manager@stayeaze.com    / Password@123");
        System.out.println("   Accountant:  accountant@stayeaze.com / Password@123");
        System.out.println("   Reception:   receptionist@stayeaze.com / Password@123");
        System.out.println("   Security:    security@stayeaze.com   / Password@123");
        System.out.println("   Staff:       staff@stayeaze.com      / Password@123");
        System.out.println("   Resident:    tenant@stayeaze.com     / Password@123");
        System.out.println("==================================================");
    }

    @Transactional
    public void seedAllFresh() {
        // 1. Seed Core SaaS Plans
        seedSaaSPlans();

        // 2. Seed All System Roles & Permissions
        seedRoles();

        // 3. Seed Super Admin & Platform Support under System Org
        Organization systemOrg = seedSystemAccounts();

        // 4. Seed System Integration Settings & System Config
        seedSystemSettings();

        // 5. Seed Demo Organization ("StayEaze Royal Living") with Complete Relational Hierarchy
        seedDemoOrganizationAndRelationalWorkspaces();
    }

    private void seedSaaSPlans() {
        // 1. Starter PG Plan
        SaaSPlan starter = saaSPlanRepository.findByPlanKey("STARTER").orElseGet(SaaSPlan::new);
        starter.setName("Starter PG Plan");
        starter.setPlanKey("STARTER");
        starter.setMonthlyPrice(new BigDecimal("1499.00"));
        starter.setAnnualPrice(new BigDecimal("14390.00"));
        starter.setMaxProperties(1);
        starter.setMaxBeds(35);
        starter.setMaxStaffUsers(2);
        starter.setAllowWhatsApp(false);
        starter.setAllowCustomBranding(false);
        starter.setDescription("Ideal for Single-Building Standalone PGs (Up to 15 Rooms / 35 Beds in 2 & 3 sharing, 2 Staff logins).");
        starter.setAllowRazorpayOnline(true);
        saaSPlanRepository.save(starter);

        // 2. Growth Hostel / Multi-Wing PG (Most Popular)
        SaaSPlan professional = saaSPlanRepository.findByPlanKey("PROFESSIONAL").orElseGet(SaaSPlan::new);
        professional.setName("Growth Hostel & PG");
        professional.setPlanKey("PROFESSIONAL");
        professional.setMonthlyPrice(new BigDecimal("3499.00"));
        professional.setAnnualPrice(new BigDecimal("33590.00"));
        professional.setMaxProperties(2);
        professional.setMaxBeds(120);
        professional.setMaxStaffUsers(6);
        professional.setAllowWhatsApp(true);
        professional.setAllowCustomBranding(false);
        professional.setDescription("For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements).");
        professional.setAllowRazorpayOnline(true);
        saaSPlanRepository.save(professional);

        // 3. Enterprise Co-Living Chain
        SaaSPlan enterprise = saaSPlanRepository.findByPlanKey("ENTERPRISE").orElseGet(SaaSPlan::new);
        enterprise.setName("Enterprise Living Chain");
        enterprise.setPlanKey("ENTERPRISE");
        enterprise.setMonthlyPrice(new BigDecimal("7999.00"));
        enterprise.setAnnualPrice(new BigDecimal("76790.00"));
        enterprise.setMaxProperties(10);
        enterprise.setMaxBeds(500);
        enterprise.setMaxStaffUsers(25);
        enterprise.setAllowWhatsApp(true);
        enterprise.setAllowCustomBranding(true);
        enterprise.setDescription("For Multi-City Co-Living Chains (Unlimited Buildings, 500+ Beds, Bulk Rent Runs, Custom Subdomain & Priority SLA).");
        enterprise.setAllowRazorpayOnline(true);
        saaSPlanRepository.save(enterprise);
    }

    private void seedRoles() {
        seedRoleIfNotFound(ERole.SUPER_ADMIN, "[\"ALL\"]");
        seedRoleIfNotFound(ERole.SUPPORT, "[\"support.read\", \"support.write\", \"support.tickets.manage\", \"audit.logs.view\"]");
        seedRoleIfNotFound(ERole.OWNER, "[\"ALL\"]");
        seedRoleIfNotFound(ERole.PROPERTY_MANAGER, "[\"space.matrix.view\", \"space.matrix.manage\", \"space.batch.generate\", \"building.manage\", \"tenant.read\", \"tenant.write\", \"tenant.kyc.verify\", \"tenant.transfer.execute\", \"booking.manage\", \"agreement.read\", \"agreement.generate\", \"agreement.terminate\", \"billing.read\", \"billing.write\", \"billing.bulk.run\", \"utility.meter.record\", \"payment.record\", \"deposit.manage\", \"gate.visitor.read\", \"gate.visitor.log\", \"gate.parcel.manage\", \"security.incident.log\", \"complaint.read\", \"complaint.resolve\", \"maintenance.manage\", \"messaging.whatsapp.send\", \"reports.gst.export\", \"reports.hra.generate\"]");
        seedRoleIfNotFound(ERole.ACCOUNTANT, "[\"billing.read\", \"billing.write\", \"billing.bulk.run\", \"utility.meter.record\", \"payment.record\", \"deposit.manage\", \"reports.gst.export\", \"reports.hra.generate\", \"messaging.whatsapp.send\"]");
        seedRoleIfNotFound(ERole.RECEPTIONIST, "[\"space.matrix.view\", \"tenant.read\", \"tenant.write\", \"tenant.kyc.verify\", \"booking.manage\", \"agreement.read\", \"agreement.generate\", \"gate.visitor.read\", \"gate.visitor.log\", \"gate.parcel.manage\", \"complaint.read\"]");
        seedRoleIfNotFound(ERole.SECURITY_GUARD, "[\"gate.visitor.read\", \"gate.visitor.log\", \"gate.parcel.manage\", \"security.incident.log\"]");
        seedRoleIfNotFound(ERole.STAFF, "[\"space.matrix.view\", \"complaint.read\", \"complaint.resolve\", \"maintenance.manage\"]");
        seedRoleIfNotFound(ERole.TENANT, "[\"tenant.self\", \"billing.self.read\", \"complaint.self\", \"gate.self.visitor\"]");
    }

    private void seedRoleIfNotFound(ERole roleName, String permissions) {
        if (roleRepository.findByName(roleName).isEmpty()) {
            Role role = new Role(roleName, permissions);
            roleRepository.save(role);
        }
    }

    private Organization seedSystemAccounts() {
        Organization systemOrg = organizationRepository.findBySubdomain("system")
                .orElseGet(() -> organizationRepository.save(new Organization("StayEaze SaaS System", "system")));

        Role superAdminRole = roleRepository.findByName(ERole.SUPER_ADMIN).orElse(null);
        Role supportRole = roleRepository.findByName(ERole.SUPPORT).orElse(null);

        // Super Admin
        User superAdmin = userRepository.findByEmail("superadmin@stayeaze.com")
                .orElseGet(() -> new User(systemOrg, "superadmin@stayeaze.com", encoder.encode("Friend@2010"), "9845112230"));
        superAdmin.setFirstName("Super Admin");
        superAdmin.setStatus("ACTIVE");
        superAdmin.setOrganization(systemOrg);
        if (superAdmin.getRoles() == null) superAdmin.setRoles(new HashSet<>());
        if (superAdminRole != null && !superAdmin.getRoles().contains(superAdminRole)) {
            superAdmin.getRoles().add(superAdminRole);
        }
        userRepository.save(superAdmin);

        // Platform Support
        User supportUser = userRepository.findByEmail("support@stayeaze.com")
                .orElseGet(() -> new User(systemOrg, "support@stayeaze.com", encoder.encode("Friend@2010"), "9845112231"));
        supportUser.setFirstName("Platform Support Specialist");
        supportUser.setStatus("ACTIVE");
        supportUser.setOrganization(systemOrg);
        if (supportUser.getRoles() == null) supportUser.setRoles(new HashSet<>());
        if (supportRole != null && !supportUser.getRoles().contains(supportRole)) {
            supportUser.getRoles().add(supportRole);
        }
        userRepository.save(supportUser);

        return systemOrg;
    }

    private void seedSystemSettings() {
        SystemIntegrationSettings settings = systemIntegrationSettingsRepository.findAll().stream()
                .findFirst()
                .orElseGet(SystemIntegrationSettings::new);
        settings.setSaasCompanyName("StayEaze Technologies Private Limited");
        settings.setSaasGstin("29AAACS1234E1Z8");
        settings.setSaasPan("AAACS1234E");
        settings.setSaasSupportEmail("support@stayeaze.com");
        settings.setSaasSupportPhone("+919845112230");
        settings.setSaasAddress("#102, Innovation Hub, Outer Ring Road, Bellandur, Bangalore 560103");
        settings.setSaasWebsiteUrl("https://stayeaze.com");
        settings.setCurrency("INR");
        settings.setDefaultTaxRate(18.0);
        settings.setGracePeriodDays(5);
        settings.setInvoicePrefix("SE-SAAS");
        settings.setOnboardingMode("ENABLED");
        settings.setMaintenanceModeEnabled(false);
        systemIntegrationSettingsRepository.save(settings);
    }

    private void seedDemoOrganizationAndRelationalWorkspaces() {
        Optional<Organization> existingDemo = organizationRepository.findBySubdomain("royal-living");
        System.out.println("🔍 [DatabaseSeeder] existingDemo present? " + existingDemo.isPresent());
        if (existingDemo.isPresent()) {
            return;
        }

        // ==========================================
        // 1. ORGANIZATION
        // ==========================================
        Organization demoOrg = new Organization("StayEaze Royal Living", "royal-living");
        demoOrg.setGstEnabled(true);
        demoOrg.setGstin("29AAACL1234F1Z5");
        demoOrg.setGstTradeName("StayEaze Royal Living Hospitality LLP");
        demoOrg.setDefaultGstRate(new BigDecimal("12.00"));
        demoOrg = organizationRepository.save(demoOrg);
        System.out.println("🏢 [DatabaseSeeder] demoOrg saved: " + demoOrg.getId());

        // ==========================================
        // 2. ORGANIZATION BILLING PROFILE
        // ==========================================
        OrganizationBillingProfile profile = new OrganizationBillingProfile();
        profile.setOrganization(demoOrg);
        profile.setLegalName("StayEaze Royal Living Hospitality LLP");
        profile.setBillingAddress("#45, 80 Feet Road, 4th Block, Koramangala");
        profile.setCity("Bangalore");
        profile.setState("Karnataka");
        profile.setPincode("560034");
        profile.setSupportEmail("support@royalliving.com");
        profile.setSupportPhone("9845112233");
        profile.setGstin("29AAACL1234F1Z5");
        profile.setPan("AAACL1234F");
        profile.setInvoicePrefix("SERL");
        profile.setPaymentDueDays(5);
        profile.setDefaultSecurityDeposit(new BigDecimal("20000.00"));
        profile.setMinimumLockInMonths(3);
        profile.setNoticePeriodDays(30);
        profile.setDefaultExitCleaningFee(new BigDecimal("500.00"));
        profile.setDefaultElectricityRatePerUnit(new BigDecimal("12.00"));
        profile.setLateFeeGracePeriodDays(5);
        profile.setLateFeePercentage(new BigDecimal("5.00"));
        profile.setBankAccountName("StayEaze Royal Living LLP");
        profile.setBankName("HDFC Bank");
        profile.setBankAccountNumber("50200012345678");
        profile.setBankIfsc("HDFC0001234");
        profile.setUpiVpa("royalliving@hdfcbank");
        profile.setAuthorizedSignatory("Vikramaditya Roy (Managing Partner)");
        profile.setSubscriptionPlanName("Growth Hostel & PG");
        profile.setSubscriptionPlanPrice(new BigDecimal("3499.00"));
        profile.setSubscriptionBillingCycle("MONTHLY");
        profile.setSubscriptionStartDate(OffsetDateTime.now().minusDays(15));
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(15));
        profile.setSubscriptionStatus("ACTIVE");
        organizationBillingProfileRepository.save(profile);

        // Seed SaaS Invoice for this Org
        SaaSInvoice saasInv = new SaaSInvoice(demoOrg, "SAAS-202608-091", "Growth Hostel & PG", 3499.0, 629.82, 4128.82, "PAID");
        saasInv.setTransactionId("pay_saas_rzp_887711");
        saaSInvoiceRepository.save(saasInv);

        // ==========================================
        // 3. ROLES & PERSONA USERS
        // ==========================================
        Role ownerRole = roleRepository.findByName(ERole.OWNER).orElse(null);
        Role managerRole = roleRepository.findByName(ERole.PROPERTY_MANAGER).orElse(null);
        Role accountantRole = roleRepository.findByName(ERole.ACCOUNTANT).orElse(null);
        Role receptionistRole = roleRepository.findByName(ERole.RECEPTIONIST).orElse(null);
        Role securityRole = roleRepository.findByName(ERole.SECURITY_GUARD).orElse(null);
        Role staffRole = roleRepository.findByName(ERole.STAFF).orElse(null);
        Role tenantRole = roleRepository.findByName(ERole.TENANT).orElse(null);

        User ownerUser = createUser("owner@stayeaze.com", "Vikram", "Roy", "9845112233", demoOrg, ownerRole);
        User managerUser = createUser("manager@stayeaze.com", "Ananya", "Deshmukh", "9845112234", demoOrg, managerRole);
        User accountantUser = createUser("accountant@stayeaze.com", "Ramesh", "Iyer", "9845112235", demoOrg, accountantRole);
        User receptionistUser = createUser("receptionist@stayeaze.com", "Kavya", "Menon", "9845112236", demoOrg, receptionistRole);
        User securityUser = createUser("security@stayeaze.com", "Bahadur", "Thapa", "9845112237", demoOrg, securityRole);
        User staffUser = createUser("staff@stayeaze.com", "Suresh", "Kumar", "9845112238", demoOrg, staffRole);

        // ==========================================
        // 4. PROPERTIES & SPACE HIERARCHY
        // ==========================================
        // Property 1: Koramangala
        Property prop1 = new Property();
        prop1.setName("StayEaze Royal Grand PG");
        prop1.setCode("SERG-KOR");
        prop1.setType("CO_LIVING");
        prop1.setAddress("45, 80ft Road, 4th Block, Koramangala, Bangalore");
        prop1.setCity("Bangalore");
        prop1.setState("Karnataka");
        prop1.setPincode("560034");
        prop1.setManager("Ananya Deshmukh");
        prop1.setPhone("+91 98451 12234");
        prop1.setEmail("koramangala@royalliving.com");
        prop1.setOrganization(demoOrg);
        prop1.setStatus("ACTIVE");
        prop1.setAmenities(List.of("High-Speed Wi-Fi (300 Mbps)", "3x Daily Meals", "Biometric Gate Access", "24/7 CCTV", "RO Water Purifier", "Gym & Fitness Zone", "Power Backup (100%)", "Daily Housekeeping"));
        prop1.setCurfewTime("11:00 PM");
        prop1.setSecurityDeposit(new BigDecimal("20000.00"));
        prop1 = propertyRepository.save(prop1);
        System.out.println("🏨 [DatabaseSeeder] prop1 saved: " + prop1.getId());

        // Assign Staff Property Scopes
        assignPropertyScope(managerUser, prop1.getId());
        assignPropertyScope(receptionistUser, prop1.getId());
        assignPropertyScope(securityUser, prop1.getId());
        assignPropertyScope(staffUser, prop1.getId());

        // Building 1: Tower A
        Building bld1A = buildingRepository.save(new Building(prop1, "Tower A (Main Wing)", "TOWER-A"));
        Floor flr1A_1 = floorRepository.save(new Floor(bld1A, 1, "1st Floor - Executive"));
        Floor flr1A_2 = floorRepository.save(new Floor(bld1A, 2, "2nd Floor - Premium Suites"));

        // Rooms on Tower A, Floor 1
        Room room101 = roomRepository.save(new Room(flr1A_1, "101", "DOUBLE", new BigDecimal("12000.00")));
        Bed bed101A = bedRepository.save(new Bed(room101, "101-A"));
        Bed bed101B = bedRepository.save(new Bed(room101, "101-B"));

        Room room102 = roomRepository.save(new Room(flr1A_1, "102", "TRIPLE", new BigDecimal("8500.00")));
        Bed bed102A = bedRepository.save(new Bed(room102, "102-A"));
        Bed bed102B = bedRepository.save(new Bed(room102, "102-B"));
        Bed bed102C = bedRepository.save(new Bed(room102, "102-C"));

        // Rooms on Tower A, Floor 2
        Room room201 = roomRepository.save(new Room(flr1A_2, "201", "SINGLE", new BigDecimal("18000.00")));
        Bed bed201A = bedRepository.save(new Bed(room201, "201-A"));

        Room room202 = roomRepository.save(new Room(flr1A_2, "202", "DOUBLE", new BigDecimal("12000.00")));
        Bed bed202A = bedRepository.save(new Bed(room202, "202-A")); // Will be RESERVED for advance booking
        Bed bed202B = bedRepository.save(new Bed(room202, "202-B")); // AVAILABLE

        // Building 2: Tower B
        Building bld1B = buildingRepository.save(new Building(prop1, "Tower B (Executive Annex)", "TOWER-B"));
        Floor flr1B_1 = floorRepository.save(new Floor(bld1B, 1, "1st Floor - Tech Wing"));

        Room roomB101 = roomRepository.save(new Room(flr1B_1, "B-101", "SINGLE", new BigDecimal("16000.00")));
        Bed bedB101A = bedRepository.save(new Bed(roomB101, "B101-A"));

        Room roomB102 = roomRepository.save(new Room(flr1B_1, "B-102", "DOUBLE", new BigDecimal("13000.00")));
        Bed bedB102A = bedRepository.save(new Bed(roomB102, "B102-A")); // AVAILABLE
        Bed bedB102B = bedRepository.save(new Bed(roomB102, "B102-B")); // MAINTENANCE
        bedB102B.setStatus("MAINTENANCE");
        bedRepository.save(bedB102B);

        // Property 2: HSR Layout
        Property prop2 = new Property();
        prop2.setName("StayEaze CyberCity PG");
        prop2.setCode("SECC-HSR");
        prop2.setType("HOSTEL");
        prop2.setAddress("Sector 2, 27th Main, HSR Layout, Bangalore");
        prop2.setCity("Bangalore");
        prop2.setState("Karnataka");
        prop2.setPincode("560102");
        prop2.setManager("Ananya Deshmukh");
        prop2.setPhone("+91 98451 12234");
        prop2.setEmail("hsr@royalliving.com");
        prop2.setOrganization(demoOrg);
        prop2.setStatus("ACTIVE");
        prop2.setAmenities(List.of("High-Speed Wi-Fi", "2x Daily Meals", "CCTV", "RO Water", "Power Backup"));
        prop2 = propertyRepository.save(prop2);
        assignPropertyScope(managerUser, prop2.getId());

        Building bld2 = buildingRepository.save(new Building(prop2, "Block C (Cyber Wing)", "BLOCK-C"));
        Floor flr2_1 = floorRepository.save(new Floor(bld2, 1, "Ground Floor"));

        Room roomC101 = roomRepository.save(new Room(flr2_1, "C-101", "DOUBLE", new BigDecimal("10000.00")));
        Bed bedC101A = bedRepository.save(new Bed(roomC101, "C101-A"));
        Bed bedC101B = bedRepository.save(new Bed(roomC101, "C101-B")); // AVAILABLE

        Room roomC102 = roomRepository.save(new Room(flr2_1, "C-102", "TRIPLE", new BigDecimal("8000.00")));
        Bed bedC102A = bedRepository.save(new Bed(roomC102, "C102-A"));
        Bed bedC102B = bedRepository.save(new Bed(roomC102, "C102-B")); // AVAILABLE

        // ==========================================
        // 5. TENANTS & USER LINKAGES
        // ==========================================
        // Tenant 1: Rahul Sharma (Primary Demo Tenant)
        Tenant t1 = createTenant(demoOrg, prop1.getId(), "Rahul", "Sharma", "tenant@stayeaze.com", "9845112240",
                "MALE", "101", "101-A", new BigDecimal("12000.00"), new BigDecimal("24000.00"), "Senior Software Engineer", "VERIFIED");
        User tenantUser = createUser("tenant@stayeaze.com", "Rahul", "Sharma", "9845112240", demoOrg, tenantRole);
        tenantUser.setTenantId(t1.getId());
        userRepository.save(tenantUser);
        occupyBed(bed101A, t1);

        // Tenant 2: Priya Patel
        Tenant t2 = createTenant(demoOrg, prop1.getId(), "Priya", "Patel", "priya.patel@gmail.com", "9845112241",
                "FEMALE", "101", "101-B", new BigDecimal("12000.00"), new BigDecimal("24000.00"), "Product Designer", "VERIFIED");
        occupyBed(bed101B, t2);

        // Tenant 3: Amit Kumar
        Tenant t3 = createTenant(demoOrg, prop1.getId(), "Amit", "Kumar", "amit.kumar@gmail.com", "9845112242",
                "MALE", "102", "102-A", new BigDecimal("8500.00"), new BigDecimal("17000.00"), "Data Analyst", "VERIFIED");
        occupyBed(bed102A, t3);

        // Tenant 4: Rohan Verma
        Tenant t4 = createTenant(demoOrg, prop1.getId(), "Rohan", "Verma", "rohan.v@gmail.com", "9845112243",
                "MALE", "102", "102-B", new BigDecimal("8500.00"), new BigDecimal("17000.00"), "Marketing Specialist", "VERIFIED");
        occupyBed(bed102B, t4);

        // Tenant 5: Sneha Reddy
        Tenant t5 = createTenant(demoOrg, prop1.getId(), "Sneha", "Reddy", "sneha.r@gmail.com", "9845112244",
                "FEMALE", "201", "201-A", new BigDecimal("18000.00"), new BigDecimal("36000.00"), "Engineering Manager", "VERIFIED");
        occupyBed(bed201A, t5);

        // Tenant 6: Aditya Joshi (Tower B)
        Tenant t6 = createTenant(demoOrg, prop1.getId(), "Aditya", "Joshi", "aditya.j@gmail.com", "9845112246",
                "MALE", "B-101", "B101-A", new BigDecimal("16000.00"), new BigDecimal("32000.00"), "DevOps Architect", "VERIFIED");
        occupyBed(bedB101A, t6);

        // Tenant 7: Vikram Singh (Property 2)
        Tenant t7 = createTenant(demoOrg, prop2.getId(), "Vikram", "Singh", "vikram.s@gmail.com", "9845112245",
                "MALE", "C-101", "C101-A", new BigDecimal("10000.00"), new BigDecimal("20000.00"), "Management Consultant", "VERIFIED");
        occupyBed(bedC101A, t7);

        // Tenant 8: Ankit Mehta (Property 2)
        Tenant t8 = createTenant(demoOrg, prop2.getId(), "Ankit", "Mehta", "ankit.m@gmail.com", "9845112247",
                "MALE", "C-102", "C102-A", new BigDecimal("8000.00"), new BigDecimal("16000.00"), "Cybersecurity Analyst", "VERIFIED");
        occupyBed(bedC102A, t8);

        // Tenant 9: Meera Nair (Checked out past resident)
        Tenant t9 = createTenant(demoOrg, prop1.getId(), "Meera", "Nair", "meera.n@gmail.com", "9845112248",
                "FEMALE", "102", "102-C", new BigDecimal("8500.00"), new BigDecimal("17000.00"), "Chartered Accountant", "VERIFIED");
        t9.setStatus("CHECKED_OUT");
        tenantRepository.save(t9);

        // Tenant 10: Kabir Khan (Advance Booking)
        Tenant t10 = createTenant(demoOrg, prop1.getId(), "Kabir", "Khan", "kabir.k@gmail.com", "9845112249",
                "MALE", "202", "202-A", new BigDecimal("12000.00"), new BigDecimal("24000.00"), "AI Researcher", "VERIFIED");

        // ==========================================
        // 6. TENANT DOCUMENTS (DOCUMENT VAULT)
        // ==========================================
        seedTenantDocument(t1, "AADHAAR_FRONT", "XXXX-XXXX-9901", "https://stayeaze-vault.s3.amazonaws.com/docs/rahul_aadhaar_front.jpg", managerUser);
        seedTenantDocument(t1, "AADHAAR_BACK", "XXXX-XXXX-9901", "https://stayeaze-vault.s3.amazonaws.com/docs/rahul_aadhaar_back.jpg", managerUser);
        seedTenantDocument(t1, "POLICE_VERIFICATION", "PV-BLR-2026-0811", "https://stayeaze-vault.s3.amazonaws.com/docs/rahul_police_verif.pdf", managerUser);
        seedTenantDocument(t2, "PASSPORT", "P8891024", "https://stayeaze-vault.s3.amazonaws.com/docs/priya_passport.pdf", managerUser);
        seedTenantDocument(t5, "AADHAAR_FRONT", "XXXX-XXXX-5512", "https://stayeaze-vault.s3.amazonaws.com/docs/sneha_aadhaar.jpg", managerUser);

        // ==========================================
        // 7. DIGITAL AGREEMENTS
        // ==========================================
        seedAgreement(t1, LocalDate.now().minusMonths(3), LocalDate.now().plusMonths(9), "SIGNED");
        seedAgreement(t2, LocalDate.now().minusMonths(2), LocalDate.now().plusMonths(10), "SIGNED");
        seedAgreement(t3, LocalDate.now().minusMonths(1), LocalDate.now().plusMonths(11), "SIGNED");
        seedAgreement(t5, LocalDate.now().minusMonths(4), LocalDate.now().plusMonths(8), "SIGNED");
        seedAgreement(t7, LocalDate.now().minusMonths(2), LocalDate.now().plusMonths(10), "SIGNED");

        // ==========================================
        // 8. BOOKINGS, CHECK-INS & CHECK-OUT AUDITS
        // ==========================================
        // Active Booking & CheckIn for Rahul
        Booking b1 = seedBooking(t1, bed101A, LocalDate.now().minusMonths(3), "CONFIRMED", new BigDecimal("12000.00"), new BigDecimal("24000.00"));
        seedCheckIn(t1, prop1.getId(), "101", "101-A", b1, new BigDecimal("12000.00"), new BigDecimal("24000.00"));
        checkinChecklistRepository.save(new CheckinChecklist(b1, true, true, new BigDecimal("1050.00")));

        // Advance Booking on Bed 202-A for Kabir Khan
        Booking bAdvance = seedBooking(t10, bed202A, LocalDate.now().plusDays(5), "CONFIRMED", new BigDecimal("12000.00"), new BigDecimal("24000.00"));
        bAdvance.setAdvanceAmount(new BigDecimal("2000.00"));
        bAdvance.setAdvancePaymentStatus("COMPLETED");
        bAdvance.setPaymentMethod("RAZORPAY");
        bAdvance.setRazorpayPaymentId("pay_adv_rzp_991823");
        bookingRepository.save(bAdvance);
        bed202A.setStatus("RESERVED");
        bedRepository.save(bed202A);

        // Past Check-Out with Damage Audit for Meera Nair
        Booking bPast = seedBooking(t9, bed102C, LocalDate.now().minusMonths(6), "CHECKED_OUT", new BigDecimal("8500.00"), new BigDecimal("17000.00"));
        bPast.setCheckoutDate(LocalDate.now().minusDays(10));
        bookingRepository.save(bPast);

        CheckOut chkOut = new CheckOut();
        chkOut.setOrganization(demoOrg);
        chkOut.setTenantName(t9.getName());
        chkOut.setPropertyId(prop1.getId());
        chkOut.setRoomNumber("102");
        chkOut.setBedNumber("102-C");
        chkOut.setCheckOutDate(LocalDate.now().minusDays(10));
        chkOut.setNoticeDate(LocalDate.now().minusDays(40));
        chkOut.setDepositRefund(new BigDecimal("17000.00"));
        chkOut.setDeductions(new BigDecimal("2000.00"));
        chkOut.setNetRefundAmount(new BigDecimal("15000.00"));
        chkOut.setReason("Relocated to Mumbai for new job");
        chkOut.setStatus("completed");
        chkOut.setRefundStatus("REFUNDED");
        chkOut.setRefundPaymentMode("UPI");
        chkOut.setRefundTransactionRef("UPI-REF-REFUND-99120");
        chkOut.setRefundApprovedBy("Ananya Deshmukh (Manager)");
        chkOut.setRefundApprovedAt(OffsetDateTime.now().minusDays(9));
        checkOutRepository.save(chkOut);

        checkoutAuditRepository.save(new CheckoutAudit(bPast, true, new BigDecimal("2000.00"), true, new BigDecimal("15000.00")));

        // ==========================================
        // 9. TIME-SHIFTED FINANCIALS & PAYMENTS (PAST 6 MONTHS)
        // ==========================================
        LocalDate today = LocalDate.now();
        LocalDate curMonthStart = today.withDayOfMonth(1);

        // Month 1 to 5: Paid Historical Invoices
        for (int i = 5; i >= 1; i--) {
            LocalDate mStart = curMonthStart.minusMonths(i);
            String mCode = String.format("%d%02d", mStart.getYear(), mStart.getMonthValue());

            // Rahul's Paid Historical Rent
            Invoice invR = createInvoice(t1, "SERL-" + mCode + "-101", mStart.plusDays(5), mStart, new BigDecimal("12000.00"), "PAID", new BigDecimal("12000.00"));
            invR.getItems().add(new InvoiceItem(invR, "Monthly Accommodation Rent (Room 101, Bed 101-A)", new BigDecimal("12000.00")));
            invoiceRepository.save(invR);
            createPayment(invR, new BigDecimal("12000.00"), "UPI", "UPI-REF-" + mCode + "01", mStart.plusDays(3));

            // Priya's Paid Historical Rent
            Invoice invP = createInvoice(t2, "SERL-" + mCode + "-102", mStart.plusDays(5), mStart, new BigDecimal("12000.00"), "PAID", new BigDecimal("12000.00"));
            invP.getItems().add(new InvoiceItem(invP, "Monthly Accommodation Rent (Room 101, Bed 101-B)", new BigDecimal("12000.00")));
            invoiceRepository.save(invP);
            createPayment(invP, new BigDecimal("12000.00"), "RAZORPAY", "pay_rzp_" + mCode + "02", mStart.plusDays(2));

            // Sneha's Paid Single Luxury Suite
            Invoice invS = createInvoice(t5, "SERL-" + mCode + "-201", mStart.plusDays(5), mStart, new BigDecimal("18000.00"), "PAID", new BigDecimal("18000.00"));
            invS.getItems().add(new InvoiceItem(invS, "Monthly Accommodation Rent (Single Suite 201)", new BigDecimal("18000.00")));
            invoiceRepository.save(invS);
            createPayment(invS, new BigDecimal("18000.00"), "NETBANKING", "HDFC-NB-" + mCode + "05", mStart.plusDays(1));
        }

        // Current Month Invoices:
        // Rahul: Unpaid Overdue for testing payment checkout
        String curCode = String.format("%d%02d", curMonthStart.getYear(), curMonthStart.getMonthValue());
        Invoice invRahulCur = createInvoice(t1, "SERL-" + curCode + "-001", curMonthStart.plusDays(5), curMonthStart, new BigDecimal("12000.00"), "UNPAID", BigDecimal.ZERO);
        invRahulCur.getItems().add(new InvoiceItem(invRahulCur, "Monthly Accommodation Rent (Room 101, Bed 101-A)", new BigDecimal("12000.00")));
        invoiceRepository.save(invRahulCur);

        // Apply Late Fee Penalty to Rahul's overdue bill
        PenaltyDiscount pen = new PenaltyDiscount(t1, "PENALTY", new BigDecimal("250.00"), "Late Payment Fee (5 days overdue)");
        penaltyDiscountRepository.save(pen);

        // Priya: Paid via Razorpay
        Invoice invPriyaCur = createInvoice(t2, "SERL-" + curCode + "-002", curMonthStart.plusDays(5), curMonthStart, new BigDecimal("12000.00"), "PAID", new BigDecimal("12000.00"));
        invPriyaCur.getItems().add(new InvoiceItem(invPriyaCur, "Monthly Accommodation Rent (Room 101, Bed 101-B)", new BigDecimal("12000.00")));
        invoiceRepository.save(invPriyaCur);
        createPayment(invPriyaCur, new BigDecimal("12000.00"), "RAZORPAY", "pay_rzp_cur_990011", curMonthStart.plusDays(2));

        // Sneha: Paid Single Suite
        Invoice invSnehaCur = createInvoice(t5, "SERL-" + curCode + "-003", curMonthStart.plusDays(5), curMonthStart, new BigDecimal("18000.00"), "PAID", new BigDecimal("18000.00"));
        invSnehaCur.getItems().add(new InvoiceItem(invSnehaCur, "Monthly Accommodation Rent (Single Suite 201)", new BigDecimal("18000.00")));
        invoiceRepository.save(invSnehaCur);
        createPayment(invSnehaCur, new BigDecimal("18000.00"), "NETBANKING", "HDFC-NB-cur_776655", curMonthStart.plusDays(1));

        // Amit: Partial Payment
        Invoice invAmitCur = createInvoice(t3, "SERL-" + curCode + "-004", curMonthStart.plusDays(5), curMonthStart, new BigDecimal("8500.00"), "PARTIAL", new BigDecimal("5000.00"));
        invAmitCur.getItems().add(new InvoiceItem(invAmitCur, "Monthly Accommodation Rent (Room 102, Bed 102-A)", new BigDecimal("8500.00")));
        invoiceRepository.save(invAmitCur);
        createPayment(invAmitCur, new BigDecimal("5000.00"), "CASH", "CASH-REC-0091", curMonthStart.plusDays(4));

        // Written-off invoice for bad debt tracking
        Invoice invWrittenOff = createInvoice(t3, "SERL-202602-OLD", curMonthStart.minusMonths(6).plusDays(5), curMonthStart.minusMonths(6), new BigDecimal("1500.00"), "WRITTEN_OFF", BigDecimal.ZERO);
        invWrittenOff.getItems().add(new InvoiceItem(invWrittenOff, "Late Locker Departure Charge (Waived / Written-off)", new BigDecimal("1500.00")));
        invoiceRepository.save(invWrittenOff);

        // ==========================================
        // 10. ELECTRICITY SUB-METER READINGS
        // ==========================================
        MeterReading mr1 = new MeterReading(room101, LocalDate.now(), new BigDecimal("1240.00"), new BigDecimal("12.00"), new BigDecimal("1440.00"));
        mr1.setPreviousReadingValue(new BigDecimal("1120.00"));
        mr1.setUnitsConsumed(new BigDecimal("120.00"));
        mr1.setBillingMonth(LocalDate.now().getMonthValue());
        mr1.setBillingYear(LocalDate.now().getYear());
        meterReadingRepository.save(mr1);

        MeterReading mr2 = new MeterReading(room102, LocalDate.now(), new BigDecimal("2150.00"), new BigDecimal("12.00"), new BigDecimal("1800.00"));
        mr2.setPreviousReadingValue(new BigDecimal("2000.00"));
        mr2.setUnitsConsumed(new BigDecimal("150.00"));
        mr2.setBillingMonth(LocalDate.now().getMonthValue());
        mr2.setBillingYear(LocalDate.now().getYear());
        meterReadingRepository.save(mr2);

        // ==========================================
        // 11. COMPLAINTS, CHAT MESSAGES & MAINTENANCE
        // ==========================================
        // Resolved Plumbing Complaint with Feedback
        Complaint c1 = new Complaint(t1, "PLUMBING", "Bathroom washbasin tap has slight low water pressure.");
        c1.setRoom(room101);
        c1.setStatus("RESOLVED");
        c1.setPriority("MEDIUM");
        c1.setAssignedStaff("Suresh Kumar");
        c1.setResolvedAt(OffsetDateTime.now().minusDays(2));
        c1.setFeedbackRating(5);
        c1.setFeedbackNotes("Resolved quickly within 2 hours. Excellent service!");
        c1.setResolutionNotes("Replaced aerator valve and cleared sediment blockage.");
        c1 = complaintRepository.save(c1);

        complaintChatMessageRepository.save(new ComplaintChatMessage(c1, staffUser.getId(), "Suresh Kumar", "STAFF", "Hello Rahul, I have received your ticket. Reaching Room 101 in 15 minutes."));
        complaintChatMessageRepository.save(new ComplaintChatMessage(c1, tenantUser.getId(), "Rahul Sharma", "TENANT", "Thanks Suresh, I am in the room."));

        // In-Progress Electrical Complaint
        Complaint c2 = new Complaint(t5, "ELECTRICAL", "Air conditioner remote sensor check and temperature display fluctuation.");
        c2.setRoom(room201);
        c2.setStatus("IN_PROGRESS");
        c2.setPriority("HIGH");
        c2.setAssignedStaff("Suresh Kumar");
        complaintRepository.save(c2);

        // Preventive Maintenance Task
        Maintenance m1 = new Maintenance();
        m1.setOrganization(demoOrg);
        m1.setPropertyId(prop1.getId());
        m1.setAsset("RO Water Purifier System");
        m1.setType("preventive");
        m1.setPriority("medium");
        m1.setDescription("Quarterly RO Water Filter & Sediment Cartridge Replacement");
        m1.setStatus("open");
        m1.setVendor("Aquaguard Authorized Service Center");
        m1.setCost(new BigDecimal("2500.00"));
        maintenanceRepository.save(m1);

        // ==========================================
        // 12. FRONT DESK, SHIFTS, VISITORS & PARCELS
        // ==========================================
        // Front Desk Shift Handover
        FrontDeskShiftHandover shift = new FrontDeskShiftHandover();
        shift.setOrganization(demoOrg);
        shift.setProperty(prop1);
        shift.setReceptionist(receptionistUser);
        shift.setReceptionistName("Kavya Menon");
        shift.setShiftType("MORNING");
        shift.setShiftDate(LocalDate.now());
        shift.setCashCollected(new BigDecimal("8500.00"));
        shift.setTokenAdvances(new BigDecimal("2000.00"));
        shift.setKeyDeposits(new BigDecimal("1000.00"));
        shift.setGuestMealTokens(new BigDecimal("600.00"));
        shift.setStatus("VERIFIED_DEPOSITED");
        shift.setVerifiedByManager(managerUser);
        shift.setVerifiedByManagerName("Ananya Deshmukh");
        shift.setVerifiedAt(OffsetDateTime.now().minusHours(1));
        shift.setIncomingStaffName("Bahadur Thapa (Evening Desk)");
        shift.setNotes("All cash registers balanced with zero discrepancy.");
        frontDeskShiftHandoverRepository.save(shift);

        // Visitors
        Visitor v1 = new Visitor(t1, "Karan Kapoor", "9876543201");
        v1.setProperty(prop1);
        v1.setPurpose("College Project Discussion");
        v1.setCheckInTime(OffsetDateTime.now().minusHours(2));
        v1.setStatus("CHECKED_IN");
        v1.setPassCode("VIS-9901");
        visitorRepository.save(v1);

        Visitor v2 = new Visitor(t5, "Sunita Reddy", "9876543202");
        v2.setProperty(prop1);
        v2.setPurpose("Parent Visit");
        v2.setCheckInTime(OffsetDateTime.now().minusHours(5));
        v2.setCheckOutTime(OffsetDateTime.now().minusHours(1));
        v2.setStatus("CHECKED_OUT");
        v2.setPassCode("VIS-9902");
        visitorRepository.save(v2);

        // Parcels
        Parcel p1 = new Parcel(t1, "Amazon");
        p1.setOrganization(demoOrg);
        p1.setParcelType("BOX");
        p1.setNotes("Mechanical Keyboard");
        p1.setTrackingNumber("AMZ-8829104");
        p1.setLockerLocation("Reception Shelf A1");
        p1.setPickupOtp("4892");
        p1.setQrCodeToken("QR_AMZ_4892");
        p1.setStatus("RECEIVED");
        p1.setReceivedDate(OffsetDateTime.now().minusHours(2));
        parcelRepository.save(p1);

        Parcel p2 = new Parcel(t2, "Blinkit");
        p2.setOrganization(demoOrg);
        p2.setParcelType("PERISHABLE_FOOD");
        p2.setTrackingNumber("BLK-991203");
        p2.setLockerLocation("Cold Storage / Kitchen Fridge");
        p2.setPickupOtp("8172");
        p2.setQrCodeToken("QR_BLK_8172");
        p2.setStatus("RECEIVED");
        p2.setReceivedDate(OffsetDateTime.now().minusHours(4));
        p2.setNotes("Fresh Greek Yogurt & Berries - Keep chilled");
        parcelRepository.save(p2);

        Parcel p4 = new Parcel(t4, "Flipkart");
        p4.setOrganization(demoOrg);
        p4.setParcelType("ELECTRONICS");
        p4.setNotes("Noise Cancelling Headphones");
        p4.setTrackingNumber("FK-339102");
        p4.setLockerLocation("Security Locker #1");
        p4.setPickupOtp("5510");
        p4.setQrCodeToken("QR_FK_5510");
        p4.setStatus("COLLECTED");
        p4.setReceivedDate(OffsetDateTime.now().minusDays(1));
        p4.setHandedOverDate(OffsetDateTime.now().minusHours(3));
        p4.setHandoverMethod("OTP");
        p4.setHandedOverBy("Security Desk");
        p4.setRecipientSignature("OTP_VERIFIED_5510");
        parcelRepository.save(p4);

        // Key Loan & Lost and Found
        KeyLoan kl = new KeyLoan();
        kl.setOrganization(demoOrg);
        kl.setProperty(prop1);
        kl.setRoomNumber("101");
        kl.setBedNumber("101-A");
        kl.setTenant(t1);
        kl.setTenantName(t1.getName());
        kl.setTenantPhone(t1.getMobile());
        kl.setLoanReason("LOCKED_OUT");
        kl.setLoanTime(OffsetDateTime.now().minusHours(4));
        kl.setActualReturnTime(OffsetDateTime.now().minusHours(3));
        kl.setStatus("RETURNED");
        kl.setIssuedByName("Kavya Menon");
        kl.setNotes("Master spare key returned safely within 1 hour.");
        keyLoanRepository.save(kl);

        LostAndFoundItem lf = new LostAndFoundItem();
        lf.setOrganization(demoOrg);
        lf.setProperty(prop1);
        lf.setItemName("Ray-Ban Aviator Sunglasses with Black Case");
        lf.setCategory("OTHER");
        lf.setFoundLocation("2nd Floor Common Lounge Sofa");
        lf.setFoundDate(LocalDate.now().minusDays(1));
        lf.setFoundByName("Suresh Kumar (Housekeeping)");
        lf.setStorageRack("Front Desk Cabinet Locker #2");
        lf.setStatus("UNCLAIMED");
        lostAndFoundItemRepository.save(lf);

        // ==========================================
        // 13. EXPENSES & ACCOUNTANT P&L
        // ==========================================
        expenseRepository.save(new Expense(demoOrg, prop1, "Electricity", "BESCOM Monthly Commercial Electricity Bill", new BigDecimal("14500.00"), "BANK_TRANSFER", "Bangalore Electricity Supply Co (BESCOM)", "BESCOM-TXN-88129", LocalDate.now().minusDays(12)));
        expenseRepository.save(new Expense(demoOrg, prop1, "Internet", "ACT Fibernet 1 Gbps Commercial Leased Line", new BigDecimal("4800.00"), "UPI", "ACT Fibernet Bangalore", "ACT-INV-99018", LocalDate.now().minusDays(8)));
        expenseRepository.save(new Expense(demoOrg, prop1, "Housekeeping", "Monthly Cleaning Supplies & Detergents Restock", new BigDecimal("2200.00"), "CASH", "Metro Cash & Carry", "METRO-RCP-1192", LocalDate.now().minusDays(5)));
        expenseRepository.save(new Expense(demoOrg, prop1, "Plumbing", "Emergency Pressure Pump Impeller Servicing", new BigDecimal("1500.00"), "UPI", "Sri Balaji Plumbing Services", "BALAJI-UPI-3321", LocalDate.now().minusDays(3)));

        // ==========================================
        // 14. SAFETY INCIDENTS & SUPPORT TICKETS
        // ==========================================
        SafetyIncident si = new SafetyIncident(demoOrg, "Bahadur Thapa (Security)", "Semi-Annual Fire Extinguisher Pressure Inspection & Mock Drill Conducted.");
        si.setSeverity("LOW");
        si.setStatus("RESOLVED");
        safetyIncidentRepository.save(si);

        SupportTicket st = new SupportTicket("TKT-SAAS-001", demoOrg, ownerUser, "Inquiry: Automated WhatsApp Payment Reminder SLA", "We want to verify how fast WhatsApp invoice reminders are dispatched on the 1st of each month.", "BILLING_ISSUE", "MEDIUM");
        st.setStatus("RESOLVED");
        st.setAssignedAgent("Platform Support Specialist");
        st.setResolutionNotes("WhatsApp payment notifications trigger automatically at 09:00 AM IST on the 1st of every month via our official Meta Cloud API webhook engine.");
        st.setResolvedAt(OffsetDateTime.now().minusDays(1));
        st = supportTicketRepository.save(st);

        supportTicketMessageRepository.save(new SupportTicketMessage(st, ownerUser, "CUSTOMER", "Vikram Roy", "Can you confirm if delivery reports are logged in real time?"));
        supportTicketMessageRepository.save(new SupportTicketMessage(st, userRepository.findByEmail("support@stayeaze.com").orElse(ownerUser), "SUPPORT", "Platform Support Specialist", "Yes Vikram! All outbound delivery statuses are logged in your Organization Settings > Notification Logs table."));

        // ==========================================
        // 15. PUBLIC CRM, INQUIRIES & ONBOARDING LEADS
        // ==========================================
        onboardingLeadRepository.save(new OnboardingLead("Sunil Gavaskar", "sunil.g@gmail.com", "9845011990", "Green View Executive PG", "GVE-PG", "CONVERTED", "COMPLETED", null));
        onboardingLeadRepository.save(new OnboardingLead("Manish Pandey", "manish.p@outlook.com", "9845011991", "Pandey Luxury Boys Hostel", "PLBH", "PENDING_PAYMENT", "UNPAID", null));

        Inquiry inq1 = new Inquiry(demoOrg, "Varun Nair", "9845019922");
        inq1.setProperty(prop1);
        inq1.setEmail("varun.nair@gmail.com");
        inq1.setGender("MALE");
        inq1.setPreferredSharing("DOUBLE");
        inq1.setExpectedMoveInDate(LocalDate.now().plusDays(7));
        inq1.setSource("WEBSITE");
        inq1.setStatus("VISIT_SCHEDULED");
        inq1.setAssignedTo(managerUser);
        inquiryRepository.save(inq1);

        // ==========================================
        // 16. NOTIFICATION LOGS & WEBHOOKS
        // ==========================================
        NotificationLog n1 = new NotificationLog(demoOrg, "9845112240", "WHATSAPP", "Dear Rahul, your monthly invoice SERL-202608-001 for ₹12,000 has been generated. Due date: 5th Aug.");
        n1.setStatus("SENT");
        notificationLogRepository.save(n1);

        NotificationLog n2 = new NotificationLog(demoOrg, "priya.patel@gmail.com", "EMAIL", "StayEaze Royal Grand PG: Payment receipt for SERL-202608-002 is attached.");
        n2.setStatus("SENT");
        notificationLogRepository.save(n2);

        // ==========================================
        // 17. SUBSCRIPTION EXTENSION REQUEST
        // ==========================================
        SubscriptionExtensionRequest subExt = new SubscriptionExtensionRequest(demoOrg, ownerUser, 30, "Annual audit and wing expansion grace period requested.", profile.getSubscriptionEndDate());
        subExt.setStatus("APPROVED");
        subExt.setReviewedBy(userRepository.findByEmail("superadmin@stayeaze.com").orElse(ownerUser));
        subExt.setReviewedAt(OffsetDateTime.now().minusDays(2));
        subExt.setReviewNotes("Approved as part of Enterprise Growth onboarding program.");
        subExt.setNewEndDate(profile.getSubscriptionEndDate().plusDays(30));
        subscriptionExtensionRequestRepository.save(subExt);

        // ==========================================
        // 18. AUDIT LOGS & USER JOURNEY AUDIT
        // ==========================================
        AuditLog al = new AuditLog(demoOrg, "SYSTEM_SEEDER", "SEED_ENVIRONMENT", "127.0.0.1");
        auditLogRepository.save(al);

        UserJourneyAudit uja = new UserJourneyAudit();
        uja.setOrganization(demoOrg);
        uja.setUserEmail(ownerUser.getEmail());
        uja.setUserId(ownerUser.getId());
        uja.setUserRole("OWNER");
        uja.setCategory("ONBOARDING");
        uja.setAction("SETUP_COMPLETED");
        uja.setStatus("SUCCESS");
        uja.setDetails("{\"message\": \"Owner finished initial setup wizard and verified organization billing profile.\"}");
        uja.setClientIp("127.0.0.1");
        userJourneyAuditRepository.save(uja);

        // ==========================================
        // 19. RECALCULATE & PERSIST OCCUPANCY & BED METRICS
        // ==========================================
        try {
            occupancySyncService.syncAllStatsForOrg(demoOrg);
            System.out.println("📊 [DatabaseSeeder] Occupancy & space inventory stats successfully synchronized for " + demoOrg.getName());
        } catch (Exception e) {
            System.err.println("⚠️ [DatabaseSeeder] Error during occupancy sync: " + e.getMessage());
        }
    }

    private User createUser(String email, String firstName, String lastName, String phone, Organization org, Role role) {
        User user = userRepository.findByEmail(email).orElseGet(() -> new User(org, email, encoder.encode("Password@123"), phone));
        user.setFirstName((firstName + " " + (lastName != null ? lastName : "")).trim());
        user.setPassword(encoder.encode("Password@123"));
        user.setStatus("ACTIVE");
        user.setOrganization(org);
        if (user.getRoles() == null) user.setRoles(new HashSet<>());
        user.getRoles().clear();
        if (role != null) user.getRoles().add(role);
        return userRepository.save(user);
    }

    private void assignPropertyScope(User user, UUID propertyId) {
        if (user != null && propertyId != null) {
            if (user.getPropertyIds() == null) {
                user.setPropertyIds(new ArrayList<>());
            }
            if (!user.getPropertyIds().contains(propertyId)) {
                user.getPropertyIds().add(propertyId);
                userRepository.save(user);
            }
        }
    }

    private Tenant createTenant(Organization org, UUID propertyId, String firstName, String lastName,
                                 String email, String phone, String gender, String roomNumber, String bedNumber,
                                 BigDecimal rent, BigDecimal deposit, String occupation, String kycStatus) {
        Tenant t = new Tenant();
        t.setOrganization(org);
        t.setPropertyId(propertyId);
        t.setFirstName(firstName);
        t.setLastName(lastName);
        t.setEmail(email);
        t.setMobile(phone);
        t.setGender(gender);
        t.setRoomNumber(roomNumber);
        t.setBedNumber(bedNumber);
        t.setRent(rent);
        t.setDeposit(deposit);
        t.setOccupation(occupation);
        t.setStatus("ACTIVE");
        t.setKycStatus(kycStatus);
        t.setLeaseStart(LocalDate.now().minusMonths(3).toString());
        t.setLeaseEnd(LocalDate.now().plusMonths(9).toString());
        t.setLockInMonths(3);
        t.setNoticePeriodDays(30);
        t.setAdvanceBalance(BigDecimal.ZERO);
        return tenantRepository.saveAndFlush(t);
    }

    private void occupyBed(Bed bed, Tenant tenant) {
        if (bed != null && tenant != null) {
            bed.setStatus("OCCUPIED");
            bed.setTenantId(tenant.getId() != null ? tenant.getId().toString() : null);
            bed.setTenantName(tenant.getName());
            bedRepository.saveAndFlush(bed);
        }
    }

    private void seedTenantDocument(Tenant tenant, String type, String number, String url, User verifiedBy) {
        TenantDocument doc = new TenantDocument(tenant, type, number);
        doc.setFileUrl(url);
        doc.setVerificationStatus("VERIFIED");
        doc.setVerifiedAt(OffsetDateTime.now().minusMonths(2));
        doc.setVerifiedBy(verifiedBy);
        tenantDocumentRepository.save(doc);
    }

    private void seedAgreement(Tenant tenant, LocalDate start, LocalDate end, String status) {
        Agreement ag = new Agreement(tenant, "Standard 11-Month StayEaze PG Residential License Agreement with 30-Day Notice Period and ₹500 Exit Cleaning.", start, end);
        ag.setStatus(status);
        ag.setSignedAt(start.atStartOfDay().atOffset(OffsetDateTime.now().getOffset()));
        ag.setSignatureUrl("https://stayeaze-vault.s3.amazonaws.com/signatures/" + tenant.getFirstName().toLowerCase() + "_sig.png");
        agreementRepository.save(ag);
    }

    private Booking seedBooking(Tenant tenant, Bed bed, LocalDate checkinDate, String status, BigDecimal rent, BigDecimal deposit) {
        Booking b = new Booking(tenant, bed, checkinDate, rent, deposit);
        b.setStatus(status);
        b.setBookingCode("BK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        return bookingRepository.save(b);
    }

    private void seedCheckIn(Tenant tenant, UUID propertyId, String roomNumber, String bedNumber, Booking booking, BigDecimal rent, BigDecimal deposit) {
        CheckIn ci = new CheckIn();
        ci.setOrganization(tenant.getOrganization());
        ci.setTenantName(tenant.getName());
        ci.setPropertyId(propertyId);
        ci.setRoomNumber(roomNumber);
        ci.setBedNumber(bedNumber);
        ci.setBookingId(booking.getId());
        ci.setCheckInDate(booking.getCheckinDate());
        ci.setRent(rent);
        ci.setDepositPaid(deposit);
        ci.setIdVerified(true);
        ci.setStatus("completed");
        ci.setCode("CHK-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        ci.setCheckedInBy("Ananya Deshmukh (Manager)");
        ci.setKeyTagNumber("KEY-" + roomNumber + "-" + bedNumber);
        ci.setInitialMeterReading(new BigDecimal("1050.00"));
        ci.setWelcomeKitHandedOver(true);
        checkInRepository.save(ci);
    }

    private Invoice createInvoice(Tenant tenant, String invoiceNumber, LocalDate dueDate, LocalDate issueDate,
                                  BigDecimal amountDue, String status, BigDecimal amountPaid) {
        Invoice inv = new Invoice(tenant, invoiceNumber, dueDate, issueDate, amountDue);
        inv.setStatus(status);
        inv.setAmountPaid(amountPaid);
        inv.setPaymentMethod("UPI");
        return invoiceRepository.saveAndFlush(inv);
    }

    private void createPayment(Invoice invoice, BigDecimal amount, String method, String ref, LocalDate date) {
        try {
            Payment p = new Payment(invoice, amount, method);
            p.setTransactionReference(ref);
            p.setStatus("COMPLETED");
            p.setPaymentDate(date.atStartOfDay().atOffset(OffsetDateTime.now().getOffset()));
            p.setReceiptUrl("https://stayeaze-receipts.s3.amazonaws.com/receipts/" + invoice.getInvoiceNumber() + ".pdf");
            paymentRepository.save(p);
        } catch (Exception ignored) {}
    }
}
