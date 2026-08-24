package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.Property;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PropertyDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private String code;
    private String type;
    private String description;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String manager;
    private String phone;
    private String email;
    private String landlordPan;
    private String pgLicenseNo;
    private String bankAccountName;
    private String bankName;
    private String bankAccountNumber;
    private String bankIfsc;
    private String upiVpa;
    private String authorizedSignatory;
    private String gstin;
    private List<String> amenities = new ArrayList<>();
    private String status;
    private String currency;
    private String timezone;
    private Integer totalBuildings;
    private Integer totalRooms;
    private Integer totalBeds;
    private Integer occupiedBeds;
    private UUID orgId;
    private String organizationName;
    private String createdAt;
    private String razorpayKeyId;
    private String razorpayKeySecret;
    private Boolean hasRazorpaySecret;

    public PropertyDTO() {
    }

    public static PropertyDTO fromEntity(Property p) {
        if (p == null) return null;
        PropertyDTO dto = new PropertyDTO();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setCode(p.getCode());
        dto.setType(p.getType());
        dto.setDescription(p.getDescription());
        dto.setAddress(p.getAddress());
        dto.setCity(p.getCity());
        dto.setState(p.getState());
        dto.setPincode(p.getPincode());
        dto.setManager(p.getManager());
        dto.setPhone(p.getPhone());
        dto.setEmail(p.getEmail());
        dto.setLandlordPan(p.getLandlordPan());
        dto.setPgLicenseNo(p.getPgLicenseNo());
        dto.setBankAccountName(p.getBankAccountName());
        dto.setBankName(p.getBankName());
        dto.setBankAccountNumber(p.getBankAccountNumber());
        dto.setBankIfsc(p.getBankIfsc());
        dto.setUpiVpa(p.getUpiVpa());
        dto.setAuthorizedSignatory(p.getAuthorizedSignatory());
        dto.setGstin(p.getGstin());
        dto.setRazorpayKeyId(p.getRazorpayKeyId());
        dto.setHasRazorpaySecret(p.getRazorpayKeySecret() != null && !p.getRazorpayKeySecret().isBlank());
        if (p.getRazorpayKeySecret() != null && !p.getRazorpayKeySecret().isBlank()) {
            dto.setRazorpayKeySecret("••••••••");
        } else {
            dto.setRazorpayKeySecret("");
        }
        try {
            if (p.getAmenities() != null) {
                dto.setAmenities(new ArrayList<>(p.getAmenities()));
            }
        } catch (Exception e) {
            dto.setAmenities(new ArrayList<>());
        }
        dto.setStatus(p.getStatus());
        dto.setCurrency(p.getCurrency());
        dto.setTimezone(p.getTimezone());
        dto.setTotalBuildings(p.getTotalBuildings());
        dto.setTotalRooms(p.getTotalRooms());
        dto.setTotalBeds(p.getTotalBeds());
        dto.setOccupiedBeds(p.getOccupiedBeds());
        if (p.getCreatedAt() != null) {
            dto.setCreatedAt(p.getCreatedAt().toString());
        }
        if (p.getOrganization() != null) {
            try {
                dto.setOrgId(p.getOrganization().getId());
            } catch (Exception ignored) {}
            try {
                dto.setOrganizationName(p.getOrganization().getName());
            } catch (Exception ignored) {}
        }
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public String getManager() { return manager; }
    public void setManager(String manager) { this.manager = manager; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getLandlordPan() { return landlordPan; }
    public void setLandlordPan(String landlordPan) { this.landlordPan = landlordPan; }

    public String getPgLicenseNo() { return pgLicenseNo; }
    public void setPgLicenseNo(String pgLicenseNo) { this.pgLicenseNo = pgLicenseNo; }

    public String getBankAccountName() { return bankAccountName; }
    public void setBankAccountName(String bankAccountName) { this.bankAccountName = bankAccountName; }

    public String getBankName() { return bankName; }
    public void setBankName(String bankName) { this.bankName = bankName; }

    public String getBankAccountNumber() { return bankAccountNumber; }
    public void setBankAccountNumber(String bankAccountNumber) { this.bankAccountNumber = bankAccountNumber; }

    public String getBankIfsc() { return bankIfsc; }
    public void setBankIfsc(String bankIfsc) { this.bankIfsc = bankIfsc; }

    public String getUpiVpa() { return upiVpa; }
    public void setUpiVpa(String upiVpa) { this.upiVpa = upiVpa; }

    public String getAuthorizedSignatory() { return authorizedSignatory; }
    public void setAuthorizedSignatory(String authorizedSignatory) { this.authorizedSignatory = authorizedSignatory; }

    public List<String> getAmenities() { return amenities; }
    public void setAmenities(List<String> amenities) { this.amenities = amenities; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public Integer getTotalBuildings() { return totalBuildings; }
    public void setTotalBuildings(Integer totalBuildings) { this.totalBuildings = totalBuildings; }

    public Integer getTotalRooms() { return totalRooms; }
    public void setTotalRooms(Integer totalRooms) { this.totalRooms = totalRooms; }

    public Integer getTotalBeds() { return totalBeds; }
    public void setTotalBeds(Integer totalBeds) { this.totalBeds = totalBeds; }

    public Integer getOccupiedBeds() { return occupiedBeds; }
    public void setOccupiedBeds(Integer occupiedBeds) { this.occupiedBeds = occupiedBeds; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getRazorpayKeyId() { return razorpayKeyId; }
    public void setRazorpayKeyId(String razorpayKeyId) { this.razorpayKeyId = razorpayKeyId; }

    public String getRazorpayKeySecret() { return razorpayKeySecret; }
    public void setRazorpayKeySecret(String razorpayKeySecret) { this.razorpayKeySecret = razorpayKeySecret; }

    public Boolean getHasRazorpaySecret() { return hasRazorpaySecret; }
    public void setHasRazorpaySecret(Boolean hasRazorpaySecret) { this.hasRazorpaySecret = hasRazorpaySecret; }

    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }
}
