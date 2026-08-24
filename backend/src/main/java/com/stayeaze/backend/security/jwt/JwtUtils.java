package com.stayeaze.backend.security.jwt;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtils {
    private static final Logger logger = LoggerFactory.getLogger(JwtUtils.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private int jwtExpirationMs;

    public String generateJwtToken(Authentication authentication) {
        if (authentication.getPrincipal() instanceof com.stayeaze.backend.security.services.UserDetailsImpl userPrincipal) {
            java.util.List<String> roles = userPrincipal.getAuthorities().stream()
                    .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                    .collect(java.util.stream.Collectors.toList());

            return Jwts.builder()
                    .subject(userPrincipal.getUsername())
                    .claim("userId", userPrincipal.getId() != null ? userPrincipal.getId().toString() : "")
                    .claim("orgId", userPrincipal.getOrgId() != null ? userPrincipal.getOrgId().toString() : "")
                    .claim("roles", roles)
                    .issuedAt(new Date())
                    .expiration(new Date((new Date()).getTime() + jwtExpirationMs))
                    .signWith(key(), Jwts.SIG.HS256)
                    .compact();
        }

        UserDetails userPrincipal = (UserDetails) authentication.getPrincipal();
        return generateTokenFromUsername(userPrincipal.getUsername());
    }

    public String generateTokenFromUsername(String username) {
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(key(), Jwts.SIG.HS256)
                .compact();
    }

    private SecretKey key() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret));
    }

    public String getUserNameFromJwtToken(String token) {
        return Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public String getOrgIdFromJwtToken(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
            return claims.get("orgId", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    public boolean validateJwtToken(String authToken) {
        try {
            Jwts.parser().verifyWith(key()).build().parseSignedClaims(authToken);
            return true;
        } catch (MalformedJwtException e) {
            logger.error("Invalid JWT token: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            logger.error("JWT token is expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            logger.error("JWT token is unsupported: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            logger.error("JWT claims string is empty: {}", e.getMessage());
        } catch (Exception e) {
            logger.error("JWT validation error: {}", e.getMessage());
        }
        return false;
    }

    public Date getExpirationDateFromJwtToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getExpiration();
        } catch (Exception e) {
            return new Date(System.currentTimeMillis() + jwtExpirationMs);
        }
    }

    public org.springframework.http.ResponseCookie generateRefreshTokenCookie(String refreshToken) {
        return org.springframework.http.ResponseCookie.from("stayeaze_refresh_token", refreshToken)
                .path("/")
                .maxAge(30 * 24 * 60 * 60) // 30 days
                .httpOnly(true)
                .secure(false) // false for localhost dev; in production behind HTTPS, set to true
                .sameSite("Lax")
                .build();
    }

    public org.springframework.http.ResponseCookie getCleanRefreshTokenCookie() {
        return org.springframework.http.ResponseCookie.from("stayeaze_refresh_token", "")
                .path("/")
                .maxAge(0)
                .httpOnly(true)
                .sameSite("Lax")
                .build();
    }

    public String getRefreshTokenFromCookies(jakarta.servlet.http.HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
            if ("stayeaze_refresh_token".equals(cookie.getName()) || "refreshToken".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
