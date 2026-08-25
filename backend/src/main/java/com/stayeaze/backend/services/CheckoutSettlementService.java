package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CheckoutSettlementService {

    private static final Logger logger = LoggerFactory.getLogger(CheckoutSettlementService.class);

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private CheckOutRepository checkOutRepository;

    @Autowired
    private BedRepository bedRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    public static class SettlementPreview {
        public UUID tenantId;
        public String tenantName;
        public String mobile;
        public String roomNumber;
        public String bedNumber;
        public LocalDate checkInDate;
        public LocalDate checkOutDate;
        public BigDecimal depositPaid = BigDecimal.ZERO;
        public BigDecimal pendingRentDue = BigDecimal.ZERO;
        public BigDecimal pendingUtilityDue = BigDecimal.ZERO;
        public BigDecimal damageCharges = BigDecimal.ZERO;
        public BigDecimal cleaningFee = BigDecimal.ZERO;
        public BigDecimal noticePeriodPenalty = BigDecimal.ZERO;
        public BigDecimal otherDeductions = BigDecimal.ZERO;
        public BigDecimal totalDeductions = BigDecimal.ZERO;
        public BigDecimal netPayableRefund = BigDecimal.ZERO;
        public boolean isTenantOwingMoney = false;
        public BigDecimal amountOwedByTenant = BigDecimal.ZERO;
        public String beneficiaryUpi;
        public String beneficiaryAccount;
        public String beneficiaryIfsc;
        public String beneficiaryBank;
        public List<String> itemizedBreakdown = new ArrayList<>();
    }

    /**
     * Live computation preview for checkout settlement math.
     */
    @Transactional(readOnly = true)
    public SettlementPreview calculatePreview(UUID tenantId, Map<String, Object> params) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found with ID: " + tenantId));

        SettlementPreview preview = new SettlementPreview();
        preview.tenantId = tenant.getId();
        preview.tenantName = tenant.getFirstName() + " " + tenant.getLastName();
        preview.mobile = tenant.getMobile();
        preview.roomNumber = tenant.getRoomNumber();
        preview.bedNumber = tenant.getBedNumber();
        preview.checkInDate = UtilityBillingService.parseTenantCheckIn(tenant);
        preview.checkOutDate = params.containsKey("checkOutDate") && params.get("checkOutDate") != null
                ? LocalDate.parse(params.get("checkOutDate").toString().substring(0, 10))
                : LocalDate.now();

        // 1. Initial Deposit
        preview.depositPaid = tenant.getDeposit() != null ? tenant.getDeposit() : BigDecimal.ZERO;

        // 2. Fetch Unpaid Invoices
        List<Invoice> invoices = invoiceRepository.findByTenant(tenant);
        BigDecimal rentDue = BigDecimal.ZERO;
        BigDecimal utilDue = BigDecimal.ZERO;

        for (Invoice inv : invoices) {
            if ("UNPAID".equalsIgnoreCase(inv.getStatus()) || "PARTIALLY_PAID".equalsIgnoreCase(inv.getStatus()) || "OVERDUE".equalsIgnoreCase(inv.getStatus())) {
                BigDecimal remaining = inv.getAmountDue().subtract(inv.getAmountPaid() != null ? inv.getAmountPaid() : BigDecimal.ZERO);
                if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                    if (inv.getInvoiceNumber() != null && inv.getInvoiceNumber().startsWith("UTIL")) {
                        utilDue = utilDue.add(remaining);
                    } else {
                        rentDue = rentDue.add(remaining);
                    }
                }
            }
        }
        preview.pendingRentDue = rentDue;
        preview.pendingUtilityDue = utilDue;

        // 3. Custom Input Deductions
        preview.damageCharges = parseBigDecimal(params.get("damageCharges"));
        preview.cleaningFee = params.containsKey("cleaningFee") ? parseBigDecimal(params.get("cleaningFee")) : BigDecimal.valueOf(500.00); // Standard Exit Cleaning Fee
        preview.otherDeductions = parseBigDecimal(params.get("otherDeductions"));

        // 4. Notice Period Calculation (e.g. 30 days standard)
        int requiredNoticeDays = params.containsKey("requiredNoticeDays") ? Integer.parseInt(params.get("requiredNoticeDays").toString()) : 30;
        if (params.containsKey("noticeDate") && params.get("noticeDate") != null) {
            LocalDate noticeDate = LocalDate.parse(params.get("noticeDate").toString().substring(0, 10));
            long actualNoticeDays = ChronoUnit.DAYS.between(noticeDate, preview.checkOutDate);
            if (actualNoticeDays < requiredNoticeDays) {
                long shortfallDays = requiredNoticeDays - actualNoticeDays;
                BigDecimal monthlyRent = tenant.getRent() != null ? tenant.getRent() : BigDecimal.ZERO;
                BigDecimal dailyRate = monthlyRent.divide(BigDecimal.valueOf(30), 2, RoundingMode.HALF_UP);
                preview.noticePeriodPenalty = dailyRate.multiply(BigDecimal.valueOf(shortfallDays)).setScale(2, RoundingMode.HALF_UP);
                preview.itemizedBreakdown.add(String.format("Notice Period Shortfall (%d days short of %d days): -₹%s", shortfallDays, requiredNoticeDays, preview.noticePeriodPenalty));
            }
        }

        // 5. Total Deductions & Net Calculation
        preview.totalDeductions = preview.pendingRentDue
                .add(preview.pendingUtilityDue)
                .add(preview.damageCharges)
                .add(preview.cleaningFee)
                .add(preview.noticePeriodPenalty)
                .add(preview.otherDeductions);

        BigDecimal net = preview.depositPaid.subtract(preview.totalDeductions);
        if (net.compareTo(BigDecimal.ZERO) >= 0) {
            preview.netPayableRefund = net;
            preview.isTenantOwingMoney = false;
            preview.amountOwedByTenant = BigDecimal.ZERO;
        } else {
            preview.netPayableRefund = BigDecimal.ZERO;
            preview.isTenantOwingMoney = true;
            preview.amountOwedByTenant = net.abs();
        }

        // 6. Beneficiary Details
        preview.beneficiaryUpi = params.containsKey("refundUpi") && params.get("refundUpi") != null
                ? params.get("refundUpi").toString() : tenant.getRefundUpi();
        preview.beneficiaryAccount = params.containsKey("refundAccountNumber") && params.get("refundAccountNumber") != null
                ? params.get("refundAccountNumber").toString() : tenant.getRefundAccountNumber();
        preview.beneficiaryIfsc = params.containsKey("refundIfsc") && params.get("refundIfsc") != null
                ? params.get("refundIfsc").toString() : tenant.getRefundIfsc();
        preview.beneficiaryBank = params.containsKey("refundBankName") && params.get("refundBankName") != null
                ? params.get("refundBankName").toString() : tenant.getRefundBankName();

        // 7. Itemized breakdown summary strings
        preview.itemizedBreakdown.add(String.format("Security Deposit Paid: +₹%s", preview.depositPaid));
        if (preview.pendingRentDue.compareTo(BigDecimal.ZERO) > 0) preview.itemizedBreakdown.add(String.format("Unpaid Rent Balance: -₹%s", preview.pendingRentDue));
        if (preview.pendingUtilityDue.compareTo(BigDecimal.ZERO) > 0) preview.itemizedBreakdown.add(String.format("Unpaid Utility Balance: -₹%s", preview.pendingUtilityDue));
        if (preview.damageCharges.compareTo(BigDecimal.ZERO) > 0) preview.itemizedBreakdown.add(String.format("Room Damage Repair Fee: -₹%s", preview.damageCharges));
        if (preview.cleaningFee.compareTo(BigDecimal.ZERO) > 0) preview.itemizedBreakdown.add(String.format("Exit Deep Cleaning Fee: -₹%s", preview.cleaningFee));
        if (preview.otherDeductions.compareTo(BigDecimal.ZERO) > 0) preview.itemizedBreakdown.add(String.format("Other Miscellaneous Deductions: -₹%s", preview.otherDeductions));

        return preview;
    }

    /**
     * Executes atomic checkout settlement, releases bed, updates tenant status, and generates settlement records.
     */
    @Transactional
    public Map<String, Object> executeSettlement(UUID tenantId, Map<String, Object> params) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found with ID: " + tenantId));

        SettlementPreview preview = calculatePreview(tenantId, params);

        // 1. Mark existing unpaid invoices as settled against deposit if applicable
        if (preview.pendingRentDue.compareTo(BigDecimal.ZERO) > 0 || preview.pendingUtilityDue.compareTo(BigDecimal.ZERO) > 0) {
            List<Invoice> unpaidInvoices = invoiceRepository.findByTenant(tenant);
            for (Invoice inv : unpaidInvoices) {
                if ("UNPAID".equalsIgnoreCase(inv.getStatus()) || "PARTIALLY_PAID".equalsIgnoreCase(inv.getStatus()) || "OVERDUE".equalsIgnoreCase(inv.getStatus())) {
                    inv.setAmountPaid(inv.getAmountDue());
                    inv.setStatus("PAID_VIA_DEPOSIT_SETTLEMENT");
                    invoiceRepository.save(inv);
                }
            }
        }

        // 2. If tenant owes money exceeding deposit, generate a final Settle Invoice
        if (preview.isTenantOwingMoney && preview.amountOwedByTenant.compareTo(BigDecimal.ZERO) > 0) {
            Invoice settleInv = new Invoice();
            settleInv.setTenant(tenant);
            settleInv.setInvoiceNumber("SETTLE-" + LocalDate.now().getYear() + String.format("%02d", LocalDate.now().getMonthValue()) + "-" + tenant.getId().toString().substring(0, 6).toUpperCase());
            settleInv.setIssueDate(LocalDate.now());
            settleInv.setDueDate(LocalDate.now().plusDays(3));
            settleInv.setAmountDue(preview.amountOwedByTenant);
            settleInv.setAmountPaid(BigDecimal.ZERO);
            settleInv.setStatus("UNPAID");

            InvoiceItem settleItem = new InvoiceItem(settleInv, "Final Exit Settlement Deficit (Deductions exceeded Deposit)", preview.amountOwedByTenant);
            settleInv.getItems().add(settleItem);
            invoiceRepository.save(settleInv);
        }

        // 3. Create CheckOut record
        CheckOut checkOut = new CheckOut();
        checkOut.setOrganization(tenant.getOrganization());
        checkOut.setTenantName(preview.tenantName);
        checkOut.setPropertyId(tenant.getPropertyId() != null ? tenant.getPropertyId() : UUID.randomUUID());
        checkOut.setRoomNumber(tenant.getRoomNumber());
        checkOut.setBedNumber(tenant.getBedNumber());
        checkOut.setCheckOutDate(preview.checkOutDate);
        checkOut.setDepositRefund(preview.depositPaid);
        checkOut.setDeductions(preview.totalDeductions);
        checkOut.setNetRefundAmount(preview.netPayableRefund);
        checkOut.setReason(params.containsKey("reason") && params.get("reason") != null ? params.get("reason").toString() : "Standard Checkout");
        checkOut.setStatus("completed");
        checkOut.setRefundStatus(preview.netPayableRefund.compareTo(BigDecimal.ZERO) > 0 ? "PENDING_APPROVAL" : "NOT_ELIGIBLE");
        checkOut.setBeneficiaryUpi(preview.beneficiaryUpi);
        checkOut.setBeneficiaryAccount(preview.beneficiaryAccount);
        checkOut.setBeneficiaryIfsc(preview.beneficiaryIfsc);
        checkOut.setBeneficiaryBank(preview.beneficiaryBank);
        checkOut.setRefundNotes(String.join("\n", preview.itemizedBreakdown));
        checkOutRepository.save(checkOut);

        // 4. Free up Bed and update Room occupancy
        if (tenant.getBedNumber() != null && tenant.getRoomNumber() != null) {
            bedRepository.findAll().stream()
                    .filter(b -> tenant.getRoomNumber().equalsIgnoreCase(b.getRoom() != null ? b.getRoom().getRoomNumber() : null)
                            && tenant.getBedNumber().equalsIgnoreCase(b.getBedNumber()))
                    .findFirst().ifPresent(b -> {
                        b.setStatus("AVAILABLE");
                        bedRepository.save(b);
                    });
        }

        // 5. Update Tenant Status
        tenant.setStatus("CHECKED_OUT");
        tenant.setLeaseEnd(preview.checkOutDate.toString());
        tenantRepository.save(tenant);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Tenant checkout & deposit settlement completed successfully");
        result.put("checkOutId", checkOut.getId());
        result.put("netPayableRefund", preview.netPayableRefund);
        result.put("isTenantOwingMoney", preview.isTenantOwingMoney);
        result.put("amountOwedByTenant", preview.amountOwedByTenant);
        result.put("itemizedBreakdown", preview.itemizedBreakdown);
        return result;
    }

    private BigDecimal parseBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(obj.toString());
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}
