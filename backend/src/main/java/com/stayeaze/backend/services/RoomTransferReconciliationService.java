package com.stayeaze.backend.services;

import com.stayeaze.backend.models.*;
import com.stayeaze.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
public class RoomTransferReconciliationService {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private AgreementRepository agreementRepository;

    @Autowired
    private AuditLogService auditLogService;

    public static class ReconciliationResult {
        public boolean rentChanged;
        public boolean isUpgrade;
        public boolean isDowngrade;
        public BigDecimal oldRent;
        public BigDecimal newRent;
        public BigDecimal proRataDifference = BigDecimal.ZERO;
        public int remainingDays;
        public int daysInMonth;
        public String actionTaken; // "UPGRADE_INVOICE_CREATED", "ADVANCE_BALANCE_CREDITED", "UNPAID_INVOICE_ADJUSTED", "NO_ACTION"
        public Invoice generatedInvoice;
        public BigDecimal updatedAdvanceBalance;
    }

    @Transactional
    public ReconciliationResult reconcileMidCycleTransfer(
            Tenant tenant,
            BigDecimal oldRent,
            BigDecimal newRent,
            BigDecimal oldDeposit,
            BigDecimal newDeposit,
            String oldRoomNumber,
            String newRoomNumber,
            Organization organization) {

        ReconciliationResult result = new ReconciliationResult();
        result.oldRent = oldRent != null ? oldRent : BigDecimal.ZERO;
        result.newRent = newRent != null ? newRent : BigDecimal.ZERO;

        if (result.oldRent.compareTo(result.newRent) == 0 || result.newRent.compareTo(BigDecimal.ZERO) <= 0 || result.oldRent.compareTo(BigDecimal.ZERO) <= 0) {
            result.rentChanged = false;
            result.actionTaken = "NO_ACTION";
            return result;
        }

        result.rentChanged = true;
        LocalDate today = LocalDate.now();
        int daysInMonth = today.lengthOfMonth();
        int currentDay = today.getDayOfMonth();
        int remainingDays = Math.max(1, daysInMonth - currentDay + 1);

        result.daysInMonth = daysInMonth;
        result.remainingDays = remainingDays;

        BigDecimal oldDep = oldDeposit != null ? oldDeposit : (tenant.getDeposit() != null ? tenant.getDeposit() : BigDecimal.ZERO);
        BigDecimal newDep = newDeposit != null ? newDeposit : oldDep;
        BigDecimal depositTopUp = newDep.compareTo(oldDep) > 0 ? newDep.subtract(oldDep) : BigDecimal.ZERO;

        // Check if current month rent invoice exists and whether it is PAID
        List<Invoice> invoices = invoiceRepository.findByTenant(tenant);
        Invoice currentMonthInvoice = null;
        boolean currentMonthPaid = false;

        for (Invoice inv : invoices) {
            LocalDate invDate = inv.getIssueDate() != null ? inv.getIssueDate() : (inv.getDueDate() != null ? inv.getDueDate() : null);
            boolean isUtility = inv.getInvoiceNumber() != null && inv.getInvoiceNumber().startsWith("UTIL");

            if (!isUtility && invDate != null && invDate.getYear() == today.getYear() && invDate.getMonthValue() == today.getMonthValue()) {
                currentMonthInvoice = inv;
                if ("PAID".equalsIgnoreCase(inv.getStatus()) || (inv.getAmountPaid() != null && inv.getAmountPaid().compareTo(BigDecimal.ZERO) > 0)) {
                    currentMonthPaid = true;
                }
                break;
            }
        }

        if (result.newRent.compareTo(result.oldRent) > 0) {
            // --- ROOM UPGRADE (Higher Rent) ---
            result.isUpgrade = true;
            BigDecimal deltaRent = result.newRent.subtract(result.oldRent);
            BigDecimal dailyDelta = deltaRent.divide(BigDecimal.valueOf(daysInMonth), 2, RoundingMode.HALF_UP);
            BigDecimal proRataUpgrade = dailyDelta.multiply(BigDecimal.valueOf(remainingDays)).setScale(2, RoundingMode.HALF_UP);
            result.proRataDifference = proRataUpgrade;

            BigDecimal totalUpgradeDue = proRataUpgrade.add(depositTopUp);

            if (currentMonthPaid || depositTopUp.compareTo(BigDecimal.ZERO) > 0) {
                // Generate a delta upgrade invoice for remaining days + deposit top-up (if any)
                String invNum = invoiceSequenceService.nextRentalInvoiceNumber(tenant);
                Invoice upgradeInv = new Invoice(tenant, invNum, today.plusDays(3), today, totalUpgradeDue);
                upgradeInv.setStatus("UNPAID");
                upgradeInv.setAmountPaid(BigDecimal.ZERO);

                if (proRataUpgrade.compareTo(BigDecimal.ZERO) > 0) {
                    InvoiceItem rentItem = new InvoiceItem(
                            upgradeInv,
                            "Room Upgrade Difference (Room " + (oldRoomNumber != null ? oldRoomNumber : "-") + " to " + (newRoomNumber != null ? newRoomNumber : "-") + ") for " + remainingDays + " remaining days in " + today.getMonth(),
                            proRataUpgrade
                    );
                    upgradeInv.getItems().add(rentItem);
                }

                if (depositTopUp.compareTo(BigDecimal.ZERO) > 0) {
                    InvoiceItem depItem = new InvoiceItem(
                            upgradeInv,
                            "Security Deposit Top-Up for Room " + (newRoomNumber != null ? newRoomNumber : "-"),
                            depositTopUp
                    );
                    upgradeInv.getItems().add(depItem);
                    tenant.setDeposit(newDep);
                    tenantRepository.save(tenant);
                }

                Invoice savedInv = invoiceRepository.save(upgradeInv);

                result.generatedInvoice = savedInv;
                result.actionTaken = "UPGRADE_INVOICE_CREATED";
                auditLogService.logCurrent("Generated mid-cycle room upgrade difference invoice " + invNum + " for ₹" + totalUpgradeDue + " (Rent delta: ₹" + proRataUpgrade + ", Deposit Top-Up: ₹" + depositTopUp + ")", null);
            } else if (currentMonthInvoice != null && ("UNPAID".equalsIgnoreCase(currentMonthInvoice.getStatus()) || "PENDING".equalsIgnoreCase(currentMonthInvoice.getStatus()))) {
                // Current month invoice is UNPAID -> update its total to reflect the pro-rata upgrade
                BigDecimal newDue = currentMonthInvoice.getAmountDue().add(proRataUpgrade);
                currentMonthInvoice.setAmountDue(newDue);

                InvoiceItem item = new InvoiceItem(
                        currentMonthInvoice,
                        "Room Upgrade Rent Delta (" + remainingDays + " days)",
                        proRataUpgrade
                );
                currentMonthInvoice.getItems().add(item);
                invoiceRepository.save(currentMonthInvoice);

                result.actionTaken = "UNPAID_INVOICE_ADJUSTED";
                auditLogService.logCurrent("Adjusted unpaid invoice " + currentMonthInvoice.getInvoiceNumber() + " by +₹" + proRataUpgrade + " for room upgrade", null);
            } else {
                result.actionTaken = "NO_ACTION";
            }
        } else {
            // --- ROOM DOWNGRADE (Lower Rent) ---
            result.isDowngrade = true;
            BigDecimal deltaRent = result.oldRent.subtract(result.newRent);
            BigDecimal dailyDelta = deltaRent.divide(BigDecimal.valueOf(daysInMonth), 2, RoundingMode.HALF_UP);
            BigDecimal proRataSurplus = dailyDelta.multiply(BigDecimal.valueOf(remainingDays)).setScale(2, RoundingMode.HALF_UP);
            result.proRataDifference = proRataSurplus;

            if (currentMonthPaid) {
                // Resident paid the old higher rent -> Credit pro-rata surplus into advance balance
                BigDecimal currentAdv = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
                BigDecimal updatedAdv = currentAdv.add(proRataSurplus);
                tenant.setAdvanceBalance(updatedAdv);
                tenantRepository.save(tenant);

                result.updatedAdvanceBalance = updatedAdv;
                result.actionTaken = "ADVANCE_BALANCE_CREDITED";
                auditLogService.logCurrent("Credited ₹" + proRataSurplus + " surplus to advance balance for mid-cycle room downgrade (Room " + oldRoomNumber + " -> " + newRoomNumber + ") for " + tenant.getFirstName() + " " + tenant.getLastName(), null);
            } else if (currentMonthInvoice != null && ("UNPAID".equalsIgnoreCase(currentMonthInvoice.getStatus()) || "PENDING".equalsIgnoreCase(currentMonthInvoice.getStatus()))) {
                // Current month invoice is UNPAID -> reduce amount due
                BigDecimal newDue = currentMonthInvoice.getAmountDue().subtract(proRataSurplus);
                if (newDue.compareTo(BigDecimal.ZERO) < 0) newDue = BigDecimal.ZERO;
                currentMonthInvoice.setAmountDue(newDue);
                invoiceRepository.save(currentMonthInvoice);

                result.actionTaken = "UNPAID_INVOICE_ADJUSTED";
                auditLogService.logCurrent("Reduced unpaid invoice " + currentMonthInvoice.getInvoiceNumber() + " by -₹" + proRataSurplus + " for room downgrade", null);
            } else {
                result.actionTaken = "NO_ACTION";
            }
        }

        // Auto-generate Digital Lease Addendum
        if (result.rentChanged || (oldRoomNumber != null && newRoomNumber != null && !oldRoomNumber.equalsIgnoreCase(newRoomNumber))) {
            try {
                Agreement addendum = new Agreement(
                        tenant,
                        String.format("ROOM TRANSFER & RENT REVISION ADDENDUM\n\nEffective Date: %s\nResident: %s %s\nPrevious Room: %s (Rent: ₹%s)\nNew Room: %s (Rent: ₹%s)\nSecurity Deposit: ₹%s\nReconciliation Action: %s\n\nThis document serves as an official legal Addendum amending the Tenancy Agreement.",
                                today, tenant.getFirstName(), tenant.getLastName(),
                                oldRoomNumber != null ? oldRoomNumber : "-", oldRent,
                                newRoomNumber != null ? newRoomNumber : "-", newRent,
                                tenant.getDeposit(), result.actionTaken),
                        today,
                        tenant.getLeaseEnd() != null && !tenant.getLeaseEnd().isBlank() ? LocalDate.parse(tenant.getLeaseEnd()) : today.plusMonths(11)
                );
                addendum.setStatus("SIGNED");
                addendum.setSignedAt(java.time.OffsetDateTime.now());
                agreementRepository.save(addendum);
            } catch (Exception ignored) {}
        }

        return result;
    }
}
