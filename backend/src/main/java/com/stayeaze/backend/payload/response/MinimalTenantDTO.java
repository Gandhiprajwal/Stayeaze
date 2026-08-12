package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Tenant;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Lightweight DTO for tenant table lists and dropdown pickers.
 * Excludes heavy KYC documents, emergency contact details, DOB, and identity numbers.
 * Full details are loaded on-demand via GET /api/v1/tenants/{id}.
 */
public class MinimalTenantDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String firstName;
    private String lastName;
    private String name;
    private String email;
    private String phone;
    private String mobile;
    private String gender;
    private String occupation;
    private String kycStatus;
    private UUID propertyId;
    private String roomNumber;
    private String bedNumber;
    private BigDecimal rent;
    private BigDecimal deposit;
    private String leaseStart;
    private String leaseEnd;
    private String status;
    private String dob;
    private String idType;
    private String idNumber;
    private String emergencyContactName;
    private String emergencyName;
    private String emergencyContactMobile;
    private String emergencyContact;

    public MinimalTenantDTO() {
    }

    public static MinimalTenantDTO fromEntity(Tenant t) {
        if (t == null) return null;
        MinimalTenantDTO dto = new MinimalTenantDTO();
        dto.setId(t.getId());
        dto.setFirstName(t.getFirstName());
        dto.setLastName(t.getLastName());
        dto.setName((t.getFirstName() != null ? t.getFirstName() : "") + (t.getLastName() != null ? " " + t.getLastName() : "").trim());
        dto.setEmail(t.getEmail());
        dto.setPhone(t.getMobile());
        dto.setMobile(t.getMobile());
        dto.setGender(t.getGender());
        dto.setOccupation(t.getOccupation());
        dto.setKycStatus(t.getKycStatus());
        dto.setPropertyId(t.getPropertyId());
        dto.setRoomNumber(t.getRoomNumber());
        dto.setBedNumber(t.getBedNumber());
        dto.setRent(t.getRent());
        dto.setDeposit(t.getDeposit());
        dto.setLeaseStart(t.getLeaseStart());
        dto.setLeaseEnd(t.getLeaseEnd());
        dto.setStatus(t.getStatus());
        dto.setDob(t.getDob());
        dto.setIdType(t.getIdType());
        dto.setIdNumber(t.getIdNumber());
        dto.setEmergencyContactName(t.getEmergencyContactName());
        dto.setEmergencyName(t.getEmergencyContactName());
        dto.setEmergencyContactMobile(t.getEmergencyContactMobile());
        dto.setEmergencyContact(t.getEmergencyContactMobile());
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getOccupation() { return occupation; }
    public void setOccupation(String occupation) { this.occupation = occupation; }

    public String getKycStatus() { return kycStatus; }
    public void setKycStatus(String kycStatus) { this.kycStatus = kycStatus; }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }

    public BigDecimal getRent() { return rent; }
    public void setRent(BigDecimal rent) { this.rent = rent; }

    public String getLeaseEnd() { return leaseEnd; }
    public void setLeaseEnd(String leaseEnd) { this.leaseEnd = leaseEnd; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getDeposit() { return deposit; }
    public void setDeposit(BigDecimal deposit) { this.deposit = deposit; }

    public String getLeaseStart() { return leaseStart; }
    public void setLeaseStart(String leaseStart) { this.leaseStart = leaseStart; }

    public String getDob() { return dob; }
    public void setDob(String dob) { this.dob = dob; }

    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }

    public String getIdNumber() { return idNumber; }
    public void setIdNumber(String idNumber) { this.idNumber = idNumber; }

    public String getEmergencyContactName() { return emergencyContactName; }
    public void setEmergencyContactName(String emergencyContactName) { this.emergencyContactName = emergencyContactName; }

    public String getEmergencyName() { return emergencyName; }
    public void setEmergencyName(String emergencyName) { this.emergencyName = emergencyName; }

    public String getEmergencyContactMobile() { return emergencyContactMobile; }
    public void setEmergencyContactMobile(String emergencyContactMobile) { this.emergencyContactMobile = emergencyContactMobile; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }
}
