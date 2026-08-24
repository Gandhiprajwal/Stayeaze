package com.stayeaze.backend.payload.request;

import java.math.BigDecimal;
import java.util.UUID;

public class TenantBulkImportRequest {
    private String name;
    private String firstName;
    private String lastName;
    private String email;
    private String mobile;
    private String phone;
    private String gender;
    private UUID propertyId;
    private String propertyName;
    private String roomNumber;
    private String bedNumber;
    private BigDecimal rent;
    private BigDecimal deposit;
    private String checkInDate;
    private String leaseStart;
    private String leaseEnd;
    private String occupation;
    private String idType;
    private String idNumber;
    private String emergencyContactName;
    private String emergencyName;
    private String emergencyContactMobile;
    private String emergencyContact;
    private Boolean depositCollected = true;
    private BigDecimal openingBalanceDue = BigDecimal.ZERO;
    private Boolean sendCredentials = true;

    public TenantBulkImportRequest() {}

    public String getName() { return name; }
    public void setName(String name) {
        this.name = name;
        if (name != null && !name.isBlank()) {
            String[] parts = name.trim().split("\\s+", 2);
            this.firstName = parts[0];
            this.lastName = parts.length > 1 ? parts[1] : parts[0];
        }
    }

    public String getFirstName() {
        if (firstName != null && !firstName.isBlank()) return firstName;
        if (name != null && !name.isBlank()) return name.trim().split("\\s+", 2)[0];
        return "Tenant";
    }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() {
        if (lastName != null && !lastName.isBlank()) return lastName;
        if (name != null && !name.isBlank()) {
            String[] parts = name.trim().split("\\s+", 2);
            return parts.length > 1 ? parts[1] : parts[0];
        }
        return "Resident";
    }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getMobile() { return mobile != null ? mobile : phone; }
    public void setMobile(String mobile) { this.mobile = mobile; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getGender() { return gender != null ? gender : "other"; }
    public void setGender(String gender) { this.gender = gender; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public BigDecimal getRent() { return rent != null ? rent : BigDecimal.ZERO; }
    public void setRent(BigDecimal rent) { this.rent = rent; }

    public BigDecimal getDeposit() { return deposit != null ? deposit : BigDecimal.ZERO; }
    public void setDeposit(BigDecimal deposit) { this.deposit = deposit; }

    public String getCheckInDate() { return checkInDate != null ? checkInDate : leaseStart; }
    public void setCheckInDate(String checkInDate) { this.checkInDate = checkInDate; }

    public String getLeaseStart() { return leaseStart != null ? leaseStart : checkInDate; }
    public void setLeaseStart(String leaseStart) { this.leaseStart = leaseStart; }

    public String getLeaseEnd() { return leaseEnd; }
    public void setLeaseEnd(String leaseEnd) { this.leaseEnd = leaseEnd; }

    public String getOccupation() { return occupation; }
    public void setOccupation(String occupation) { this.occupation = occupation; }

    public String getIdType() { return idType != null ? idType : "aadhaar"; }
    public void setIdType(String idType) { this.idType = idType; }

    public String getIdNumber() { return idNumber; }
    public void setIdNumber(String idNumber) { this.idNumber = idNumber; }

    public String getEmergencyContactName() {
        return emergencyContactName != null ? emergencyContactName : emergencyName;
    }
    public void setEmergencyContactName(String n) { this.emergencyContactName = n; }
    public String getEmergencyName() { return emergencyName; }
    public void setEmergencyName(String n) { this.emergencyName = n; }

    public String getEmergencyContactMobile() {
        return emergencyContactMobile != null ? emergencyContactMobile : emergencyContact;
    }
    public void setEmergencyContactMobile(String m) { this.emergencyContactMobile = m; }
    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String m) { this.emergencyContact = m; }

    public Boolean getDepositCollected() { return depositCollected != null ? depositCollected : true; }
    public void setDepositCollected(Boolean depositCollected) { this.depositCollected = depositCollected; }

    public BigDecimal getOpeningBalanceDue() { return openingBalanceDue != null ? openingBalanceDue : BigDecimal.ZERO; }
    public void setOpeningBalanceDue(BigDecimal openingBalanceDue) { this.openingBalanceDue = openingBalanceDue; }

    public Boolean getSendCredentials() { return sendCredentials != null ? sendCredentials : true; }
    public void setSendCredentials(Boolean sendCredentials) { this.sendCredentials = sendCredentials; }
}
