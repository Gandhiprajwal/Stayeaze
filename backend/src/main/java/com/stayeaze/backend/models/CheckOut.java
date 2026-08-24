package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "check_outs")
public class CheckOut {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id", nullable = false)
    private Organization organization;

    @Column(name = "tenant_name", nullable = false, length = 150)
    private String tenantName;

    @Column(name = "property_id", nullable = false)
    private UUID propertyId;

    @Column(name = "room_number", length = 50)
    private String roomNumber;

    @Column(name = "bed_number", length = 50)
    private String bedNumber;

    @Column(name = "check_out_date")
    private LocalDate checkOutDate;

    @Column(name = "notice_date")
    private LocalDate noticeDate;

    @Column(name = "deposit_refund", precision = 12, scale = 2)
    private BigDecimal depositRefund;

    @Column(precision = 12, scale = 2)
    private BigDecimal deductions;

    @Column(length = 150)
    private String reason;

    @Column(length = 50)
    private String status = "notice_period"; // notice_period, pending, completed

    @Column(length = 50)
    private String code;

    @Column(name = "refund_status", length = 50)
    private String refundStatus = "NOT_ELIGIBLE"; // NOT_ELIGIBLE, PENDING_APPROVAL, REFUNDED, REJECTED

    @Column(name = "refund_approved_by", length = 150)
    private String refundApprovedBy;

    @Column(name = "refund_approved_at")
    private OffsetDateTime refundApprovedAt;

    @Column(name = "refund_payment_mode", length = 50)
    private String refundPaymentMode;

    @Column(name = "refund_transaction_ref", length = 100)
    private String refundTransactionRef;

    @Column(name = "refund_notes", columnDefinition = "text")
    private String refundNotes;

    @Column(name = "net_refund_amount", precision = 12, scale = 2)
    private BigDecimal netRefundAmount;

    @Column(name = "beneficiary_upi", length = 100)
    private String beneficiaryUpi;

    @Column(name = "beneficiary_bank", length = 100)
    private String beneficiaryBank;

    @Column(name = "beneficiary_account", length = 50)
    private String beneficiaryAccount;

    @Column(name = "beneficiary_ifsc", length = 30)
    private String beneficiaryIfsc;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public CheckOut() {
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

    public String getTenantName() {
        return tenantName;
    }

    public void setTenantName(String tenantName) {
        this.tenantName = tenantName;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getBedNumber() {
        return bedNumber;
    }

    public void setBedNumber(String bedNumber) {
        this.bedNumber = bedNumber;
    }

    public LocalDate getCheckOutDate() {
        return checkOutDate;
    }

    public void setCheckOutDate(LocalDate checkOutDate) {
        this.checkOutDate = checkOutDate;
    }

    public LocalDate getNoticeDate() {
        return noticeDate;
    }

    public void setNoticeDate(LocalDate noticeDate) {
        this.noticeDate = noticeDate;
    }

    public BigDecimal getDepositRefund() {
        return depositRefund;
    }

    public void setDepositRefund(BigDecimal depositRefund) {
        this.depositRefund = depositRefund;
    }

    public BigDecimal getDeductions() {
        return deductions;
    }

    public void setDeductions(BigDecimal deductions) {
        this.deductions = deductions;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getRefundStatus() {
        return refundStatus != null ? refundStatus : "NOT_ELIGIBLE";
    }

    public void setRefundStatus(String refundStatus) {
        this.refundStatus = refundStatus;
    }

    public String getRefundApprovedBy() {
        return refundApprovedBy;
    }

    public void setRefundApprovedBy(String refundApprovedBy) {
        this.refundApprovedBy = refundApprovedBy;
    }

    public OffsetDateTime getRefundApprovedAt() {
        return refundApprovedAt;
    }

    public void setRefundApprovedAt(OffsetDateTime refundApprovedAt) {
        this.refundApprovedAt = refundApprovedAt;
    }

    public String getRefundPaymentMode() {
        return refundPaymentMode;
    }

    public void setRefundPaymentMode(String refundPaymentMode) {
        this.refundPaymentMode = refundPaymentMode;
    }

    public String getRefundTransactionRef() {
        return refundTransactionRef;
    }

    public void setRefundTransactionRef(String refundTransactionRef) {
        this.refundTransactionRef = refundTransactionRef;
    }

    public String getRefundNotes() {
        return refundNotes;
    }

    public void setRefundNotes(String refundNotes) {
        this.refundNotes = refundNotes;
    }

    public BigDecimal getNetRefundAmount() {
        if (netRefundAmount != null) return netRefundAmount;
        BigDecimal dep = depositRefund != null ? depositRefund : BigDecimal.ZERO;
        BigDecimal ded = deductions != null ? deductions : BigDecimal.ZERO;
        return dep.subtract(ded).max(BigDecimal.ZERO);
    }

    public void setNetRefundAmount(BigDecimal netRefundAmount) {
        this.netRefundAmount = netRefundAmount;
    }

    public String getBeneficiaryUpi() {
        return beneficiaryUpi;
    }

    public void setBeneficiaryUpi(String beneficiaryUpi) {
        this.beneficiaryUpi = beneficiaryUpi;
    }

    public String getBeneficiaryBank() {
        return beneficiaryBank;
    }

    public void setBeneficiaryBank(String beneficiaryBank) {
        this.beneficiaryBank = beneficiaryBank;
    }

    public String getBeneficiaryAccount() {
        return beneficiaryAccount;
    }

    public void setBeneficiaryAccount(String beneficiaryAccount) {
        this.beneficiaryAccount = beneficiaryAccount;
    }

    public String getBeneficiaryIfsc() {
        return beneficiaryIfsc;
    }

    public void setBeneficiaryIfsc(String beneficiaryIfsc) {
        this.beneficiaryIfsc = beneficiaryIfsc;
    }
}
