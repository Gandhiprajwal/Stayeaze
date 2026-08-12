package com.stayeaze.backend.payload.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public class TenantRequest {
    private String firstName;
    private String lastName;
    private String name;

    private String email;

    private String mobile;
    private String phone; // alias from frontend

    private String gender;

    private String emergencyContactName;
    private String emergencyName; // alias from frontend

    private String emergencyContactMobile;
    private String emergencyContact; // alias from frontend

    private String dob;
    private String occupation;
    private String idType;
    private String idNumber;
    private BigDecimal rent;
    private BigDecimal deposit;
    private String leaseStart;
    private String leaseEnd;
    private UUID propertyId;
    private String roomNumber;
    private String bedNumber;
    private String status;

    public TenantRequest() {
    }

    public String getName() {
        return name;
    }

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

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        if (lastName != null && !lastName.isBlank()) return lastName;
        if (name != null && !name.isBlank()) {
            String[] parts = name.trim().split("\\s+", 2);
            return parts.length > 1 ? parts[1] : parts[0];
        }
        return "User";
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMobile() {
        return mobile != null ? mobile : phone;
    }

    public void setMobile(String mobile) {
        this.mobile = mobile;
    }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

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

    public String getDob() {
        return dob;
    }

    public void setDob(String dob) {
        this.dob = dob;
    }

    public String getOccupation() {
        return occupation;
    }

    public void setOccupation(String occupation) {
        this.occupation = occupation;
    }

    public String getIdType() {
        return idType;
    }

    public void setIdType(String idType) {
        this.idType = idType;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public void setIdNumber(String idNumber) {
        this.idNumber = idNumber;
    }

    public BigDecimal getRent() {
        return rent;
    }

    public void setRent(BigDecimal rent) {
        this.rent = rent;
    }

    public BigDecimal getDeposit() {
        return deposit;
    }

    public void setDeposit(BigDecimal deposit) {
        this.deposit = deposit;
    }

    public String getLeaseStart() {
        return leaseStart;
    }

    public void setLeaseStart(String leaseStart) {
        this.leaseStart = leaseStart;
    }

    public String getLeaseEnd() {
        return leaseEnd;
    }

    public void setLeaseEnd(String leaseEnd) {
        this.leaseEnd = leaseEnd;
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
