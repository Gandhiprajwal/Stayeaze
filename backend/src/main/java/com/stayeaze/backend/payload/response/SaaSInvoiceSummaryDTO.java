package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.SaaSInvoice;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lightweight SaaSInvoice summary payload for table/list views.
 * Removes raw nested Organization entity.
 */
public class SaaSInvoiceSummaryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private UUID organizationId;
    private String organizationName;
    private String invoiceNumber;
    private String planName;
    private Double amount;
    private Double gstAmount;
    private Double totalAmount;
    private String status;
    private String billingCycle;
    private String paymentLink;
    private OffsetDateTime periodStart;
    private OffsetDateTime periodEnd;
    private String notes;
    private OffsetDateTime invoiceDate;
    private OffsetDateTime dueDate;
    private OffsetDateTime createdAt;
    private String transactionId;

    public SaaSInvoiceSummaryDTO() {}

    public static SaaSInvoiceSummaryDTO fromEntity(SaaSInvoice invoice) {
        if (invoice == null) return null;
        SaaSInvoiceSummaryDTO dto = new SaaSInvoiceSummaryDTO();
        dto.setId(invoice.getId());
        if (invoice.getOrganization() != null) {
            dto.setOrganizationId(invoice.getOrganization().getId());
            dto.setOrganizationName(invoice.getOrganization().getName());
        }
        dto.setInvoiceNumber(invoice.getInvoiceNumber());
        dto.setPlanName(invoice.getPlanName());
        dto.setAmount(invoice.getAmount());
        dto.setGstAmount(invoice.getGstAmount());
        dto.setTotalAmount(invoice.getTotalAmount());
        dto.setStatus(invoice.getStatus());
        dto.setBillingCycle(invoice.getBillingCycle());
        dto.setPaymentLink(invoice.getPaymentLink());
        dto.setPeriodStart(invoice.getPeriodStart());
        dto.setPeriodEnd(invoice.getPeriodEnd());
        dto.setNotes(invoice.getNotes());
        dto.setInvoiceDate(invoice.getInvoiceDate());
        dto.setDueDate(invoice.getDueDate());
        dto.setCreatedAt(invoice.getCreatedAt());
        dto.setTransactionId(invoice.getTransactionId());
        return dto;
    }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }

    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }

    public Double getGstAmount() { return gstAmount; }
    public void setGstAmount(Double gstAmount) { this.gstAmount = gstAmount; }

    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getBillingCycle() { return billingCycle; }
    public void setBillingCycle(String billingCycle) { this.billingCycle = billingCycle; }

    public String getPaymentLink() { return paymentLink; }
    public void setPaymentLink(String paymentLink) { this.paymentLink = paymentLink; }

    public OffsetDateTime getPeriodStart() { return periodStart; }
    public void setPeriodStart(OffsetDateTime periodStart) { this.periodStart = periodStart; }

    public OffsetDateTime getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(OffsetDateTime periodEnd) { this.periodEnd = periodEnd; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public OffsetDateTime getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(OffsetDateTime invoiceDate) { this.invoiceDate = invoiceDate; }

    public OffsetDateTime getDueDate() { return dueDate; }
    public void setDueDate(OffsetDateTime dueDate) { this.dueDate = dueDate; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
