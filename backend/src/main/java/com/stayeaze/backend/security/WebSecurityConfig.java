package com.stayeaze.backend.security;

import com.stayeaze.backend.security.jwt.AuthEntryPointJwt;
import com.stayeaze.backend.security.jwt.AuthTokenFilter;
import com.stayeaze.backend.security.services.UserDetailsServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.ShallowEtagHeaderFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class WebSecurityConfig {

    @Autowired
    UserDetailsServiceImpl userDetailsService;

    @Autowired
    private AuthEntryPointJwt unauthorizedHandler;

    @Bean
    public AuthTokenFilter authenticationJwtTokenFilter() {
        return new AuthTokenFilter();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @org.springframework.beans.factory.annotation.Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://localhost:8080}")
    private String allowedOrigins;

    @Bean
    public org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource() {
        org.springframework.web.cors.CorsConfiguration configuration = new org.springframework.web.cors.CorsConfiguration();
        java.util.List<String> origins = java.util.Arrays.asList(allowedOrigins.split(","));
        configuration.setAllowedOriginPatterns(origins);
        configuration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "Cache-Control", "X-Requested-With", "Accept", "Origin"));
        configuration.setExposedHeaders(java.util.List.of("Authorization", "Content-Disposition", "Set-Cookie"));
        configuration.setAllowCredentials(true);
        org.springframework.web.cors.UrlBasedCorsConfigurationSource source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.fromHierarchy(
            "ROLE_SUPER_ADMIN > ROLE_SUPPORT\n" +
            "ROLE_SUPER_ADMIN > ROLE_OWNER\n" +
            "ROLE_OWNER > ROLE_ADMIN\n" +
            "ROLE_ADMIN > ROLE_PROPERTY_MANAGER\n" +
            "ROLE_PROPERTY_MANAGER > ROLE_RECEPTIONIST\n" +
            "ROLE_RECEPTIONIST > ROLE_ACCOUNTANT\n" +
            "ROLE_ACCOUNTANT > ROLE_SECURITY_GUARD\n" +
            "ROLE_SECURITY_GUARD > ROLE_STAFF"
        );
    }

    @Autowired
    private SubscriptionLockoutFilter subscriptionLockoutFilter;

    @Autowired
    private ApiMetricsFilter apiMetricsFilter;

    @Autowired
    private SecurityRateLimitFilter securityRateLimitFilter;

    @Autowired
    private IdempotencyFilter idempotencyFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .headers(headers -> headers
                        .frameOptions(frame -> frame.sameOrigin())
                        .xssProtection(xss -> xss.headerValue(org.springframework.security.web.header.writers.XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; " +
                                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com; " +
                                "frame-src 'self' https://api.razorpay.com https://*.razorpay.com; " +
                                "connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://*.sentry.io https://*.sentry-cdn.com https://*.sardine.ai https://*.stripe.network; " +
                                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                                "img-src 'self' data: https:; " +
                                "font-src 'self' data: https://fonts.gstatic.com;"
                        ))
                )
                .exceptionHandling(exception -> exception.authenticationEntryPoint(unauthorizedHandler))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth ->
                        auth.requestMatchers(
                                "/api/v1/auth/**",
                                "/api/v1/public/**",
                                "/api/v1/saas/**",
                                "/api/v1/branding/**",
                                "/api/v1/webhooks/**",
                                "/api/v1/super-admin/user-tracking/telemetry",
                                "/api/v1/telemetry",
                                "/ws-stayeaze/**",
                                "/uploads/**",
                                "/error",
                                "/actuator/health/**",
                                "/actuator/prometheus"
                        ).permitAll()
                        .requestMatchers("/actuator/**").hasRole("SUPER_ADMIN")
                        .anyRequest().authenticated()
                );

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(securityRateLimitFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(idempotencyFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(apiMetricsFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);
        http.addFilterAfter(subscriptionLockoutFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> shallowEtagHeaderFilter() {
        ShallowEtagHeaderFilter etagFilter = new ShallowEtagHeaderFilter() {
            @Override
            protected boolean shouldNotFilter(jakarta.servlet.http.HttpServletRequest request) {
                String path = request.getRequestURI();
                return path != null && (path.endsWith("/stream") || path.contains("/stream") || path.contains("/ws-"));
            }
        };
        FilterRegistrationBean<ShallowEtagHeaderFilter> filterRegistrationBean = new FilterRegistrationBean<>(etagFilter);
        filterRegistrationBean.addUrlPatterns("/api/v1/*");
        return filterRegistrationBean;
    }
}
