package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.models.Property;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.PropertyRepository;
import com.stayeaze.backend.repository.SaaSInvoiceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Centralized, thread-safe sequence generator for:
 * 1. Property-Isolated Rental/Tenant Invoices: INV/{PROPERTY_CODE}/{FY}/{0001}
 * 2. Platform-Isolated Subscription Invoices: SUB-INV/{FY}/{0001}
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
     * Uses the exact invoicePrefix stored in the organization's billing profile.
     */
    public synchronized String nextRentalInvoiceNumber(Property property, OrganizationBillingProfile profile, Organization fallbackOrg) {
        LocalDate today = LocalDate.now();
        int fyStart = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        String fyStr = fyStart + "-" + String.valueOf(fyStart + 1).substring(2);
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

        String propCode = "PROP";
        if (property != null && property.getCode() != null && !property.getCode().isBlank()) {
            propCode = property.getCode().trim().toUpperCase().replaceAll("[^A-Z0-9-]", "");
        } else if (property != null && property.getName() != null && !property.getName().isBlank()) {
            propCode = property.getName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
            if (propCode.length() > 6) propCode = propCode.substring(0, 6);
        }

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
        LocalDate today = LocalDate.now();
        int fyStart = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        String fyStr = fyStart + "-" + String.valueOf(fyStart + 1).substring(2);

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
     * Generates a strictly ascending, platform-isolated SaaS Subscription invoice number.
     * Format: SUB-INV/{FY}/{0001} -> e.g. SUB-INV/2026-27/0001
     */
    public synchronized String nextSubscriptionInvoiceNumber() {
        LocalDate today = LocalDate.now();
        int fyStart = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        String fyStr = fyStart + "-" + String.valueOf(fyStart + 1).substring(2);

        long baseCount = saasInvoiceRepository.count();
        long seqNum = baseCount + 1;
        String candidate;
        do {
            String seq = String.format("%04d", seqNum++);
            candidate = "SUB-INV/" + fyStr + "/" + seq;
        } while (saasInvoiceRepository.existsByInvoiceNumber(candidate));

        return candidate;
    }
}
