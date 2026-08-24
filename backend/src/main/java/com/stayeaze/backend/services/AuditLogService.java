package com.stayeaze.backend.services;

import com.stayeaze.backend.models.AuditLog;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.AuditLogRepository;
import com.stayeaze.backend.repository.OrganizationRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    public void log(String action, String clientIp) {
        logCurrent(action, clientIp);
    }

    public void logCurrent(String action, String clientIp) {
        try {
            org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl) {
                UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
                Organization org = null;
                if (userDetails.getOrgId() != null) {
                    org = organizationRepository.findById(userDetails.getOrgId()).orElse(null);
                }
                if (org == null) {
                    org = organizationRepository.findAll().stream().findFirst().orElse(null);
                }
                if (org != null) {
                    AuditLog log = new AuditLog(org, userDetails.getUsername(), action, clientIp != null ? clientIp : "127.0.0.1");
                    auditLogRepository.save(log);
                }
            }
        } catch (Exception ignored) {}
    }

    public void logUser(User user, String action, String clientIp) {
        try {
            if (user != null) {
                Organization org = user.getOrganization();
                if (org == null) {
                    org = organizationRepository.findAll().stream().findFirst().orElse(null);
                }
                if (org != null) {
                    AuditLog log = new AuditLog(org, user.getEmail(), action, clientIp != null ? clientIp : "127.0.0.1");
                    auditLogRepository.save(log);
                }
            }
        } catch (Exception ignored) {}
    }
}
