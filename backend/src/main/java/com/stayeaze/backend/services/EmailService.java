package com.stayeaze.backend.services;

import com.stayeaze.backend.models.SystemConfig;
import com.stayeaze.backend.repository.SystemConfigRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Properties;

@Service
public class EmailService {
    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private com.stayeaze.backend.repository.SystemIntegrationSettingsRepository systemIntegrationSettingsRepository;

    @Autowired(required = false)
    private SystemConfigRepository systemConfigRepository;

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String defaultHost;

    @Value("${spring.mail.port:587}")
    private int defaultPort;

    @Value("${spring.mail.username:}")
    private String defaultUsername;

    @Value("${spring.mail.password:}")
    private String defaultPassword;

    @Autowired(required = false)
    @org.springframework.beans.factory.annotation.Qualifier("notificationTaskExecutor")
    private java.util.concurrent.Executor notificationTaskExecutor;

    private String formatAmount(BigDecimal amount) {
        if (amount == null) return "₹0.00";
        try {
            NumberFormat nf = NumberFormat.getCurrencyInstance(Locale.of("en", "IN"));
            String formatted = nf.format(amount);
            return formatted.replace("INR", "₹").replace("Rs.", "₹").trim();
        } catch (Exception e) {
            return "₹" + amount.toPlainString();
        }
    }

    private String infoCard(String innerRowsHtml) {
        return String.format("""
            <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 22px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table width="100%%" cellpadding="0" cellspacing="0" border="0">
                    %s
                  </table>
                </td>
              </tr>
            </table>
        """, innerRowsHtml);
    }

    private String tableRow(String label, String value, boolean isMono, String valueColor, boolean isLast) {
        String border = isLast ? "none" : "1px dashed #e2e8f0";
        String color = valueColor != null ? valueColor : "#0f172a";
        String fontFamily = isMono ? "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;" : "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";
        return String.format("""
            <tr>
              <td style="padding: 9px 0; border-bottom: %s; color: #64748b; font-size: 13px; font-weight: 500; text-align: left; vertical-align: middle;">%s</td>
              <td style="padding: 9px 0; border-bottom: %s; color: %s; font-size: 13px; font-weight: 700; text-align: right; vertical-align: middle; %s">%s</td>
            </tr>
        """, border, label, border, color, fontFamily, value);
    }

    private String highlightRow(String label, String amountFormatted, String bgHex, String textHex) {
        return String.format("""
            <tr>
              <td colspan="2" style="padding-top: 14px;">
                <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: %s; border-radius: 8px;">
                  <tr>
                    <td style="padding: 12px 16px; color: %s; font-size: 13px; font-weight: 700; text-align: left; vertical-align: middle;">%s</td>
                    <td style="padding: 12px 16px; color: %s; font-size: 17px; font-weight: 800; text-align: right; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">%s</td>
                  </tr>
                </table>
              </td>
            </tr>
        """, bgHex, textHex, label, textHex, amountFormatted);
    }

    private volatile JavaMailSender cachedMailSender = null;
    private volatile String cachedMailConfigHash = null;

    /**
     * Invalidates the in-memory JavaMailSender cache (e.g. when SystemConfig SMTP changes).
     */
    public void invalidateMailSenderCache() {
        this.cachedMailSender = null;
        this.cachedMailConfigHash = null;
    }

    /**
     * Resolves or dynamically instantiates JavaMailSender with active SMTP credentials.
     * Caches the instance in memory to avoid redundant allocations and DB hits on bulk dispatches.
     */
    public JavaMailSender getActiveMailSender() {
        String host = defaultHost;
        int port = defaultPort;
        String username = defaultUsername;
        String password = defaultPassword;

        try {
            if (systemIntegrationSettingsRepository != null) {
                var settings = systemIntegrationSettingsRepository.findAll().stream().findFirst().orElse(null);
                if (settings != null && settings.getSmtpHost() != null && !settings.getSmtpHost().isBlank()) {
                    host = settings.getSmtpHost().trim();
                    if (settings.getSmtpPort() != null && !settings.getSmtpPort().isBlank()) {
                        try { port = Integer.parseInt(settings.getSmtpPort().trim()); } catch (Exception ignored) {}
                    }
                    if (settings.getSmtpUsername() != null && !settings.getSmtpUsername().isBlank()) {
                        username = settings.getSmtpUsername().trim();
                    }
                    if (settings.getSmtpPassword() != null && !settings.getSmtpPassword().isBlank()) {
                        password = settings.getSmtpPassword().trim();
                    }
                }
            } else if (systemConfigRepository != null) {
                SystemConfig config = systemConfigRepository.findFirstNative()
                        .orElseGet(() -> systemConfigRepository.findAll().stream().findFirst().orElse(null));
                if (config != null && config.getSmtpHost() != null && !config.getSmtpHost().isBlank()) {
                    host = config.getSmtpHost().trim();
                    if (config.getSmtpPort() != null && !config.getSmtpPort().isBlank()) {
                        try { port = Integer.parseInt(config.getSmtpPort().trim()); } catch (Exception ignored) {}
                    }
                    if (config.getSmtpUsername() != null && !config.getSmtpUsername().isBlank()) {
                        username = config.getSmtpUsername().trim();
                    }
                    if (config.getSmtpPassword() != null && !config.getSmtpPassword().isBlank()) {
                        password = config.getSmtpPassword().trim();
                    }
                }
            }
        } catch (Exception ignored) {}

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return null; // Return null so we log in Dev Log Mode rather than hanging on unauthenticated socket timeouts
        }

        String currentConfigHash = host + ":" + port + ":" + username + ":" + password.hashCode();
        if (cachedMailSender != null && currentConfigHash.equals(cachedMailConfigHash)) {
            return cachedMailSender;
        }

        JavaMailSenderImpl dynamicSender = new JavaMailSenderImpl();
        dynamicSender.setHost(host);
        dynamicSender.setPort(port);
        dynamicSender.setUsername(username);
        dynamicSender.setPassword(password);

        Properties props = dynamicSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        if (port == 465) {
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.socketFactory.port", "465");
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
        }
        props.put("mail.smtp.ssl.trust", "*");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        props.put("mail.smtp.writetimeout", "5000");

        this.cachedMailConfigHash = currentConfigHash;
        this.cachedMailSender = dynamicSender;

        return dynamicSender;
    }

    /**
     * Reusable Property-Themed HTML Email Shell with StayEaze watermark in footer.
     */
    private String buildPropertyBrandedHtml(String propertyName, String title, String badgeText, String contentHtml, String ctaText, String ctaUrl) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Premium Residency";
        String ctaButtonHtml = "";
        if (ctaText != null && ctaUrl != null && !ctaText.isBlank()) {
            ctaButtonHtml = String.format("""
                <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 10px 0;">
                  <tr>
                    <td align="center">
                      <a href="%s" style="background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; padding: 13px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">%s</a>
                    </td>
                  </tr>
                </table>
            """, ctaUrl, ctaText);
        }

        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; line-height: 1.6; }
                .email-wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
                .hero-header { background: linear-gradient(135deg, #1e1b4b 0%%, #312e81 50%%, #4338ca 100%%); padding: 32px 24px; text-align: center; color: #ffffff; }
                .prop-name { font-size: 22px; font-weight: 800; margin: 0 0 4px 0; letter-spacing: -0.5px; }
                .hero-title { font-size: 14px; opacity: 0.9; margin: 0; font-weight: 500; color: #c7d2fe; }
                .badge-pill { display: inline-block; background: rgba(255,255,255,0.18); backdrop-filter: blur(8px); color: #ffffff; font-weight: 700; font-size: 11px; padding: 4px 12px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.25); }
                .body-content { padding: 32px 24px; font-size: 14px; color: #334155; }
                .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
                .watermark { margin-top: 8px; font-size: 10px; color: #94a3b8; font-weight: 600; }
              </style>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; line-height: 1.6;">
              <table width="100%%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div class="email-wrapper" style="max-width: 580px; width: 100%%; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; text-align: left;">
                      <div class="hero-header" style="background: linear-gradient(135deg, #1e1b4b 0%%, #312e81 50%%, #4338ca 100%%); padding: 32px 24px; text-align: center; color: #ffffff;">
                        <div class="badge-pill" style="display: inline-block; background: rgba(255,255,255,0.18); color: #ffffff; font-weight: 700; font-size: 11px; padding: 4px 12px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.25);">%s</div>
                        <h1 class="prop-name" style="font-size: 22px; font-weight: 800; margin: 0 0 4px 0; letter-spacing: -0.5px; color: #ffffff;">%s</h1>
                        <p class="hero-title" style="font-size: 14px; margin: 0; font-weight: 500; color: #c7d2fe;">%s</p>
                      </div>
                      <div class="body-content" style="padding: 32px 24px; font-size: 14px; color: #334155;">
                        %s
                        %s
                      </div>
                      <div class="footer" style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                        <div>This is an official communication from the management of <strong>%s</strong>.</div>
                        <div class="watermark" style="margin-top: 8px; font-size: 10px; color: #94a3b8; font-weight: 600;">⚡ Powered by StayEaze PG & Co-Living Operating System &copy; %d</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
            </html>
        """, badgeText, pName, title, contentHtml, ctaButtonHtml, pName, LocalDate.now().getYear());
    }

    /**
     * 1. Tenant Welcome & Onboarding Credentials Email
     */
    public void sendTenantWelcomeOnboardingEmail(
            String recipientEmail,
            String tenantName,
            String tempPassword,
            String propertyName,
            String roomNumber,
            String bedNumber,
            String portalUrl
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String rNum = (roomNumber != null && !roomNumber.isBlank()) ? roomNumber : "Assigned Room";
        String bNum = (bedNumber != null && !bedNumber.isBlank()) ? bedNumber : "Assigned Bed";
        String displayName = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Resident";
        String pUrl = (portalUrl != null && !portalUrl.isBlank()) ? portalUrl : "http://localhost:5173/login";

        String subject = "Welcome to " + pName + " - Your Resident Portal Credentials";

        String rows = tableRow("Property", pName, false, "#0f172a", false) +
                     tableRow("Room Number", "Room " + rNum, false, "#0f172a", false) +
                     tableRow("Bed Number", "Bed " + bNum, false, "#0f172a", true);

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Welcome to your new home at <strong>%s</strong>! Your accommodation onboarding has been completed successfully.</p>
            
            %s

            <p>You can now access your Resident Portal to pay monthly rent online, download verified HRA receipts, and raise maintenance tickets.</p>

            <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; margin: 18px 0;">
              <tr>
                <td style="padding: 18px 20px;">
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4338ca; letter-spacing: 1px; margin-bottom: 8px;">Your Login Credentials</div>
                  <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #1e1b4b; padding: 3px 0;"><strong>User / Email:</strong> %s</div>
                  <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #1e1b4b; padding: 3px 0;"><strong>Temp Password:</strong> %s</div>
                </td>
              </tr>
            </table>

            <p style="font-size: 12px; color: #64748b; margin-top: 14px;">
              * <em>For your security, you will be prompted to set your personal permanent password upon first login.</em>
            </p>
        """, displayName, pName, infoCard(rows), recipientEmail, tempPassword);

        String html = buildPropertyBrandedHtml(pName, "Resident Welcome & Access Details", "✓ Onboarding Confirmed", contentHtml, "Log In to Resident Portal", pUrl);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 2. Advance Booking Deposit Payment Receipt Email
     */
    public void sendAdvancePaymentReceipt(
            String recipientEmail,
            String tenantName,
            String bookingCode,
            String propertyName,
            String roomBed,
            BigDecimal advanceAmount,
            String paymentMethod,
            String transactionId,
            String bookingDate
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String displayName = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Valued Resident";
        String subject = pName + " - Booking Confirmation & Deposit Receipt (" + (bookingCode != null ? bookingCode : "BK-RECEIPT") + ")";
        String amountFormatted = formatAmount(advanceAmount);
        String pMethod = (paymentMethod != null && !paymentMethod.isBlank()) ? paymentMethod.toUpperCase() : "ONLINE";
        String txId = (transactionId != null && !transactionId.isBlank()) ? transactionId : "TXN-" + System.currentTimeMillis() % 1000000L;
        String dateStr = (bookingDate != null) ? bookingDate : LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        String rows = tableRow("Booking Reference", bookingCode != null ? bookingCode : "BK-CONFIRMED", true, "#0f172a", false) +
                     tableRow("Allocated Unit", roomBed != null ? roomBed : "Standard Unit", false, "#0f172a", false) +
                     tableRow("Payment Date", dateStr, false, "#0f172a", false) +
                     tableRow("Payment Mode", pMethod, false, "#0f172a", false) +
                     tableRow("Transaction ID", txId, true, "#0f172a", false) +
                     highlightRow("Deposit Amount Paid", amountFormatted, "#e0e7ff", "#3730a3");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Thank you for reserving your stay at <strong>%s</strong>. We have received your advance booking deposit.</p>

            %s

            <p style="font-size: 13px; color: #475569;">Please present this booking confirmation upon your arrival at the property reception.</p>
        """, displayName, pName, infoCard(rows));

        String html = buildPropertyBrandedHtml(pName, "Booking Confirmation & Deposit Receipt", "✓ Deposit Paid", contentHtml, null, null);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 3. Monthly Rent Invoice Notice Email
     */
    public void sendRentInvoiceIssuedEmail(
            String recipientEmail,
            String tenantName,
            String invoiceNumber,
            BigDecimal amountDue,
            String dueDate,
            String propertyName,
            String paymentUrl
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String displayName = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Resident";
        String subject = pName + " - Monthly Rent Invoice (" + invoiceNumber + ")";
        String amountFormatted = formatAmount(amountDue);
        String pUrl = (paymentUrl != null && !paymentUrl.isBlank()) ? paymentUrl : "http://localhost:5173/tenant/billing";
        String dueStr = dueDate != null ? dueDate : "5th of this month";

        String rows = tableRow("Invoice Number", invoiceNumber, true, "#0f172a", false) +
                     tableRow("Due Date", dueStr, false, "#dc2626", false) +
                     highlightRow("Total Amount Due", amountFormatted, "#fee2e2", "#991b1b");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Your monthly accommodation rental invoice for <strong>%s</strong> has been generated.</p>

            %s

            <p style="font-size: 13px;">Please make your payment on or before the due date to avoid late payment charges.</p>
        """, displayName, pName, infoCard(rows));

        String html = buildPropertyBrandedHtml(pName, "Monthly Rent Invoice", "Invoice Issued", contentHtml, "Pay Rent Online (Razorpay)", pUrl);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 4. Rent Payment Receipt & HRA Tax Exemption Proof Email
     */
    public void sendRentPaymentSuccessEmail(
            String recipientEmail,
            String tenantName,
            String invoiceNumber,
            BigDecimal amountPaid,
            String paymentMethod,
            String transactionId,
            String propertyName
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String displayName = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Resident";
        String subject = pName + " - Official Rent Payment Receipt (" + invoiceNumber + ")";
        String amountFormatted = formatAmount(amountPaid);
        String pMethod = (paymentMethod != null && !paymentMethod.isBlank()) ? paymentMethod.toUpperCase() : "ONLINE";
        String txId = (transactionId != null && !transactionId.isBlank()) ? transactionId : "TXN-" + System.currentTimeMillis() % 1000000L;
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        String rows = tableRow("Invoice Ref", invoiceNumber, true, "#0f172a", false) +
                     tableRow("Payment Mode", pMethod, false, "#0f172a", false) +
                     tableRow("Transaction Ref", txId, true, "#0f172a", false) +
                     tableRow("Date of Payment", dateStr, false, "#0f172a", false) +
                     highlightRow("Amount Received", amountFormatted, "#dcfce7", "#166534");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>We have successfully received your rent payment for <strong>%s</strong>. Here is your official verified receipt for tax/HRA filing.</p>

            %s

            <p style="font-size: 12px; color: #64748b;">* This computer-generated receipt is a valid proof of house rent paid for Income Tax HRA deduction under section 10(13A).</p>
        """, displayName, pName, infoCard(rows));

        String html = buildPropertyBrandedHtml(pName, "Rent Payment Receipt (HRA Valid)", "✓ Payment Received", contentHtml, "Download HRA PDF Receipt", "http://localhost:5173/tenant/billing");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 5. Two-Factor Authentication (2FA) OTP Email
     */
    public void sendTwoFactorOtpEmail(String recipientEmail, String displayName, String otpCode) {
        String name = (displayName != null && !displayName.isBlank()) ? displayName : "User";
        String subject = "Your StayEaze 2FA Verification Code: " + otpCode;

        String contentHtml = String.format("""
            <p>Hello <strong>%s</strong>,</p>
            <p>A login attempt requires your two-factor authentication verification code.</p>

            <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
              <tr>
                <td align="center">
                  <div style="display: inline-block; background: #eef2ff; border: 2px dashed #6366f1; border-radius: 12px; padding: 14px 28px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 900; letter-spacing: 8px; color: #4338ca;">
                    %s
                  </div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Valid for 5 minutes. Do not share this code.</div>
                </td>
              </tr>
            </table>

            <p style="font-size: 12px; color: #64748b;">If you did not initiate this login request, please change your password immediately.</p>
        """, name, otpCode);

        String html = buildPropertyBrandedHtml("StayEaze Security", "Two-Factor Authentication", "Security Code", contentHtml, null, null);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 6. Password Reset OTP Email
     */
    public void sendPasswordResetOtpEmail(String recipientEmail, String displayName, String otpCode) {
        String name = (displayName != null && !displayName.isBlank()) ? displayName : "User";
        String subject = "Password Reset Request - StayEaze Code: " + otpCode;

        String contentHtml = String.format("""
            <p>Hello <strong>%s</strong>,</p>
            <p>We received a request to reset your password. Use the verification code below to set a new password:</p>

            <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
              <tr>
                <td align="center">
                  <div style="display: inline-block; background: #eef2ff; border: 2px dashed #6366f1; border-radius: 12px; padding: 14px 28px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 28px; font-weight: 900; letter-spacing: 8px; color: #4338ca;">
                    %s
                  </div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Expires in 10 minutes.</div>
                </td>
              </tr>
            </table>
        """, name, otpCode);

        String html = buildPropertyBrandedHtml("StayEaze Account Security", "Password Reset Verification", "Reset Request", contentHtml, null, null);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 7. Maintenance Ticket Filed Email
     */
    public void sendComplaintFiledEmail(String recipientEmail, String tenantName, String ticketNumber, String category, String description, String propertyName) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String subject = pName + " - Maintenance Ticket Received (" + ticketNumber + ")";

        String rows = tableRow("Ticket Reference", ticketNumber, true, "#0f172a", false) +
                     tableRow("Category", category != null ? category.toUpperCase() : "GENERAL", false, "#0f172a", false) +
                     tableRow("Status", "OPEN / IN PROGRESS", false, "#d97706", true);

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Your maintenance request has been logged and assigned to our facility staff at <strong>%s</strong>.</p>

            %s

            <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-left: 4px solid #6366f1; border-radius: 4px; margin: 16px 0;">
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #475569;">
                  <strong style="color: #1e293b;">Issue Description:</strong><br>%s
                </td>
              </tr>
            </table>

            <p style="font-size: 13px;">Our maintenance team will attend to your unit shortly.</p>
        """, tenantName != null ? tenantName : "Resident", pName, infoCard(rows), description != null ? description : "N/A");

        String html = buildPropertyBrandedHtml(pName, "Maintenance Request Logged", "Ticket Logged", contentHtml, "Track Complaint Status", "http://localhost:5173/complaints");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 8. Maintenance Ticket Resolved Email
     */
    public void sendComplaintResolvedEmail(String recipientEmail, String tenantName, String ticketNumber, String category, String propertyName) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String subject = pName + " - Maintenance Ticket Resolved (" + ticketNumber + ")";

        String rows = tableRow("Ticket Reference", ticketNumber, true, "#0f172a", false) +
                     tableRow("Category", category != null ? category.toUpperCase() : "GENERAL", false, "#0f172a", false) +
                     tableRow("Status", "RESOLVED / COMPLETED", false, "#166534", true);

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Your maintenance issue (Ticket <strong>%s</strong>) has been marked as <strong>RESOLVED</strong> by the facility team.</p>

            %s

            <p style="font-size: 12px; color: #64748b;">If you are not satisfied with the resolution, you can reopen the ticket from your portal.</p>
        """, tenantName != null ? tenantName : "Resident", ticketNumber, infoCard(rows));

        String html = buildPropertyBrandedHtml(pName, "Maintenance Issue Resolved", "✓ Issue Resolved", contentHtml, "View Resolved Tickets", "http://localhost:5173/complaints");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 9. New User Credentials Email (Staff/Manager)
     */
    public void sendNewUserCredentials(String recipientEmail, String tempPassword, String name) {
        String displayName = (name != null && !name.isBlank()) ? name : recipientEmail;
        String subject = "Welcome to StayEaze Management Console - Your Account Credentials";

        String contentHtml = String.format("""
            <p>Hello <strong>%s</strong>,</p>
            <p>An administrative staff account has been provisioned for you on the StayEaze Operations Platform.</p>

            <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; margin: 18px 0;">
              <tr>
                <td style="padding: 18px 20px;">
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4338ca; letter-spacing: 1px; margin-bottom: 8px;">Admin Console Access</div>
                  <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #1e1b4b; padding: 3px 0;"><strong>Username / Email:</strong> %s</div>
                  <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #1e1b4b; padding: 3px 0;"><strong>Temporary Password:</strong> %s</div>
                </td>
              </tr>
            </table>

            <p style="font-size: 12px; color: #64748b;">Please change your password upon your first login.</p>
        """, displayName, recipientEmail, tempPassword);

        String html = buildPropertyBrandedHtml("StayEaze Operations", "Staff Account Provisioned", "Console Credentials", contentHtml, "Access Management Console", "http://localhost:5173/login");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 10. Live SMTP Diagnostic Test Email
     */
    public String sendTestEmail(String recipientEmail) {
        String subject = "StayEaze SMTP Integration Test - Connection Succeeded!";

        String rows = tableRow("Status", "CONNECTED & VERIFIED", false, "#166534", false) +
                     tableRow("Recipient", recipientEmail, false, "#0f172a", false) +
                     tableRow("Timestamp", LocalDate.now().toString(), true, "#0f172a", true);

        String contentHtml = String.format("""
            <p>Hello Super Administrator,</p>
            <p>🎉 This is a live test email confirming that your SMTP server relay credentials are functioning properly.</p>

            %s
        """, infoCard(rows));

        String html = buildPropertyBrandedHtml("StayEaze Cloud Infrastructure", "SMTP Live Connectivity Test", "Test Dispatch", contentHtml, null, null);

        JavaMailSender sender = getActiveMailSender();
        if (sender == null) {
            throw new RuntimeException("No SMTP sender available. Please configure SMTP host, username, and password in System Integrations.");
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(recipientEmail);
            helper.setSubject(subject);
            helper.setText(html, true);
            sender.send(message);
            logger.info("✅ SMTP Test Email sent successfully to {}", recipientEmail);
            return "Test email sent successfully to " + recipientEmail + "! Check your inbox.";
        } catch (Exception e) {
            logger.error("❌ SMTP Test Dispatch Failed: {}", e.getMessage(), e);
            throw new RuntimeException("SMTP Dispatch Failed: " + e.getMessage());
        }
    }

    /**
     * 10. Property Owner SaaS Registration & Subscription Invoice Email
     */
    public void sendPropertyOwnerRegistrationInvoice(
            String recipientEmail,
            String ownerName,
            String propertyName,
            String propertyCode,
            String invoiceNum,
            BigDecimal planPrice,
            String checkoutPaymentUrl
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze PG";
        String name = (ownerName != null && !ownerName.isBlank()) ? ownerName : "Property Owner";
        String subject = pName + " - Subscription Invoice & Property Registration (" + invoiceNum + ")";
        String priceFormatted = formatAmount(planPrice != null ? planPrice : new BigDecimal("1499.00"));
        String payUrl = (checkoutPaymentUrl != null && !checkoutPaymentUrl.isBlank()) ? checkoutPaymentUrl : "http://localhost:5173/subscription";

        String rows = tableRow("Property Name", pName, false, "#0f172a", false) +
                     tableRow("Property Code", propertyCode != null ? propertyCode : "PROP", true, "#0f172a", false) +
                     tableRow("Invoice Ref", invoiceNum, true, "#0f172a", false) +
                     highlightRow("Plan Amount", priceFormatted, "#e0e7ff", "#3730a3");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Welcome to StayEaze! Your property registration invoice for <strong>%s</strong> has been generated.</p>

            %s

            <p style="font-size: 13px; color: #475569;">You can complete your SaaS subscription payment or access your property management dashboard below.</p>
        """, name, pName, infoCard(rows));

        String html = buildPropertyBrandedHtml(pName, "Property Registration & Invoice", "SaaS Invoice", contentHtml, "Manage Subscription", payUrl);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 11. Resident Check-In Tax Invoice Email
     */
    public void sendCheckInInvoiceEmail(
            String recipientEmail,
            String tenantName,
            String invoiceNumber,
            String propertyName,
            String roomBed,
            BigDecimal rent,
            BigDecimal deposit,
            BigDecimal advance,
            BigDecimal netDue,
            String paymentMode,
            String checkInDate
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String name = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Resident";
        String subject = pName + " - Check-In Tax Invoice (" + invoiceNumber + ")";
        String rentFormatted = formatAmount(rent);
        String depFormatted = formatAmount(deposit);
        String advFormatted = formatAmount(advance);
        String netFormatted = formatAmount(netDue);

        String rows = tableRow("Invoice Number", invoiceNumber, true, "#0f172a", false) +
                     tableRow("Accommodation Unit", roomBed != null ? roomBed : "Unit", false, "#0f172a", false) +
                     tableRow("Monthly Rent", rentFormatted, false, "#0f172a", false) +
                     tableRow("Security Deposit", depFormatted, false, "#0f172a", false) +
                     tableRow("Advance Paid", advFormatted, false, "#0f172a", false) +
                     tableRow("Payment Mode", paymentMode != null ? paymentMode : "CASH", false, "#0f172a", false) +
                     tableRow("Check-In Date", checkInDate != null ? checkInDate : "", false, "#0f172a", false) +
                     highlightRow("Net Amount Due", netFormatted, "#e0e7ff", "#3730a3");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Welcome to <strong>%s</strong>! Your official check-in invoice has been generated.</p>

            %s
        """, name, pName, infoCard(rows));

        String html = buildPropertyBrandedHtml(pName, "Check-In Tax Invoice", "Check-In Confirmed", contentHtml, "View Resident Portal", "http://localhost:5173/tenant/billing");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * 12. Security Deposit Refund Settlement Voucher Email
     */
    public void sendDepositRefundReceiptEmail(
            String recipientEmail,
            String tenantName,
            String checkOutCode,
            String propertyName,
            BigDecimal depositPaid,
            BigDecimal deductions,
            BigDecimal netRefund,
            String paymentMode,
            String utrRef,
            String settlementDate
    ) {
        String pName = (propertyName != null && !propertyName.isBlank()) ? propertyName : "StayEaze Residency";
        String name = (tenantName != null && !tenantName.isBlank()) ? tenantName : "Resident";
        String subject = pName + " - Security Deposit Refund Settlement Voucher (" + checkOutCode + ")";
        String depFormatted = formatAmount(depositPaid);
        String dedFormatted = formatAmount(deductions);
        String netFormatted = formatAmount(netRefund);
        String modeStr = (paymentMode != null && !paymentMode.isBlank()) ? paymentMode.toUpperCase() : "BANK_TRANSFER";
        String txRef = (utrRef != null && !utrRef.isBlank()) ? utrRef : "N/A";
        String dateStr = (settlementDate != null && !settlementDate.isBlank()) ? settlementDate : LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        String rows = tableRow("Check-Out Ref", checkOutCode, true, "#0f172a", false) +
                     tableRow("Original Deposit Paid", depFormatted, false, "#0f172a", false) +
                     tableRow("Deductions (Damages/Bills)", "- " + dedFormatted, false, "#dc2626", false) +
                     tableRow("Payout Mode", modeStr, false, "#0f172a", false) +
                     tableRow("Bank UTR / Transaction Ref", txRef, true, "#0f172a", false) +
                     tableRow("Settlement Date", dateStr, false, "#0f172a", false) +
                     highlightRow("Net Refund Paid", netFormatted, "#dcfce7", "#166534");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Your move-out security deposit refund for <strong>%s</strong> has been approved and settled by accounts.</p>

            %s

            <p style="font-size: 12px; color: #64748b;">Thank you for choosing %s. We wish you the very best in your journey!</p>
        """, name, pName, infoCard(rows), pName);

        String html = buildPropertyBrandedHtml(pName, "Deposit Refund Settlement", "✓ Refund Settled", contentHtml, null, null);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * VIP Onboarding Lead Confirmation (When public registrations are invite-only)
     */
    public void sendVipLeadConfirmationEmail(String recipientEmail, String ownerName, String orgName, String leadRefCode) {
        String subject = "✨ VIP Early Access Application Received - StayEaze";

        String rows = tableRow("Reference ID", leadRefCode, true, "#4f46e5", false) +
                      tableRow("Applicant Name", ownerName, false, null, false) +
                      tableRow("Organization", orgName, false, null, false) +
                      tableRow("Application Status", "VIP REVIEW IN PROGRESS", false, "#d97706", true);

        String whatsappUrl = "https://wa.me/919876543210?text=Hi%20StayEaze%20Team%2C%20I%20applied%20for%20VIP%20Access%20with%20Ref%3A%20" + leadRefCode;

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Thank you for your interest in <strong>StayEaze</strong>! We have received your application for <strong>%s</strong>.</p>
            <p>Our onboarding concierge is reviewing your request. A specialist will reach out within 24 hours with your exclusive VIP Invite Pass.</p>

            %s

            <p style="margin-top: 18px; font-size: 13px; color: #475569;">Need priority onboarding or an instant demo? Chat directly with our onboarding desk on WhatsApp.</p>
        """, ownerName, orgName, infoCard(rows));

        String html = buildPropertyBrandedHtml("StayEaze Cloud", "VIP Early Access Request", "★ Application Received", contentHtml, "💬 Connect on WhatsApp", whatsappUrl);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * Organization Account Approved & Activated Email
     */
    public void sendOrganizationApprovalEmail(String recipientEmail, String ownerName, String orgName, String subdomain) {
        String subject = "🎉 Your StayEaze Workspace is Approved & Ready - " + orgName;
        String loginUrl = "http://" + subdomain + ".localhost:5173/login";

        String rows = tableRow("Organization", orgName, false, null, false) +
                      tableRow("Workspace Subdomain", subdomain, true, "#4f46e5", false) +
                      tableRow("Account Status", "ACTIVE & READY", false, "#16a34a", true);

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Great news! Your StayEaze organization workspace for <strong>%s</strong> has been approved by the platform administration team.</p>
            <p>Your multi-property management environment is now fully active with complete features enabled.</p>

            %s

            <p style="font-size: 13px; color: #475569;">You can now log in using your registered credentials and begin setting up your properties, buildings, and rooms.</p>
        """, ownerName, orgName, infoCard(rows));

        String html = buildPropertyBrandedHtml(orgName, "Workspace Approved", "✓ Account Activated", contentHtml, "Launch Your Workspace", loginUrl);
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * Organization Account Rejected & Refund Notice Email
     */
    public void sendOrganizationRejectionEmail(String recipientEmail, String ownerName, String orgName, String reason, String refundNotice) {
        String subject = "Update Regarding Your StayEaze Registration - " + orgName;

        String rows = tableRow("Organization", orgName, false, null, false) +
                      tableRow("Review Decision", "REGISTRATION REJECTED", false, "#e11d48", true) +
                      (reason != null && !reason.isBlank() ? tableRow("Reason / Remarks", reason, false, null, false) : "") +
                      (refundNotice != null && !refundNotice.isBlank() ? tableRow("Payment Refund", refundNotice, true, "#16a34a", false) : "");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>Thank you for submitting your organization registration for <strong>%s</strong> on StayEaze.</p>
            <p>After reviewing your application, our onboarding team is unable to approve this workspace request at this time.</p>

            %s

            <p style="font-size: 13px; color: #475569; margin-top: 18px;">
                If you believe this was an error or would like to submit updated KYC or business information, please contact our support desk at <a href="mailto:support@stayeaze.com">support@stayeaze.com</a>.
            </p>
        """, ownerName != null ? ownerName : "Property Owner", orgName, infoCard(rows));

        String html = buildPropertyBrandedHtml(orgName, "Registration Update", "Notice", contentHtml, "Contact Helpdesk", "mailto:support@stayeaze.com");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * Official Refund Settlement Certificate Email with Bank Reference (ARN)
     */
    public void sendRefundSettlementEmail(String recipientEmail, String ownerName, String orgName, java.math.BigDecimal refundAmount, String refundArn, String refundId) {
        String subject = "Payment Refund Settled - StayEaze Registration (" + orgName + ")";

        String rows = tableRow("Organization", orgName, false, null, false) +
                      tableRow("Refund Status", "SETTLED TO SOURCE ACCOUNT", false, "#16a34a", true) +
                      tableRow("Refunded Amount", "₹" + (refundAmount != null ? refundAmount.toPlainString() : "1,499.00"), false, null, true) +
                      (refundArn != null && !refundArn.isBlank() ? tableRow("Bank Reference (ARN / UTR)", refundArn, true, "#4f46e5", true) : "") +
                      (refundId != null ? tableRow("Gateway Refund ID", refundId, false, null, false) : "");

        String contentHtml = String.format("""
            <p>Dear <strong>%s</strong>,</p>
            <p>We are writing to confirm that your fee refund for <strong>%s</strong> has been fully processed and settled to your original source account.</p>

            %s

            <p style="font-size: 13px; color: #475569; margin-top: 18px;">
                You can quote the <strong>Bank Reference (ARN / UTR)</strong> above to your bank branch if you need to track the exact incoming transaction into your account statement.
            </p>
        """, ownerName != null ? ownerName : "Property Owner", orgName, infoCard(rows));

        String html = buildPropertyBrandedHtml(orgName, "Refund Settlement Confirmation", "✓ Funds Dispatched", contentHtml, "Contact Support Desk", "mailto:support@stayeaze.com");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    /**
     * Onboarding Payment Recovery Email with 1-Click Retry Link
     */
    public void sendOnboardingPaymentRecoveryEmail(String recipientEmail, String leadName, String checkoutUrl, String planName) {
        String subject = "Complete Your StayEaze Workspace Activation - " + (planName != null ? planName : "PG Management");

        String rows = tableRow("Subscriber", leadName != null ? leadName : "Valued Partner", false, null, false) +
                      tableRow("Plan Selected", planName != null ? planName : "Starter PG Plan", false, null, false) +
                      tableRow("Checkout Status", "PAYMENT INCOMPLETE / PENDING", false, "#f59e0b", true);

        String contentHtml = String.format("""
            <p>Hi <strong>%s</strong>,</p>
            <p>We noticed you started setting up your PG / Hostel workspace on StayEaze, but your payment was interrupted or encountered a temporary gateway issue.</p>

            %s

            <p style="font-size: 13px; color: #475569; margin-top: 18px;">
                We have reserved your property details and domain subdomain for the next 24 hours. Click the button below to resume your payment securely and activate your account.
            </p>
        """, leadName != null ? leadName : "Property Owner", infoCard(rows));

        String html = buildPropertyBrandedHtml("StayEaze Cloud", "Resume Onboarding Payment", "⚡ 1-Click Activation", contentHtml, "Complete Payment Now", checkoutUrl != null ? checkoutUrl : "https://stayeaze.com/signup");
        dispatchEmail(recipientEmail, subject, html, true);
    }

    public void sendPaymentReceiptEmail(String toEmail, String residentName, String receiptNumber, String invoiceNumber, BigDecimal amountPaid, String paymentMethod, String txnRef, BigDecimal advanceBalance, String receiptUrl) {
        if (toEmail == null || toEmail.isBlank()) return;

        String formattedAmount = formatAmount(amountPaid);
        String subject = String.format("Payment Receipt: %s received for %s", formattedAmount, receiptNumber);

        String cardHtml = infoCard(String.join("",
                tableRow("Receipt Number", receiptNumber, true, "#4338ca", false),
                tableRow("Invoice Reference", invoiceNumber != null ? invoiceNumber : "N/A", true, null, false),
                tableRow("Amount Paid", formattedAmount, true, "#15803d", false),
                tableRow("Payment Method", paymentMethod != null ? paymentMethod.toUpperCase() : "CASH", false, null, false),
                tableRow("Transaction Reference", txnRef != null && !txnRef.isBlank() ? txnRef : "Direct / Cash Counter", true, null, false),
                tableRow("Advance Wallet Credit", formatAmount(advanceBalance), true, "#047857", true)
        ));

        String contentHtml = String.format("""
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">Dear <strong>%s</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                Thank you! We have successfully received and processed your payment of <strong style="color: #15803d;">%s</strong>.
            </p>
            %s
            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 15px;">
                This transaction has been permanently recorded in your StayEaze residency ledger.
            </p>
        """, residentName != null ? residentName : "Resident", formattedAmount, cardHtml);

        String html = buildPropertyBrandedHtml("StayEaze Residency", "Official Rent & Payment Receipt", "💳 Payment Verified", contentHtml, "Download Rent Receipt (PDF)", receiptUrl != null ? receiptUrl : "#");
        dispatchEmail(toEmail, subject, html, true);
    }

    /**
     * Core Dispatcher with Guaranteed Non-blocking Background Async Execution
     */
    public void dispatchEmail(String recipientEmail, String subject, String content, boolean isHtml) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }

        Runnable task = () -> {
            logger.info("===============================================================================");
            logger.info("📧 DISPATCHING EMAIL");
            logger.info("To: {}", recipientEmail);
            logger.info("Subject: {}", subject);
            logger.info("===============================================================================");

            JavaMailSender sender = getActiveMailSender();
            if (sender == null) {
                logger.info("⚠️ SMTP Credentials not configured or incomplete. Logged in DEV SIMULATION MODE.");
                return;
            }

            try {
                MimeMessage message = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setTo(recipientEmail);
                helper.setSubject(subject);
                helper.setText(content, isHtml);
                sender.send(message);
                logger.info("✅ Live email successfully dispatched via SMTP to {}", recipientEmail);
            } catch (Exception e) {
                logger.error("❌ Live SMTP Dispatch failed for {}: {}", recipientEmail, e.getMessage(), e);
            }
        };

        // If an active database transaction is running, ensure email is dispatched ONLY after the transaction commits successfully.
        // If the database transaction rolls back (e.g. payment failure, validation error), the email will NOT be sent.
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        if (notificationTaskExecutor != null) {
                            notificationTaskExecutor.execute(task);
                        } else {
                            java.util.concurrent.CompletableFuture.runAsync(task);
                        }
                    }
                }
            );
        } else {
            if (notificationTaskExecutor != null) {
                notificationTaskExecutor.execute(task);
            } else {
                java.util.concurrent.CompletableFuture.runAsync(task);
            }
        }
    }
}
