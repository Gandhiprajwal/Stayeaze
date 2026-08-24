package com.stayeaze.backend.controllers;

import com.stayeaze.backend.models.Complaint;
import com.stayeaze.backend.models.Invoice;
import com.stayeaze.backend.models.OnboardingLead;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Role;
import com.stayeaze.backend.models.SupportTicket;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.ComplaintRepository;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.OnboardingLeadRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.RoleRepository;
import com.stayeaze.backend.repository.SupportTicketRepository;
import com.stayeaze.backend.repository.TenantRepository;
import com.stayeaze.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class PageBasedStatsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private OnboardingLeadRepository leadRepository;

    private Organization testOrg;
    private User testOwner;
    private Property testProperty;

    @BeforeEach
    void setUp() {
        Organization systemOrg = organizationRepository.findBySubdomain("system").orElseGet(() -> {
            Organization so = new Organization("StayEaze Platform", "system");
            return organizationRepository.save(so);
        });

        testOrg = organizationRepository.findBySubdomain("stats-pg").orElseGet(() -> {
            Organization o = new Organization("Stats Test PG", "stats-pg");
            o.setStatus("ACTIVE");
            return organizationRepository.save(o);
        });

        Role ownerRole = roleRepository.findByName("OWNER").orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));
        Role pmRole = roleRepository.findByName("PROPERTY_MANAGER").orElseGet(() -> roleRepository.save(new Role("PROPERTY_MANAGER", "{}")));
        Role accountantRole = roleRepository.findByName("ACCOUNTANT").orElseGet(() -> roleRepository.save(new Role("ACCOUNTANT", "{}")));
        Role adminRole = roleRepository.findByName("ADMIN").orElseGet(() -> roleRepository.save(new Role("ADMIN", "{}")));
        Role supportRole = roleRepository.findByName("SUPPORT").orElseGet(() -> roleRepository.save(new Role("SUPPORT", "{}")));
        Role superAdminRole = roleRepository.findByName("SUPER_ADMIN").orElseGet(() -> roleRepository.save(new Role("SUPER_ADMIN", "{}")));

        testOwner = userRepository.findByEmail("stats_owner@test.com").orElseGet(() -> {
            User u = new User(testOrg, "stats_owner@test.com", "pass123", "9876543201");
            u.setFirstName("Stats Owner");
            u.setRoles(new HashSet<>(Set.of(ownerRole)));
            return userRepository.save(u);
        });

        userRepository.findByEmail("stats_pm@test.com").orElseGet(() -> {
            User u = new User(testOrg, "stats_pm@test.com", "pass123", "9876543202");
            u.setFirstName("Stats PM");
            u.setRoles(new HashSet<>(Set.of(pmRole)));
            return userRepository.save(u);
        });

        userRepository.findByEmail("stats_accountant@test.com").orElseGet(() -> {
            User u = new User(testOrg, "stats_accountant@test.com", "pass123", "9876543203");
            u.setFirstName("Stats Accountant");
            u.setRoles(new HashSet<>(Set.of(accountantRole)));
            return userRepository.save(u);
        });

        userRepository.findByEmail("stats_admin@test.com").orElseGet(() -> {
            User u = new User(testOrg, "stats_admin@test.com", "pass123", "9876543204");
            u.setFirstName("Stats Admin");
            u.setRoles(new HashSet<>(Set.of(adminRole)));
            return userRepository.save(u);
        });

        userRepository.findByEmail("stats_support@test.com").orElseGet(() -> {
            User u = new User(systemOrg, "stats_support@test.com", "pass123", "9876543205");
            u.setFirstName("Stats Support");
            u.setRoles(new HashSet<>(Set.of(supportRole)));
            return userRepository.save(u);
        });

        userRepository.findByEmail("stats_superadmin@test.com").orElseGet(() -> {
            User u = new User(systemOrg, "stats_superadmin@test.com", "pass123", "9876543206");
            u.setFirstName("Stats SuperAdmin");
            u.setRoles(new HashSet<>(Set.of(superAdminRole)));
            return userRepository.save(u);
        });

        testProperty = propertyRepository.findAll().stream()
                .filter(p -> p.getOrganization() != null && p.getOrganization().getId().equals(testOrg.getId()))
                .findFirst()
                .orElseGet(() -> {
                    Property p = new Property();
                    p.setName("Grand Stats Residency");
                    p.setCode("GSR-STAT");
                    p.setAddress("123 Residency Road, Indiranagar");
                    p.setCity("Bengaluru");
                    p.setState("Karnataka");
                    p.setPincode("560038");
                    p.setOrganization(testOrg);
                    p.setTotalBeds(50);
                    p.setOccupiedBeds(30);
                    p.setTotalRooms(20);
                    p.setTotalBuildings(2);
                    return propertyRepository.save(p);
                });

        // Seed a tenant
        Tenant tenant = tenantRepository.findAll().stream()
                .filter(t -> t.getOrganization() != null && t.getOrganization().getId().equals(testOrg.getId()))
                .findFirst()
                .orElseGet(() -> {
                    Tenant t = new Tenant();
                    t.setFirstName("John");
                    t.setLastName("Resident");
                    t.setEmail("john.resident@test.com");
                    t.setMobile("9998887711");
                    t.setOrganization(testOrg);
                    t.setPropertyId(testProperty.getId());
                    t.setStatus("ACTIVE");
                    return tenantRepository.save(t);
                });

        // Seed an invoice
        if (invoiceRepository.findByTenant(tenant).isEmpty()) {
            Invoice inv = new Invoice();
            inv.setTenant(tenant);
            inv.setInvoiceNumber("INV-STAT-" + System.currentTimeMillis());
            inv.setStatus("PAID");
            inv.setAmountDue(new BigDecimal("10000"));
            inv.setAmountPaid(new BigDecimal("10000"));
            inv.setIssueDate(LocalDate.now());
            inv.setDueDate(LocalDate.now().plusDays(7));
            invoiceRepository.save(inv);
        }

        // Seed a complaint
        if (complaintRepository.findByTenant(tenant).isEmpty()) {
            Complaint comp = new Complaint(tenant, "Plumbing", "Tap leaking in room");
            comp.setStatus("OPEN");
            complaintRepository.save(comp);
        }

        // Seed a lead
        OnboardingLead lead = new OnboardingLead();
        lead.setOwnerName("Prospect Stats");
        lead.setOwnerEmail("prospect.stats@test.com");
        lead.setOwnerPhone("9887766554");
        lead.setPropertyName("Emerald PG Residency");
        lead.setPropertyCode("EPG-101");
        lead.setStatus("DEMO_REQUESTED");
        leadRepository.save(lead);

        // Seed a support ticket
        SupportTicket ticket = new SupportTicket(
                "APP-202608-STAT",
                testOrg,
                testOwner,
                "Need Help with Portal",
                "Cannot download GST report",
                "TECHNICAL_BUG",
                "HIGH"
        );
        ticket.setStatus("OPEN");
        supportTicketRepository.save(ticket);
    }

    @Test
    @DisplayName("SUPPORT role: GET /api/v1/support/tickets/stats returns global counts & priority breakdown")
    @WithMockUser(username = "stats_support@test.com", roles = "SUPPORT")
    void testSupportTicketsStatsAsSupport() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openTickets", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.totalTickets", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.highTickets", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.urgentTickets", notNullValue()))
                .andExpect(jsonPath("$.resolvedTickets", notNullValue()))
                .andExpect(jsonPath("$.closedTickets", notNullValue()));
    }

    @Test
    @DisplayName("SUPER_ADMIN role: GET /api/v1/super-admin/subscribers/stats returns full subscriber platform metrics")
    @WithMockUser(username = "stats_superadmin@test.com", roles = "SUPER_ADMIN")
    void testSubscribersStatsAsSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSubscribers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.activeSubscribers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.trialSubscribers", notNullValue()))
                .andExpect(jsonPath("$.expiredSubscribers", notNullValue()))
                .andExpect(jsonPath("$.suspendedSubscribers", notNullValue()))
                .andExpect(jsonPath("$.lockedSubscribers", notNullValue()))
                .andExpect(jsonPath("$.enterpriseSubscribers", notNullValue()))
                .andExpect(jsonPath("$.totalProperties", notNullValue()))
                .andExpect(jsonPath("$.totalBeds", notNullValue()))
                .andExpect(jsonPath("$.monthlyMrr", notNullValue()))
                .andExpect(jsonPath("$.pendingExtensionRequests", notNullValue()));
    }

    @Test
    @DisplayName("SUPPORT role: GET /api/v1/super-admin/subscribers/stats returns authorized subscriber metrics")
    @WithMockUser(username = "stats_support@test.com", roles = "SUPPORT")
    void testSubscribersStatsAsSupport() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSubscribers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.activeSubscribers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.enterpriseSubscribers", notNullValue()))
                .andExpect(jsonPath("$.monthlyMrr", notNullValue()));
    }

    @Test
    @DisplayName("SUPER_ADMIN role: GET /api/v1/super-admin/leads/stats returns lead status aggregates & failed errors")
    @WithMockUser(username = "stats_superadmin@test.com", roles = "SUPER_ADMIN")
    void testLeadsStatsAsSuperAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/leads/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalLeads", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.demoRequestedLeads", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.newLeads", notNullValue()))
                .andExpect(jsonPath("$.contactedLeads", notNullValue()))
                .andExpect(jsonPath("$.convertedLeads", notNullValue()))
                .andExpect(jsonPath("$.pendingPaymentLeads", notNullValue()))
                .andExpect(jsonPath("$.failedOnboardingLeads", notNullValue()))
                .andExpect(jsonPath("$.disqualifiedLeads", notNullValue()));
    }

    @Test
    @DisplayName("Customer role: GET /api/v1/support/tickets/stats returns user-scoped ticket counts")
    @WithMockUser(username = "stats_owner@test.com", roles = "OWNER")
    void testSupportTicketsStatsAsCustomer() throws Exception {
        mockMvc.perform(get("/api/v1/support/tickets/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTickets", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.openTickets", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.resolvedTickets", notNullValue()))
                .andExpect(jsonPath("$.closedTickets", notNullValue()));
    }

    @Test
    @DisplayName("OWNER role: GET /api/v1/properties/stats returns occupancy, beds, and room totals")
    @WithMockUser(username = "stats_owner@test.com", roles = "OWNER")
    void testPropertiesStatsAsOwner() throws Exception {
        mockMvc.perform(get("/api/v1/properties/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalProperties", notNullValue()))
                .andExpect(jsonPath("$.totalBeds", notNullValue()))
                .andExpect(jsonPath("$.occupiedBeds", notNullValue()))
                .andExpect(jsonPath("$.occupancyRate", notNullValue()));
    }

    @Test
    @DisplayName("PROPERTY_MANAGER role: GET /api/v1/tenants/stats returns active resident breakdown")
    @WithMockUser(username = "stats_pm@test.com", roles = "PROPERTY_MANAGER")
    void testTenantsStatsAsPropertyManager() throws Exception {
        mockMvc.perform(get("/api/v1/tenants/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTenants", notNullValue()))
                .andExpect(jsonPath("$.activeTenants", notNullValue()))
                .andExpect(jsonPath("$.checkedInTenants", notNullValue()));
    }

    @Test
    @DisplayName("ACCOUNTANT role: GET /api/v1/invoices/stats returns financial revenues and overdue status")
    @WithMockUser(username = "stats_accountant@test.com", roles = "ACCOUNTANT")
    void testInvoicesStatsAsAccountant() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalInvoices", notNullValue()))
                .andExpect(jsonPath("$.totalPaidAmount", notNullValue()))
                .andExpect(jsonPath("$.monthlyRevenue", notNullValue()))
                .andExpect(jsonPath("$.revenueMomGrowthPct", notNullValue()));
    }

    @Test
    @DisplayName("ADMIN role: GET /api/v1/complaints/stats returns open and resolved complaints")
    @WithMockUser(username = "stats_admin@test.com", roles = "ADMIN")
    void testComplaintsStatsAsAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/complaints/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalComplaints", notNullValue()))
                .andExpect(jsonPath("$.openComplaints", notNullValue()))
                .andExpect(jsonPath("$.inProgressComplaints", notNullValue()))
                .andExpect(jsonPath("$.resolvedComplaints", notNullValue()));
    }

    @Test
    @DisplayName("Unauthorized caller: non-superadmin/non-support cannot access /super-admin/subscribers/stats")
    @WithMockUser(username = "stats_tenant@test.com", roles = "TENANT")
    void testSubscribersStatsForbiddenForTenant() throws Exception {
        mockMvc.perform(get("/api/v1/super-admin/subscribers/stats"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated caller cannot access /api/v1/properties/stats")
    void testPropertiesStatsUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/properties/stats"))
                .andExpect(status().isUnauthorized());
    }
}

