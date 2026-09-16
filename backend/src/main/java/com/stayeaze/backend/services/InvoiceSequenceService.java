package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.BookingRepository;
import com.stayeaze.backend.repository.CheckInRepository;
import com.stayeaze.backend.repository.CheckOutRepository;
import com.stayeaze.backend.repository.ComplaintRepository;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.PaymentRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import com.stayeaze.backend.repository.SupportTicketRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Centralized, thread-safe, and financial-year-aware sequence generator for all StayEaze entities:
 * 1. Tenant Rental Invoices: {PREFIX}/{PROP_CODE}/{FY}/{0001} -> e.g. SERL/KOR/2026-27/0001
 * 2. Utility Invoices: UTIL/{PROP_CODE}/{FY}/{0001}
 * 3. SaaS Subscription Invoices: SUB-INV/{FY}/{0001}
 * 4. Payment Receipts: REC/{PROP_CODE}/{FY}/{0001}
 * 5. Complaint / Maintenance Tickets: TKT/{PROP_CODE}/{FY}/{0001}
 * 6. Platform Support Tickets: SUP/{FY}/{0001}
 * 7. Bookings: BKG/{PROP_CODE}/{FY}/{0001}
 * 8. Check-Ins: CI/{PROP_CODE}/{FY}/{0001}
 * 9. Check-Outs: CO/{PROP_CODE}/{FY}/{0001}
 */
@Service
public class InvoiceSequenceService {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private SaaSInvoiceRepository saasInvoiceRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationBillingProfileRepository billingProfileRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private SupportTicketRepository supportTicketRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private CheckOutRepository checkOutRepository;

    public String getFinancialYearString() {
        LocalDate today = LocalDate.now();
        int fyStart = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        return fyStart + "-" + String.valueOf(fyStart + 1).substring(2);
    }

    public String getPropertyCode(Property property) {
        if (property != null && property.getCode() != null && !property.getCode().isBlank()) {
            return property.getCode().trim().toUpperCase().replaceAll("[^A-Z0-9-]", "");
        } else if (property != null && property.getName() != null && !property.getName().isBlank()) {
            String code = property.getName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
            return code.length() > 6 ? code.substring(0, 6) : code;
        }
        return "PROP";
    }

    /**
     * Generates a strictly ascending, property-isolated invoice number for a tenant invoice.
     * Format: {PREFIX}/{PROP_CODE}/{FY}/{0001} -> e.g. INV/HSR/2026-27/0001
     */
    public synchronized String nextRentalInvoiceNumber(Tenant tenant) {
        if (tenant == null) {
            return generateGlobalRentalInvoiceNumber(null, null);
        }

        Property property = null;
        if (tenant.getPropertyId() != null) {
            property = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
        }

        Organization org = tenant.getOrganization();
        if (org == null && property != null) {
            org = property.getOrganization();
        }

        OrganizationBillingProfile profile = null;
        if (org != null) {
            final UUID finalOrgId = org.getId();
            profile = billingProfileRepository.findByOrganization(org)
                    .or(() -> billingProfileRepository.findByOrgIdNative(finalOrgId))
                    .orElse(null);
        }

        if (profile == null) {
            profile = billingProfileRepository.findFirstNative().orElse(null);
        }

        return nextRentalInvoiceNumber(property, profile, org);
    }

    /**
     * Generates a strictly ascending, property-isolated invoice number given property & billing profile.
     */
    public synchronized String nextRentalInvoiceNumber(Property property, OrganizationBillingProfile profile, Organization fallbackOrg) {
        LocalDate today = LocalDate.now();
        int fyStart = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        String fyStr = getFinancialYearString();
        LocalDate fyStartDate = LocalDate.of(fyStart, 4, 1);
        LocalDate fyEndDate = LocalDate.of(fyStart + 1, 3, 31);

        if (profile == null && fallbackOrg != null) {
            profile = billingProfileRepository.findByOrganization(fallbackOrg)
                    .or(() -> billingProfileRepository.findByOrgIdNative(fallbackOrg.getId()))
                    .orElse(null);
        }
        if (profile == null) {
            profile = billingProfileRepository.findFirstNative().orElse(null);
        }

        String rawPrefix = (profile != null && profile.getInvoicePrefix() != null && !profile.getInvoicePrefix().isBlank())
                ? profile.getInvoicePrefix().trim() : "INV";

        String cleanPrefix = rawPrefix.replaceAll("[/\\-]+$", "");
        String propCode = getPropertyCode(property);

        long baseCount = (property != null && property.getId() != null)
                ? invoiceRepository.countByPropertyIdAndFinancialYear(property.getId(), fyStartDate, fyEndDate)
                : invoiceRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = cleanPrefix + "/" + propCode + "/" + fyStr + "/" + seq;
        } while (invoiceRepository.existsByInvoiceNumber(candidate));

        return candidate;
    }

    private synchronized String generateGlobalRentalInvoiceNumber(OrganizationBillingProfile profile, Organization org) {
        String fyStr = getFinancialYearString();

        if (profile == null && org != null) {
            profile = billingProfileRepository.findByOrganization(org)
                    .or(() -> billingProfileRepository.findByOrgIdNative(org.getId()))
                    .orElse(null);
        }
        if (profile == null) {
            profile = billingProfileRepository.findFirstNative().orElse(null);
        }

        String rawPrefix = (profile != null && profile.getInvoicePrefix() != null && !profile.getInvoicePrefix().isBlank())
                ? profile.getInvoicePrefix().trim() : "INV";

        String cleanPrefix = rawPrefix.replaceAll("[/\\-]+$", "");

        long baseCount = (org != null)
                ? invoiceRepository.findByOrganizationId(org.getId()).size()
                : invoiceRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = cleanPrefix + "/" + fyStr + "/" + seq;
        } while (invoiceRepository.existsByInvoiceNumber(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending Utility Invoice number.
     * Format: UTIL/{PROP_CODE}/{FY}/{0001}
     */
    public synchronized String nextUtilityInvoiceNumber(Property property, Organization org) {
        String fyStr = getFinancialYearString();
        String propCode = getPropertyCode(property);

        long baseCount = (org != null)
                ? invoiceRepository.findByOrganizationId(org.getId()).size()
                : invoiceRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "UTIL/" + propCode + "/" + fyStr + "/" + seq;
        } while (invoiceRepository.existsByInvoiceNumber(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending, platform-isolated SaaS Subscription invoice number.
     * Format: SUB-INV/{FY}/{0001} -> e.g. SUB-INV/2026-27/0001
     */
    public synchronized String nextSubscriptionInvoiceNumber() {
        String fyStr = getFinancialYearString();
        long baseCount = saasInvoiceRepository.count();
        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "SUB-INV/" + fyStr + "/" + seq;
        } while (saasInvoiceRepository.existsByInvoiceNumber(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending, property-isolated Payment Receipt number.
     * Format: REC/{PROP_CODE}/{FY}/{0001} -> e.g. REC/HSR/2026-27/0001
     */
    public synchronized String nextReceiptNumber(Tenant tenant) {
        Property property = null;
        if (tenant != null && tenant.getPropertyId() != null) {
            property = propertyRepository.findById(tenant.getPropertyId()).orElse(null);
        }
        return nextReceiptNumber(property, tenant != null ? tenant.getOrganization() : null);
    }

    public synchronized String nextReceiptNumber(Property property, Organization org) {
        String fyStr = getFinancialYearString();
        String propCode = getPropertyCode(property);

        long baseCount = (org != null)
                ? paymentRepository.countByOrganizationId(org.getId())
                : paymentRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "REC/" + propCode + "/" + fyStr + "/" + seq;
        } while (paymentRepository.existsByReceiptNumber(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending, property-isolated Complaint / Ticket number.
     * Format: TKT/{PROP_CODE}/{FY}/{0001} -> e.g. TKT/KOR/2026-27/0001
     */
    public synchronized String nextComplaintTicketNumber(Property property, Organization org) {
        String fyStr = getFinancialYearString();
        String propCode = getPropertyCode(property);

        long baseCount = (org != null)
                ? complaintRepository.findByOrganizationId(org.getId()).size()
                : complaintRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "TKT/" + propCode + "/" + fyStr + "/" + seq;
        } while (complaintRepository.existsByTicketNumber(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending Platform Support Ticket number.
     * Format: SUP/{FY}/{0001} -> e.g. SUP/2026-27/0001
     */
    public synchronized String nextSupportTicketNumber() {
        String fyStr = getFinancialYearString();
        long baseCount = supportTicketRepository.count();
        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "SUP/" + fyStr + "/" + seq;
        } while (supportTicketRepository.existsByTicketNumber(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending Booking Code.
     * Format: BKG/{PROP_CODE}/{FY}/{0001} -> e.g. BKG/KOR/2026-27/0001
     */
    public synchronized String nextBookingCode(Property property, Organization org) {
        String fyStr = getFinancialYearString();
        String propCode = getPropertyCode(property);

        long baseCount = (org != null)
                ? bookingRepository.findByOrganizationId(org.getId()).size()
                : bookingRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "BKG/" + propCode + "/" + fyStr + "/" + seq;
        } while (bookingRepository.existsByBookingCode(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending Check-In Code.
     * Format: CI/{PROP_CODE}/{FY}/{0001} -> e.g. CI/KOR/2026-27/0001
     */
    public synchronized String nextCheckInCode(Property property, Organization org) {
        String fyStr = getFinancialYearString();
        String propCode = getPropertyCode(property);

        long baseCount = (org != null)
                ? checkInRepository.findByOrganizationId(org.getId()).size()
                : checkInRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "CI/" + propCode + "/" + fyStr + "/" + seq;
        } while (checkInRepository.existsByCode(candidate));

        return candidate;
    }

    /**
     * Generates a strictly ascending Check-Out Code.
     * Format: CO/{PROP_CODE}/{FY}/{0001} -> e.g. CO/KOR/2026-27/0001
     */
    public synchronized String nextCheckOutCode(Property property, Organization org) {
        String fyStr = getFinancialYearString();
        String propCode = getPropertyCode(property);

        long baseCount = (org != null)
                ? checkOutRepository.findByOrganizationId(org.getId()).size()
                : checkOutRepository.count();

        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "CO/" + propCode + "/" + fyStr + "/" + seq;
        } while (checkOutRepository.existsByCode(candidate));

        return candidate;
    }
}
