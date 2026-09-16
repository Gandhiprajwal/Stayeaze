package com.stayeaze.backend.payload.response;

import com.stayeaze.backend.models.User;
import com.stayeaze.backend.models.Role;

import java.io.Serializable;
import java.util.UUID;

public class MinimalUserDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String role;
    private String status;
    private UUID orgId;
    private String orgName;

    public MinimalUserDTO() {}

    public static MinimalUserDTO fromEntity(User user) {
        if (user == null) return null;
        MinimalUserDTO dto = new MinimalUserDTO();
        dto.setId(user.getId());

        String name = user.getFirstName();
        if (name == null || name.isBlank()) {
            if (user.getOrganization() != null && user.getOrganization().getName() != null && !user.getOrganization().getName().isBlank()) {
                name = user.getOrganization().getName();
            }
        }
        if (name == null || name.isBlank()) {
            String prefix = user.getEmail() != null && user.getEmail().contains("@") ? user.getEmail().split("@")[0] : "User";
            name = Character.toUpperCase(prefix.charAt(0)) + prefix.substring(1);
        }
        dto.setName(name);
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getMobile());
        dto.setStatus(user.getStatus() != null ? user.getStatus().toLowerCase() : "active");

        String roleName = "PROPERTY_MANAGER";
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            boolean isSuper = user.getRoles().stream().anyMatch(r -> r != null && r.getName() != null &&
                    ("ROLE_SUPER_ADMIN".equalsIgnoreCase(r.getName()) || "SUPER_ADMIN".equalsIgnoreCase(r.getName())));
            boolean isOwner = user.getRoles().stream().anyMatch(r -> r != null && r.getName() != null &&
                    ("ROLE_OWNER".equalsIgnoreCase(r.getName()) || "OWNER".equalsIgnoreCase(r.getName()) || "ADMIN".equalsIgnoreCase(r.getName())));

            if (isSuper) {
                roleName = "SUPER_ADMIN";
            } else if (isOwner) {
                roleName = "OWNER";
            } else {
                Role firstRole = user.getRoles().iterator().next();
                String nameStr = firstRole != null && firstRole.getName() != null ? firstRole.getName() : "PROPERTY_MANAGER";
                roleName = nameStr.startsWith("ROLE_") ? nameStr.substring(5) : nameStr;
            }
        }
        dto.setRole(roleName);

        if (user.getOrganization() != null) {
            dto.setOrgId(user.getOrganization().getId());
            dto.setOrgName(user.getOrganization().getName());
        }
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getOrgName() { return orgName; }
    public void setOrgName(String orgName) { this.orgName = orgName; }
}
