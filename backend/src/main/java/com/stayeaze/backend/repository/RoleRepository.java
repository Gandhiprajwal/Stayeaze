package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.ERole;
import com.stayeaze.backend.models.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByName(String name);

    default Optional<Role> findByName(ERole name) {
        if (name == null) return Optional.empty();
        Optional<Role> r = findByName(name.name());
        if (r.isPresent()) return r;
        return findByName("ROLE_" + name.name());
    }
}
