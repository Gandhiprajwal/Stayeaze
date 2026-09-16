package com.stayeaze.backend.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.*;
import com.stayeaze.backend.payload.request.NotificationLogRequest;
import com.stayeaze.backend.repository.*;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class NotificationLogControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    private Organization testOrg;
    private User ownerUser;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        Role ownerRole = roleRepository.findByName("OWNER")
                .orElseGet(() -> roleRepository.save(new Role("OWNER", "{}")));

        testOrg = new Organization();
        testOrg.setName("Notif Org " + System.currentTimeMillis());
        testOrg.setSubdomain("notiforg" + System.currentTimeMillis());
        testOrg = organizationRepository.saveAndFlush(testOrg);

        String email = "notif_owner_" + System.currentTimeMillis() + "@stayeaze.com";
        ownerUser = new User(testOrg, email, "password123", "81" + (System.currentTimeMillis() % 100000000L));
        ownerUser.setFirstName("Communications Lead");
        ownerUser.setRoles(new HashSet<>(Collections.singleton(ownerRole)));
        ownerUser = userRepository.saveAndFlush(ownerUser);

        UserDetailsImpl userDetails = UserDetailsImpl.build(ownerUser);
        auth = new UsernamePasswordAuthenticationToken(userDetails, null,
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("POST /notification-logs - Dispatch and record notification log")
    void testSendNotification() throws Exception {
        NotificationLogRequest request = new NotificationLogRequest();
        request.setRecipient("tenant.vikas@stayeaze.com");
        request.setType("EMAIL");
        request.setMessageContent("Your rent invoice for this month has been generated.");

        mockMvc.perform(post("/api/v1/notification-logs")
                .with(authentication(auth))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recipient", is("tenant.vikas@stayeaze.com")))
                .andExpect(jsonPath("$.status", is("SENT")));
    }

    @Test
    @DisplayName("GET /notification-logs - Retrieve notification history")
    void testGetNotificationLogs() throws Exception {
        NotificationLog log = new NotificationLog(testOrg, "+919876543210", "SMS", "OTP for StayEaze login is 123456");
        log.setStatus("SENT");
        notificationLogRepository.saveAndFlush(log);

        mockMvc.perform(get("/api/v1/notification-logs")
                .with(authentication(auth))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].recipient", is("+919876543210")));
    }

    @Test
    @DisplayName("PUT /notification-logs/{id}/retry - Retry failed notification")
    void testRetryNotification() throws Exception {
        NotificationLog log = new NotificationLog(testOrg, "error_recipient@stayeaze.com", "EMAIL",
                "Failed email alert");
        log.setStatus("FAILED");
        log = notificationLogRepository.saveAndFlush(log);

        mockMvc.perform(put("/api/v1/notification-logs/" + log.getId() + "/retry")
                .with(authentication(auth))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SENT")));
    }

    @Test
    @DisplayName("POST /notification-logs/broadcast-announcement - Broadcast announcement to organization users")
    void testBroadcastAnnouncement() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", "Water Supply Maintenance");
        payload.put("message", "Scheduled maintenance on Sunday 10am to 1pm.");
        payload.put("priority", "HIGH");
        payload.put("targetAudience", "ALL");

        mockMvc.perform(post("/api/v1/notification-logs/broadcast-announcement")
                .with(authentication(auth))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetOrgsCount", greaterThanOrEqualTo(1)));
    }
}
