package com.stayeaze.backend.security.services;

import com.stayeaze.backend.models.User;
import com.stayeaze.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {
    @Autowired
    UserRepository userRepository;

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User Not Found with email: " + username));

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new UsernameNotFoundException("User account is " + user.getStatus() + " and cannot be accessed.");
        }

        List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> {
                    String roleName = role.getName();
                    if (!roleName.startsWith("ROLE_")) {
                        roleName = "ROLE_" + roleName;
                    }
                    return new SimpleGrantedAuthority(roleName.toUpperCase());
                })
                .collect(Collectors.toList());

        return new UserDetailsImpl(
                user.getId(),
                user.getOrganization() != null ? user.getOrganization().getId() : null,
                user.getEmail(),
                user.getPassword(),
                authorities);
    }
}
