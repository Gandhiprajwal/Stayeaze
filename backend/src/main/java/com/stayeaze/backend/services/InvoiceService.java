package com.stayeaze.backend.services;

import com.stayeaze.backend.models.CheckIn;
import com.stayeaze.backend.models.Invoice;
import com.stayeaze.backend.models.InvoiceItem;
import com.stayeaze.backend.models.Tenant;
import com.stayeaze.backend.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class InvoiceService {
    private static final Logger logger = LoggerFactory.getLogger(InvoiceService.class);

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private com.stayeaze.backend.repository.PaymentRepository paymentRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private InvoiceSequenceService invoiceSequenceService;

    @Autowired
    private com.stayeaze.backend.repository.OrganizationBillingProfileRepository organizationBillingProfileRepository;

    @Autowired
    private com.stayeaze.backend.repository.TenantRepository tenantRepository;

    @Cacheable(value = "invoices", key = "#tenant != null ? #tenant.id.toString() : 'all'")
    public List<Invoice> getInvoicesByTenant(Tenant tenant) {
        if (tenant == null) {
            return invoiceRepository.findAll();
        }
        return invoiceRepository.findByTenant(tenant);
    }

    @Cacheable(value = "invoices", key = "#orgId != null ? #orgId.toString() : 'all_org'")
    public List<Invoice> getInvoicesByOrgId(UUID orgId) {
        if (orgId == null) {
            return invoiceRepository.findAll();
        }
        return invoiceRepository.findByOrganizationId(orgId);
    }

    @CacheEvict(value = "invoices", allEntries = true)
    public Invoice saveInvoice(Invoice invoice) {
        return invoiceRepository.save(invoice);
    }

    @CacheEvict(value = "invoices", allEntries = true)
    public void deleteInvoice(UUID id) {
        invoiceRepository.deleteById(id);
    }

    @Transactional
    @CacheEvict(value = "invoices", allEntries = true)
    public Invoice createCheckInInvoice(CheckIn checkIn, Tenant tenant, String paymentMode, String razorpayPaymentId) {
        try {
            if (tenant == null) {
                logger.warn("Cannot generate check-in invoice: Tenant is null");
                return null;
            }

            String invNum = invoiceSequenceService.nextRentalInvoiceNumber(tenant);
            LocalDate today = checkIn.getCheckInDate() != null ? checkIn.getCheckInDate() : LocalDate.now();

            BigDecimal rent = checkIn.getRent() != null ? checkIn.getRent() : tenant.getRent();
            if (rent == null) rent = BigDecimal.valueOf(8000);

            BigDecimal deposit = checkIn.getDepositPaid() != null ? checkIn.getDepositPaid() : tenant.getDeposit();
            if (deposit == null) deposit = BigDecimal.valueOf(16000);

            BigDecimal advance = checkIn.getAdvanceAmount() != null ? checkIn.getAdvanceAmount() : BigDecimal.ZERO;

            com.stayeaze.backend.models.Organization org = tenant.getOrganization();
            com.stayeaze.backend.models.OrganizationBillingProfile bp = org != null 
                    ? organizationBillingProfileRepository.findByOrganization(org).orElse(null)
                    : null;
            String policy = (bp != null && bp.getOnboardingBillingPolicy() != null)
                    ? bp.getOnboardingBillingPolicy()
                    : "FULL_WITH_ADVANCE_CREDIT";

            int maxDaysInMonth = today.lengthOfMonth();
            int startDay = today.getDayOfMonth();
            int stayedDays = maxDaysInMonth - startDay + 1;
            boolean isMidMonth = startDay > 1;

            BigDecimal billedRent = rent;
            BigDecimal advanceCredited = BigDecimal.ZERO;

            if (isMidMonth) {
                billedRent = rent.multiply(BigDecimal.valueOf(stayedDays))
                        .divide(BigDecimal.valueOf(maxDaysInMonth), 0, java.math.RoundingMode.HALF_UP);
                if (!"PRORATA_ONLY".equalsIgnoreCase(policy)) {
                    advanceCredited = rent.subtract(billedRent);
                }
            }

            // If tenant paid full rent upfront, credit the unconsumed days to tenant advanceBalance
            if (advanceCredited.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal existingAdv = tenant.getAdvanceBalance() != null ? tenant.getAdvanceBalance() : BigDecimal.ZERO;
                tenant.setAdvanceBalance(existingAdv.add(advanceCredited));
                try { tenantRepository.save(tenant); } catch (Exception ignored) {}
            }

            BigDecimal totalCharges = billedRent.add(deposit);
            BigDecimal netDue = totalCharges.subtract(advance);
            if (netDue.compareTo(BigDecimal.ZERO) < 0) netDue = BigDecimal.ZERO;

            boolean isPaid = !"LATER".equalsIgnoreCase(paymentMode) && !"UNPAID".equalsIgnoreCase(paymentMode);
            Invoice invoice = new Invoice(tenant, invNum, today, today, netDue);
            invoice.setAmountPaid(isPaid ? netDue : BigDecimal.ZERO);
            invoice.setStatus(isPaid ? "PAID" : "UNPAID");
            invoice.setPaymentMethod(paymentMode != null ? paymentMode.toUpperCase() : "CASH");
            if (razorpayPaymentId != null) {
                invoice.setRazorpayPaymentId(razorpayPaymentId);
                invoice.setPaymentReference(razorpayPaymentId);
            }

            List<InvoiceItem> items = new ArrayList<>();
            String monthName = today.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH);
            String rentDesc = isMidMonth
                    ? String.format("Pro-Rata Rent (%d days: %s %d–%d)", stayedDays, monthName, startDay, maxDaysInMonth)
                    : String.format("1st Month Rent Charges (%s %d)", monthName, today.getYear());

            items.add(new InvoiceItem(invoice, rentDesc, billedRent));
            items.add(new InvoiceItem(invoice, "Security Deposit Agreement", deposit));
            if (advance.compareTo(BigDecimal.ZERO) > 0) {
                items.add(new InvoiceItem(invoice, "Less: Advance Booking Deposit Paid", advance.negate()));
            }
            invoice.setItems(items);

            Invoice saved = invoiceRepository.save(invoice);

            // Record Payment transaction in payments ledger if paid at check-in
            if (isPaid && netDue.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    com.stayeaze.backend.models.Payment payment = new com.stayeaze.backend.models.Payment();
                    payment.setInvoice(saved);
                    payment.setAmount(netDue);
                    payment.setPaymentDate(java.time.OffsetDateTime.now());
                    payment.setPaymentMethod(paymentMode != null ? paymentMode.toUpperCase() : "CASH");
                    payment.setReceiptNumber("REC-" + invNum.replace("INV-", ""));
                    payment.setTransactionReference(razorpayPaymentId != null && !razorpayPaymentId.isBlank() ? razorpayPaymentId : ("CHKIN-OFFLINE-" + System.currentTimeMillis()));
                    payment.setStatus("COMPLETED");
                    paymentRepository.save(payment);
                } catch (Exception payEx) {
                    logger.warn("Failed to record Payment entity for check-in: {}", payEx.getMessage());
                }
            }

            // Send Check-In Tax Invoice Email
            String emailTo = tenant.getEmail();
            if (emailTo == null || emailTo.isBlank()) {
                emailTo = checkIn.getTenantEmail();
            }

            if (emailTo != null && !emailTo.isBlank()) {
                String tenantName = checkIn.getTenantName() != null ? checkIn.getTenantName() : (tenant.getFirstName() + " " + tenant.getLastName());
                String roomBed = "Room " + (checkIn.getRoomNumber() != null ? checkIn.getRoomNumber() : tenant.getRoomNumber()) + 
                                 " / Bed " + (checkIn.getBedNumber() != null ? checkIn.getBedNumber() : tenant.getBedNumber());
                
                emailService.sendCheckInInvoiceEmail(
                        emailTo,
                        tenantName,
                        invNum,
                        "StayEaze Property",
                        roomBed,
                        rent,
                        deposit,
                        advance,
                        netDue,
                        paymentMode,
                        today.toString()
                );
            }

            return saved;
        } catch (Exception e) {
            logger.error("Error generating check-in invoice: {}", e.getMessage(), e);
            return null;
        }
    }
}
