package com.stayeaze.backend.payload.request;

import java.math.BigDecimal;

public class CheckoutAuditRequest {
    private Boolean damagesChecked;
    private BigDecimal damageCharges;
    private Boolean keysReturned;
    private BigDecimal refundAmount;
    private String notes;

    public CheckoutAuditRequest() {
    }

    public Boolean getDamagesChecked() {
        return damagesChecked;
    }

    public void setDamagesChecked(Boolean damagesChecked) {
        this.damagesChecked = damagesChecked;
    }

    public BigDecimal getDamageCharges() {
        return damageCharges;
    }

    public void setDamageCharges(BigDecimal damageCharges) {
        this.damageCharges = damageCharges;
    }

    public Boolean getKeysReturned() {
        return keysReturned;
    }

    public void setKeysReturned(Boolean keysReturned) {
        this.keysReturned = keysReturned;
    }

    public BigDecimal getRefundAmount() {
        return refundAmount;
    }

    public void setRefundAmount(BigDecimal refundAmount) {
        this.refundAmount = refundAmount;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
