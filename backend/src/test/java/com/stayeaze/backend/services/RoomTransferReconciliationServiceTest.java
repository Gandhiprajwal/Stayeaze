package com.stayeaze.backend.services;

import com.stayeaze.backend.models.Invoice;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.AgreementRepository;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RoomTransferReconciliationServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private InvoiceSequenceService invoiceSequenceService;

    @Mock
    private AgreementRepository agreementRepository;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private RoomTransferReconciliationService reconciliationService;

    private Tenant tenant;
    private Organization organization;

    @BeforeEach
    void setUp() {
        organization = new Organization();
        organization.setId(UUID.randomUUID());
        organization.setName("Greenland PG");

        tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setOrganization(organization);
        tenant.setFirstName("Harry");
        tenant.setLastName("Gandhi");
        tenant.setRent(BigDecimal.valueOf(8500.00));
        tenant.setAdvanceBalance(BigDecimal.ZERO);

        lenient().when(invoiceRepository.save(any(Invoice.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void testMidCycleRoomUpgradeGeneratesDeltaInvoiceWhenPaid() {
        // Tenant paid 6,500 on 1st of current month
        Invoice paidInvoice = new Invoice();
        paidInvoice.setId(UUID.randomUUID());
        paidInvoice.setTenant(tenant);
        paidInvoice.setInvoiceNumber("INV-2026/0001");
        paidInvoice.setIssueDate(LocalDate.now().withDayOfMonth(1));
        paidInvoice.setAmountDue(BigDecimal.valueOf(6500.00));
        paidInvoice.setAmountPaid(BigDecimal.valueOf(6500.00));
        paidInvoice.setStatus("PAID");

        when(invoiceRepository.findByTenant(tenant)).thenReturn(List.of(paidInvoice));
        when(invoiceSequenceService.nextRentalInvoiceNumber(tenant)).thenReturn("UPGRADE-2026/0001");
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(i -> i.getArgument(0));

        // Transfer from 6,500 to 12,000
        RoomTransferReconciliationService.ReconciliationResult result = reconciliationService.reconcileMidCycleTransfer(
                tenant,
                BigDecimal.valueOf(6500.00),
                BigDecimal.valueOf(12000.00),
                BigDecimal.valueOf(3000.00),
                BigDecimal.valueOf(3000.00),
                "101",
                "201",
                organization
        );

        assertTrue(result.rentChanged);
        assertTrue(result.isUpgrade);
        assertFalse(result.isDowngrade);
        assertEquals("UPGRADE_INVOICE_CREATED", result.actionTaken);
        assertNotNull(result.generatedInvoice);
        assertTrue(result.proRataDifference.compareTo(BigDecimal.ZERO) > 0);
        verify(invoiceRepository, times(1)).save(any(Invoice.class));
    }

    @Test
    void testMidCycleRoomDowngradeCreditsAdvanceBalanceWhenPaid() {
        // Tenant paid 9,500 on 1st of current month
        Invoice paidInvoice = new Invoice();
        paidInvoice.setId(UUID.randomUUID());
        paidInvoice.setTenant(tenant);
        paidInvoice.setInvoiceNumber("INV-2026/0002");
        paidInvoice.setIssueDate(LocalDate.now().withDayOfMonth(1));
        paidInvoice.setAmountDue(BigDecimal.valueOf(9500.00));
        paidInvoice.setAmountPaid(BigDecimal.valueOf(9500.00));
        paidInvoice.setStatus("PAID");

        when(invoiceRepository.findByTenant(tenant)).thenReturn(List.of(paidInvoice));

        // Transfer from 9,500 to 8,500
        RoomTransferReconciliationService.ReconciliationResult result = reconciliationService.reconcileMidCycleTransfer(
                tenant,
                BigDecimal.valueOf(9500.00),
                BigDecimal.valueOf(8500.00),
                BigDecimal.valueOf(3000.00),
                BigDecimal.valueOf(3000.00),
                "301",
                "201",
                organization
        );

        assertTrue(result.rentChanged);
        assertFalse(result.isUpgrade);
        assertTrue(result.isDowngrade);
        assertEquals("ADVANCE_BALANCE_CREDITED", result.actionTaken);
        assertNotNull(result.updatedAdvanceBalance);
        assertTrue(result.updatedAdvanceBalance.compareTo(BigDecimal.ZERO) > 0);
        verify(tenantRepository, times(1)).save(tenant);
    }

    @Test
    void testNoActionWhenRentUnchanged() {
        RoomTransferReconciliationService.ReconciliationResult result = reconciliationService.reconcileMidCycleTransfer(
                tenant,
                BigDecimal.valueOf(8500.00),
                BigDecimal.valueOf(8500.00),
                BigDecimal.valueOf(3000.00),
                BigDecimal.valueOf(3000.00),
                "201-A",
                "201-B",
                organization
        );

        assertFalse(result.rentChanged);
        assertEquals("NO_ACTION", result.actionTaken);
        verify(invoiceRepository, never()).save(any(Invoice.class));
    }

    @Test
    void testRoomUpgradeWithDepositTopUp() {
        // Tenant paid 8,000 rent for standard room (deposit held: 5,000)
        Invoice paidInvoice = new Invoice();
        paidInvoice.setId(UUID.randomUUID());
        paidInvoice.setTenant(tenant);
        paidInvoice.setInvoiceNumber("INV-2026/0003");
        paidInvoice.setIssueDate(LocalDate.now().withDayOfMonth(1));
        paidInvoice.setAmountDue(BigDecimal.valueOf(8000.00));
        paidInvoice.setAmountPaid(BigDecimal.valueOf(8000.00));
        paidInvoice.setStatus("PAID");

        when(invoiceRepository.findByTenant(tenant)).thenReturn(List.of(paidInvoice));

        // Upgrade to 12,000 private room (deposit required: 10,000 -> Top-Up = 5,000)
        RoomTransferReconciliationService.ReconciliationResult result = reconciliationService.reconcileMidCycleTransfer(
                tenant,
                BigDecimal.valueOf(8000.00),
                BigDecimal.valueOf(12000.00),
                BigDecimal.valueOf(5000.00),
                BigDecimal.valueOf(10000.00),
                "101",
                "301",
                organization
        );

        assertTrue(result.rentChanged);
        assertTrue(result.isUpgrade);
        assertEquals("UPGRADE_INVOICE_CREATED", result.actionTaken);
        assertNotNull(result.generatedInvoice);
        // Total due should include both pro-rata rent delta and 5,000 deposit top-up
        assertTrue(result.generatedInvoice.getAmountDue().compareTo(BigDecimal.valueOf(5000.00)) > 0);
        // Tenant's deposit updated in database
        assertEquals(0, tenant.getDeposit().compareTo(BigDecimal.valueOf(10000.00)));
        verify(invoiceRepository, times(1)).save(any(Invoice.class));
    }
}
