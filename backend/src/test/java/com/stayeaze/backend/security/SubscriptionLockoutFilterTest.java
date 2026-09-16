package com.stayeaze.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayeaze.backend.models.Organization;
import com.stayeaze.backend.models.OrganizationBillingProfile;
import com.stayeaze.backend.repository.OrganizationBillingProfileRepository;
import com.stayeaze.backend.security.services.UserDetailsImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionLockoutFilterTest {

    @Mock
    private OrganizationBillingProfileRepository profileRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private SubscriptionLockoutFilter filter;

    @Mock
    private FilterChain filterChain;

    private UUID orgId;
    private Organization org;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        orgId = UUID.randomUUID();
        org = new Organization("Test Org", "test");
        org.setId(orgId);
        filter.clearCache();
    }

    @Test
    void testBypassPublicAndAuthRoutes() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(profileRepository);
    }

    @Test
    void testSuperAdminExempt() throws ServletException, IOException {
        UserDetailsImpl userDetails = new UserDetailsImpl(
                UUID.randomUUID(), orgId, "super@stayeaze.com", "pass",
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities())
        );

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/properties");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(profileRepository);
    }

    @Test
    void testActiveSubscriptionAllowed() throws ServletException, IOException {
        UserDetailsImpl userDetails = new UserDetailsImpl(
                UUID.randomUUID(), orgId, "owner@stayeaze.com", "pass",
                List.of(new SimpleGrantedAuthority("ROLE_OWNER"))
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities())
        );

        OrganizationBillingProfile profile = new OrganizationBillingProfile(org);
        profile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(10));
        when(profileRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(profile));

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/properties");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertEquals(200, response.getStatus());
    }

    @Test
    void testExpiredBeyondGracePeriod_NonAdminBlocked() throws ServletException, IOException {
        UserDetailsImpl userDetails = new UserDetailsImpl(
                UUID.randomUUID(), orgId, "staff@stayeaze.com", "pass",
                List.of(new SimpleGrantedAuthority("ROLE_STAFF"))
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities())
        );

        OrganizationBillingProfile profile = new OrganizationBillingProfile(org);
        profile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(10));
        when(profileRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(profile));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/properties");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain, never()).doFilter(request, response);
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("Workspace Suspended"));
    }

    @Test
    void testExpiredBeyondGracePeriod_AdminReadOnlyAllowed_MutationsBlocked() throws ServletException, IOException {
        UserDetailsImpl userDetails = new UserDetailsImpl(
                UUID.randomUUID(), orgId, "owner@stayeaze.com", "pass",
                List.of(new SimpleGrantedAuthority("ROLE_OWNER"))
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities())
        );

        OrganizationBillingProfile profile = new OrganizationBillingProfile(org);
        profile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(10));
        when(profileRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(profile));

        // GET request -> allowed
        MockHttpServletRequest getRequest = new MockHttpServletRequest("GET", "/api/v1/properties");
        MockHttpServletResponse getResponse = new MockHttpServletResponse();
        filter.doFilter(getRequest, getResponse, filterChain);
        verify(filterChain).doFilter(getRequest, getResponse);

        // POST request -> blocked
        MockHttpServletRequest postRequest = new MockHttpServletRequest("POST", "/api/v1/properties");
        MockHttpServletResponse postResponse = new MockHttpServletResponse();
        filter.doFilter(postRequest, postResponse, filterChain);
        assertEquals(403, postResponse.getStatus());
        assertTrue(postResponse.getContentAsString().contains("Workspace Access Locked"));
    }

    @Test
    void testEvictCache_InstantlyRefreshesStatus() throws ServletException, IOException {
        UserDetailsImpl userDetails = new UserDetailsImpl(
                UUID.randomUUID(), orgId, "owner@stayeaze.com", "pass",
                List.of(new SimpleGrantedAuthority("ROLE_OWNER"))
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities())
        );

        // Step 1: Expired profile -> cached as locked
        OrganizationBillingProfile expiredProfile = new OrganizationBillingProfile(org);
        expiredProfile.setSubscriptionEndDate(OffsetDateTime.now().minusDays(10));
        when(profileRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(expiredProfile));

        MockHttpServletRequest postReq1 = new MockHttpServletRequest("POST", "/api/v1/properties");
        MockHttpServletResponse postResp1 = new MockHttpServletResponse();
        filter.doFilter(postReq1, postResp1, filterChain);
        assertEquals(403, postResp1.getStatus());

        // Step 2: Renew subscription and evict cache
        OrganizationBillingProfile activeProfile = new OrganizationBillingProfile(org);
        activeProfile.setSubscriptionEndDate(OffsetDateTime.now().plusDays(30));
        when(profileRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(activeProfile));

        filter.evictCache(orgId);

        // Step 3: Immediate next request succeeds without waiting 60s
        MockHttpServletRequest postReq2 = new MockHttpServletRequest("POST", "/api/v1/properties");
        MockHttpServletResponse postResp2 = new MockHttpServletResponse();
        filter.doFilter(postReq2, postResp2, filterChain);

        verify(filterChain).doFilter(postReq2, postResp2);
        assertEquals(200, postResp2.getStatus());
    }
}
