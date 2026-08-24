package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "saas_invoices")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SaaSInvoice {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "org_id", nullable = false)
    private Organization organization;

    @Column(name = "invoice_number", nullable = false, unique = true, length = 50)
    private String invoiceNumber;

    @Column(name = "plan_name", nullable = false, length = 100)
    private String planName;

    @Column(nullable = false)
    private Double amount = 0.0;

    @Column(name = "gst_amount", nullable = false)
    private Double gstAmount = 0.0;

    @Column(name = "total_amount", nullable = false)
    private Double totalAmount = 0.0;

    @Column(nullable = false, length = 30)
    private String status = "UNPAID"; // PAID, UNPAID, CANCELLED, OVERDUE

    @Column(name = "billing_cycle", length = 30)
    private String billingCycle = "MONTHLY"; // MONTHLY, QUARTERLY, ANNUAL

    @Column(name = "payment_link", length = 500)
    private String paymentLink;

    @Column(name = "period_start")
    private OffsetDateTime periodStart = OffsetDateTime.now();

    @Column(name = "period_end")
    private OffsetDateTime periodEnd = OffsetDateTime.now().plusMonths(1);

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "invoice_date")
    private OffsetDateTime invoiceDate = OffsetDateTime.now();

    @Column(name = "due_date")
    private OffsetDateTime dueDate = OffsetDateTime.now().plusDays(15);

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public SaaSInvoice() {
    }

    public SaaSInvoice(Organization organization, String invoiceNumber, String planName, Double amount, Double gstAmount, Double totalAmount, String status) {
        this.organization = organization;
        this.invoiceNumber = invoiceNumber;
        this.planName = planName;
        this.amount = amount;
        this.gstAmount = gstAmount;
        this.totalAmount = totalAmount;
        this.status = status != null && !status.isBlank() ? status : "UNPAID";
    }

    public SaaSInvoice(Organization organization, String invoiceNumber, String planName, Double amount, Double gstAmount, Double totalAmount, String status, String billingCycle, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
        this.organization = organization;
        this.invoiceNumber = invoiceNumber;
        this.planName = planName;
        this.amount = amount;
        this.gstAmount = gstAmount;
        this.totalAmount = totalAmount;
        this.status = status != null && !status.isBlank() ? status : "UNPAID";
        this.billingCycle = billingCycle != null && !billingCycle.isBlank() ? billingCycle : "MONTHLY";
        this.periodStart = periodStart != null ? periodStart : OffsetDateTime.now();
        this.periodEnd = periodEnd != null ? periodEnd : OffsetDateTime.now().plusMonths(1);
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getPlanName() {
        return planName;
    }

    public void setPlanName(String planName) {
        this.planName = planName;
    }

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public Double getGstAmount() {
        return gstAmount;
    }

    public void setGstAmount(Double gstAmount) {
        this.gstAmount = gstAmount;
    }

    public Double getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(Double totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getBillingCycle() {
        return billingCycle;
    }

    public void setBillingCycle(String billingCycle) {
        this.billingCycle = billingCycle;
    }

    public String getPaymentLink() {
        return paymentLink;
    }

    public void setPaymentLink(String paymentLink) {
        this.paymentLink = paymentLink;
    }

    public OffsetDateTime getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(OffsetDateTime periodStart) {
        this.periodStart = periodStart;
    }

    public OffsetDateTime getPeriodEnd() {
        return periodEnd;
    }

    public void setPeriodEnd(OffsetDateTime periodEnd) {
        this.periodEnd = periodEnd;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public OffsetDateTime getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(OffsetDateTime invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public OffsetDateTime getDueDate() {
        return dueDate;
    }

    public void setDueDate(OffsetDateTime dueDate) {
        this.dueDate = dueDate;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
