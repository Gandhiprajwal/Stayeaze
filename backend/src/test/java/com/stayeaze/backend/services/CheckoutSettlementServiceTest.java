package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.BedRepository;
import com.stayeaze.backend.repository.CheckOutRepository;
import com.stayeaze.backend.repository.InvoiceRepository;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.repository.PropertyRepository;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CheckoutSettlementServiceTest {

    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private InvoiceRepository invoiceRepository;
    @Mock
    private CheckOutRepository checkOutRepository;
    @Mock
    private BedRepository bedRepository;
    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @InjectMocks
    private CheckoutSettlementService settlementService;

    private Tenant tenant;
    private Organization organization;
    private UUID tenantId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        organization = new Organization();
        organization.setId(UUID.randomUUID());
        organization.setName("Greenland PG Group");

        tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setOrganization(organization);
        tenant.setFirstName("Harry");
        tenant.setLastName("Gandhi");
        tenant.setMobile("9458772077");
        tenant.setEmail("harry@gmail.com");
        tenant.setRoomNumber("201");
        tenant.setBedNumber("201-B");
        tenant.setDeposit(BigDecimal.valueOf(3000.00));
        tenant.setRent(BigDecimal.valueOf(8500.00));
        tenant.setStatus("ACTIVE");
    }

    @Test
    void testStandardCheckoutWithNoticeShortfallAndPrepaidOffset() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));

        // August Rent Invoice for ₹8,500 Paid in full
        Invoice inv = new Invoice();
        inv.setInvoiceNumber("INV-2026/GL-PG01/2026-27/0002");
        inv.setIssueDate(LocalDate.of(2026, 8, 1));
        inv.setDueDate(LocalDate.of(2026, 8, 5));
        inv.setAmountDue(BigDecimal.valueOf(8500.00));
        inv.setAmountPaid(BigDecimal.valueOf(8500.00));
        inv.setStatus("PAID");
        when(invoiceRepository.findByTenant(tenant)).thenReturn(List.of(inv));

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("noticeDate", "2026-08-12");
        params.put("requiredNoticeDays", 30);
        params.put("cleaningFee", 500.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        assertTrue(preview.isCurrentMonthRentPaid);
        assertEquals(31, preview.daysInMonth);
        assertEquals(22, preview.stayedDaysInMonth);
        assertEquals(9, preview.unconsumedDaysInMonth);
        assertEquals(20, preview.noticePeriodShortfallDays);
        assertEquals(0, preview.depositPaid.compareTo(BigDecimal.valueOf(3000.00)));
        assertEquals(0, preview.cleaningFee.compareTo(BigDecimal.valueOf(500.00)));
        assertNotNull(preview.netPayableRefund);
    }

    @Test
    void testRoomDowngradeRentDifferenceSurplusCredit() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));

        // Tenant was charged & paid ₹9,500 under old room rate, but new room rate is ₹8,500
        Invoice inv = new Invoice();
        inv.setInvoiceNumber("INV-2026/GL-PG01/2026-27/0002");
        inv.setIssueDate(LocalDate.of(2026, 8, 1));
        inv.setDueDate(LocalDate.of(2026, 8, 5));
        inv.setAmountDue(BigDecimal.valueOf(9500.00));
        inv.setAmountPaid(BigDecimal.valueOf(9500.00));
        inv.setStatus("PAID");
        when(invoiceRepository.findByTenant(tenant)).thenReturn(List.of(inv));

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("noticeDate", "2026-08-12");
        params.put("requiredNoticeDays", 30);
        params.put("cleaningFee", 500.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        // Unconsumed prepaid credit should absorb the ₹1,000 difference
        assertTrue(preview.unconsumedPrepaidRent.compareTo(new BigDecimal("3000.00")) > 0);
        // Harry gets a net refund payable
        assertFalse(preview.isTenantOwingMoney);
        assertTrue(preview.netPayableRefund.compareTo(BigDecimal.ZERO) > 0);
    }

    @Test
    void testOwnerNoticeWaiverToggle() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("noticeDate", "2026-08-22"); // 0 days notice served
        params.put("requiredNoticeDays", 30);
        params.put("waiveNoticePenalty", true); // OWNER WAIVED PENALTY
        params.put("cleaningFee", 500.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        assertTrue(preview.waiveNoticePenalty);
        assertEquals(0, preview.noticePeriodShortfallDays);
        assertEquals(0, preview.netNoticePenalty.compareTo(BigDecimal.ZERO));
        assertEquals(0, preview.grossNoticePenalty.compareTo(BigDecimal.ZERO));
        // Full deposit minus cleaning fee refunded: 3000 - 500 = 2500
        assertEquals(0, preview.netPayableRefund.compareTo(new BigDecimal("2500.00")));
    }

    @Test
    void testMultiMonthAdvanceBalanceRefund() {
        tenant.setAdvanceBalance(BigDecimal.valueOf(10000.00));
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 500.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        assertEquals(0, preview.advanceBalance.compareTo(BigDecimal.valueOf(10000.00)));
        // Credits = deposit 3000 + advance 10000 = 13000. Deductions = 500. Net = 12500
        assertEquals(0, preview.netPayableRefund.compareTo(new BigDecimal("12500.00")));
    }

    @Test
    void testOverstayPenaltyCalculationStandardAndMultiplier() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-25");
        params.put("expectedCheckoutDate", "2026-08-20"); // 5 days overstay
        params.put("overstayMultiplier", 1.5); // 1.5x multiplier
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 0.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        assertEquals(5, preview.overstayDays);
        assertEquals(0, preview.overstayMultiplier.compareTo(BigDecimal.valueOf(1.5)));
        // Daily rate = 8500 / 31 = 274.19. Multiplier 1.5x = 411.29. 5 days = 2056.45
        assertTrue(preview.overstayPenalty.compareTo(BigDecimal.ZERO) > 0);
        assertTrue(preview.totalDeductions.compareTo(preview.overstayPenalty) >= 0);
    }

    @Test
    void testOverstayPenaltyWaiver() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-25");
        params.put("expectedCheckoutDate", "2026-08-20"); // 5 days overstay
        params.put("waiveOverstayPenalty", true); // WAIVED
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 0.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        assertEquals(5, preview.overstayDays);
        assertTrue(preview.waiveOverstayPenalty);
        assertEquals(0, preview.overstayPenalty.compareTo(BigDecimal.ZERO));
    }

    @Test
    void testAssetHandoverChecklistDeductions() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 0.00);
        params.put("lostRoomKey", true); // ₹300
        params.put("lostBiometricCard", true); // ₹500
        params.put("lostRemote", true); // ₹1000

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        // 300 + 500 + 1000 = 1800
        assertEquals(0, preview.assetDeductions.compareTo(BigDecimal.valueOf(1800.00)));
        assertEquals(0, preview.totalDeductions.compareTo(BigDecimal.valueOf(1800.00)));
        // Net refund = deposit 3000 - 1800 = 1200
        assertEquals(0, preview.netPayableRefund.compareTo(BigDecimal.valueOf(1200.00)));
    }

    @Test
    void testInterimElectricityMeterSplit() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 0.00);
        params.put("currentMeterReading", 1450.0);
        params.put("previousMeterReading", 1400.0); // 50 units consumed
        params.put("perUnitRate", 10.00); // ₹10/unit = ₹500 total
        params.put("activeRoommates", 2); // 2 roommates = ₹250 share

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        assertEquals(0, preview.interimUnitsConsumed.compareTo(BigDecimal.valueOf(50.0)));
        assertEquals(0, preview.interimUtilitySplit.compareTo(BigDecimal.valueOf(250.00)));
        assertEquals(0, preview.totalDeductions.compareTo(BigDecimal.valueOf(250.00)));
        // Net refund = deposit 3000 - 250 = 2750
        assertEquals(0, preview.netPayableRefund.compareTo(BigDecimal.valueOf(2750.00)));
    }

    @Test
    void testNegativeBalanceGeneratesRecoveryInvoice() {
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-22");
        params.put("waiveNoticePenalty", true);
        params.put("damageCharges", 10000.00); // Damages exceed deposit (3000)
        params.put("cleaningFee", 500.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        // Total deductions = 10500, credits = 3000 -> deficit = 7500
        assertTrue(preview.isTenantOwingMoney);
        assertEquals(0, preview.amountOwedByTenant.compareTo(BigDecimal.valueOf(7500.00)));
        assertEquals(0, preview.netPayableRefund.compareTo(BigDecimal.ZERO));

        // Test execution creates RECOVERY invoice
        Map<String, Object> execResult = settlementService.executeSettlement(tenantId, params);
        assertNotNull(execResult);
        assertTrue((Boolean) execResult.get("isTenantOwingMoney"));
        assertEquals(0, ((BigDecimal) execResult.get("amountOwedByTenant")).compareTo(BigDecimal.valueOf(7500.00)));
        assertNotNull(execResult.get("recoveryInvoiceNumber"));
        assertTrue(execResult.get("recoveryInvoiceNumber").toString().startsWith("RECOVERY-"));
    }

    @Test
    void testNoDuesCertificateDataGeneration() {
        UUID checkOutId = UUID.randomUUID();
        CheckOut checkOut = new CheckOut();
        checkOut.setId(checkOutId);
        checkOut.setOrganization(organization);
        checkOut.setTenantName("Harry Gandhi");
        checkOut.setRoomNumber("201");
        checkOut.setBedNumber("201-B");
        checkOut.setCheckOutDate(LocalDate.of(2026, 8, 22));
        checkOut.setDepositRefund(BigDecimal.valueOf(3000.00));
        checkOut.setDeductions(BigDecimal.valueOf(500.00));
        checkOut.setNetRefundAmount(BigDecimal.valueOf(2500.00));
        checkOut.setStatus("completed");
        checkOut.setRefundStatus("REFUNDED");
        checkOut.setRefundNotes("Security Deposit Paid: +₹3000.00\nExit Deep Cleaning: -₹500.00");

        when(checkOutRepository.findById(checkOutId)).thenReturn(Optional.of(checkOut));

        CheckoutSettlementService.NoDuesCertificateDTO dto = settlementService.getNoDuesCertificateData(checkOutId);

        assertNotNull(dto);
        assertEquals("Harry Gandhi", dto.tenantName);
        assertEquals("201", dto.roomNumber);
        assertEquals("201-B", dto.bedNumber);
        assertEquals("2026-08-22", dto.checkOutDate);
        assertEquals(0, dto.depositPaid.compareTo(BigDecimal.valueOf(3000.00)));
        assertEquals(0, dto.totalDeductions.compareTo(BigDecimal.valueOf(500.00)));
        assertEquals(0, dto.netRefundAmount.compareTo(BigDecimal.valueOf(2500.00)));
        assertFalse(dto.isDeficitOwed);
        assertNotNull(dto.alumniReferralCode);
        assertTrue(dto.alumniReferralCode.startsWith("ALUMNI-HARRY-"));
        assertNotNull(dto.verificationHash);
    }

    @Test
    void testUnarchivedTenantHistoricalInvoicesIgnored() {
        // Tenant was restored with clean leaseStart on 2026-08-20
        tenant.setLeaseStart("2026-08-20");
        tenant.setAdvanceBalance(BigDecimal.ZERO);
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));

        // Invoice from previous archived cycle issued on 2026-08-01 (before leaseStart)
        Invoice oldInv = new Invoice();
        oldInv.setId(UUID.randomUUID());
        oldInv.setInvoiceNumber("INV-OLD-001");
        oldInv.setIssueDate(LocalDate.of(2026, 8, 1));
        oldInv.setAmountDue(BigDecimal.valueOf(5000.00));
        oldInv.setAmountPaid(BigDecimal.valueOf(5000.00));
        oldInv.setStatus("PAID_VIA_DEPOSIT_SETTLEMENT");
        oldInv.setTenant(tenant);

        when(invoiceRepository.findByTenant(tenant)).thenReturn(List.of(oldInv));

        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", "2026-08-25");
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 0.00);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);

        assertNotNull(preview);
        // Past cycle invoice should NOT be credited as prepaid rent!
        assertFalse(preview.isCurrentMonthRentPaid);
        assertEquals(0, preview.unconsumedPrepaidRent.compareTo(BigDecimal.ZERO));
        assertEquals(0, preview.advanceBalance.compareTo(BigDecimal.ZERO));
        assertEquals(0, preview.totalCredits.compareTo(BigDecimal.valueOf(3000.00))); // only current deposit
    }

    @Test
    void testMinimumLockInBreakPenaltyAndWaiver() {
        tenant.setLeaseStart(LocalDate.now().minusDays(20).toString());
        tenant.setRent(BigDecimal.valueOf(8500.00));
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        // 1. Exit before 3-month lock-in without waiver -> Penalty applied
        Map<String, Object> params = new HashMap<>();
        params.put("checkOutDate", LocalDate.now().toString());
        params.put("lockInMonths", 3);
        params.put("waiveLockInPenalty", false);
        params.put("waiveNoticePenalty", true);
        params.put("cleaningFee", 0.0);

        CheckoutSettlementService.SettlementPreview preview = settlementService.calculatePreview(tenantId, params);
        assertTrue(preview.isLockInBreached);
        assertFalse(preview.waiveLockInPenalty);
        assertEquals(0, preview.lockInBreakDeduction.compareTo(BigDecimal.valueOf(8500.00)));
        assertTrue(preview.totalDeductions.compareTo(BigDecimal.valueOf(8500.00)) >= 0);

        // 2. With owner waiver -> Penalty becomes 0
        params.put("waiveLockInPenalty", true);
        CheckoutSettlementService.SettlementPreview previewWaived = settlementService.calculatePreview(tenantId, params);
        assertTrue(previewWaived.isLockInBreached);
        assertTrue(previewWaived.waiveLockInPenalty);
        assertEquals(0, previewWaived.lockInBreakDeduction.compareTo(BigDecimal.ZERO));
    }

    @Test
    void testPropertyPolicyInheritanceAndTenantOverride() {
        OrganizationBillingProfile orgBp = new OrganizationBillingProfile();
        orgBp.setMinimumLockInMonths(3);
        orgBp.setNoticePeriodDays(30);
        orgBp.setDefaultExitCleaningFee(BigDecimal.valueOf(500.00));
        orgBp.setDefaultElectricityRatePerUnit(BigDecimal.valueOf(10.00));

        UUID propId = UUID.randomUUID();
        Property prop = new Property();
        prop.setId(propId);
        prop.setMinimumLockInMonths(6);
        prop.setNoticePeriodDays(45);
        prop.setDefaultExitCleaningFee(BigDecimal.valueOf(800.00));
        prop.setDefaultElectricityRatePerUnit(BigDecimal.valueOf(12.50));

        tenant.setPropertyId(propId);
        tenant.setLeaseStart(LocalDate.now().minusDays(30).toString());
        tenant.setRent(BigDecimal.valueOf(10000.00));
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(propertyRepository.findById(propId)).thenReturn(Optional.of(prop));
        when(organizationBillingProfileRepository.findByOrganization(organization)).thenReturn(Optional.of(orgBp));
        when(invoiceRepository.findByTenant(tenant)).thenReturn(Collections.emptyList());

        // 1. Inherit Property-level policies when tenant has no overrides
        Map<String, Object> emptyParams = new HashMap<>();
        emptyParams.put("checkOutDate", LocalDate.now().toString());

        CheckoutSettlementService.SettlementPreview previewProp = settlementService.calculatePreview(tenantId, emptyParams);
        assertEquals(6, previewProp.lockInMonths);
        assertEquals(45, previewProp.requiredNoticeDays);
        assertEquals(0, previewProp.cleaningFee.compareTo(BigDecimal.valueOf(800.00)));
        assertEquals(0, previewProp.perUnitRate.compareTo(BigDecimal.valueOf(12.50)));
        assertTrue(previewProp.isLockInBreached); // Stayed 1 month of 6

        // 2. Tenant Contractual Override takes precedence over Property & Org policy
        tenant.setLockInMonths(1); // Signed special 1-month contract
        tenant.setNoticePeriodDays(15);

        CheckoutSettlementService.SettlementPreview previewOverride = settlementService.calculatePreview(tenantId, emptyParams);
        assertEquals(1, previewOverride.lockInMonths);
        assertEquals(15, previewOverride.requiredNoticeDays);
        assertFalse(previewOverride.isLockInBreached); // Stayed 30 days -> 1 month completed!

        // 3. Fallback to Organization defaults when Property policies are null
        prop.setMinimumLockInMonths(null);
        prop.setNoticePeriodDays(null);
        prop.setDefaultExitCleaningFee(null);
        prop.setDefaultElectricityRatePerUnit(null);
        tenant.setLockInMonths(null);
        tenant.setNoticePeriodDays(null);

        CheckoutSettlementService.SettlementPreview previewOrgFallback = settlementService.calculatePreview(tenantId, emptyParams);
        assertEquals(3, previewOrgFallback.lockInMonths); // Org default 3
        assertEquals(30, previewOrgFallback.requiredNoticeDays); // Org default 30
        assertEquals(0, previewOrgFallback.cleaningFee.compareTo(BigDecimal.valueOf(500.00))); // Org default 500
        assertEquals(0, previewOrgFallback.perUnitRate.compareTo(BigDecimal.valueOf(10.00))); // Org default 10
    }
}
