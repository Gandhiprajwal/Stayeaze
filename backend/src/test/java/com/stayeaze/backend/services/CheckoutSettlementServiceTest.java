package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
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
}
