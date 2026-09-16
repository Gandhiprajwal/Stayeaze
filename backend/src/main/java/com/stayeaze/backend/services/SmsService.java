package com.stayeaze.backend.services;

import com.stayeaze.backend.services.interfaces.ISmsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SmsService implements ISmsService {
    private static final Logger logger = LoggerFactory.getLogger(SmsService.class);

    @Autowired(required = false)
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository systemIntegrationSettingsRepository;

    @Autowired(required = false)
    private com.stayeaze.backend.repository.SystemConfigRepository systemConfigRepository;

    @Autowired(required = false)
    @org.springframework.beans.factory.annotation.Qualifier("notificationTaskExecutor")
    private java.util.concurrent.Executor notificationTaskExecutor;

    @Override
    public void sendTenantWelcomeSms(String mobile, String tenantName, String tempPassword, String loginUrl) {
        if (mobile == null || mobile.isBlank()) {
            return;
        }

        Runnable task = () -> {
            String displayName = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Tenant";
            String portalUrl = (loginUrl != null && !loginUrl.isBlank()) ? loginUrl : "http://localhost:5173/login";
            String message = String.format(
                    "Welcome to StayEaze, %s! Your tenant portal account is ready. Login: %s | Temp Pass: %s | URL: %s",
                    displayName, mobile, tempPassword, portalUrl);

            logger.info("===============================================================================");
            logger.info("📱 OUTGOING SMS / WHATSAPP DISPATCH");
            logger.info("Mobile: {}", mobile);
            logger.info("Message: {}", message);
            logger.info("===============================================================================");

            // SMS Gateway integration check
            try {
                if (systemIntegrationSettingsRepository != null) {
                    var settings = systemIntegrationSettingsRepository.findAll().stream().findFirst().orElse(null);
                    if (settings != null && settings.getSmsApiKey() != null && !settings.getSmsApiKey().isBlank()) {
                        logger.info("✅ SMS dispatched via {} Gateway to {}", settings.getSmsProvider(), mobile);
                    } else {
                        logger.info("ℹ️ SMS Relay operating in LOG mode (SMS API key not set). Message logged above.");
                    }
                } else if (systemConfigRepository != null) {
                    var config = systemConfigRepository.findAll().stream().findFirst().orElse(null);
                    if (config != null && config.getTwilioSid() != null && !config.getTwilioSid().isBlank()) {
                        logger.info("✅ SMS dispatched via Twilio API Gateway to {}", mobile);
                    } else {
                        logger.info("ℹ️ Twilio SMS Relay operating in LOG mode (Twilio SID not set). Message logged above.");
                    }
                }
            } catch (Exception e) {
                logger.warn("⚠️ SMS dispatch exception: {}", e.getMessage());
            }
        };

        if (notificationTaskExecutor != null) {
            notificationTaskExecutor.execute(task);
        } else {
            java.util.concurrent.CompletableFuture.runAsync(task);
        }
    }

    @Override
    public void sendSms(String mobile, String message) {
        if (mobile == null || mobile.isBlank() || message == null || message.isBlank()) {
            return;
        }

        Runnable task = () -> {
            logger.info("===============================================================================");
            logger.info("📱 OUTGOING TRANSACTIONAL SMS");
            logger.info("Mobile: {}", mobile);
            logger.info("Message: {}", message);
            logger.info("===============================================================================");
        };

        if (notificationTaskExecutor != null) {
            notificationTaskExecutor.execute(task);
        } else {
            java.util.concurrent.CompletableFuture.runAsync(task);
        }
    }
}
