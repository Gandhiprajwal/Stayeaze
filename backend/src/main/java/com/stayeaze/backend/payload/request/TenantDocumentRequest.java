package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;

public class TenantDocumentRequest {
    @NotBlank
    private String documentType;

    @NotBlank
    private String documentNumber;

    private String fileUrl;

    public TenantDocumentRequest() {
    }

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    public String getDocumentNumber() {
        return documentNumber;
    }

    public void setDocumentNumber(String documentNumber) {
        this.documentNumber = documentNumber;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }
}
