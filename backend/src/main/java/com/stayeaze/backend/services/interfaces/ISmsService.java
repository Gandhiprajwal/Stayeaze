package com.stayeaze.backend.services.interfaces;

/**
 * Service contract for transactional SMS and messaging gateways.
 */
public interface ISmsService {

    /**
     * Dispatches a welcome SMS notification to a newly registered resident.
     *
     * @param mobile recipient mobile number
     * @param tenantName recipient full name
     * @param tempPassword temporary password issued for portal access
     * @param loginUrl portal sign-in URL
     */
    void sendTenantWelcomeSms(String mobile, String tenantName, String tempPassword, String loginUrl);

    /**
     * Dispatches a general transactional SMS message.
     *
     * @param mobile recipient phone number
     * @param message text message content
     */
    void sendSms(String mobile, String message);
}
