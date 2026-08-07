package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Boolean existsByEmail(String email);
    Boolean existsByMobile(String mobile);

    @Query("SELECT u FROM User u WHERE u.organization.id = :orgId")
    List<User> findByOrganizationId(@Param("orgId") UUID orgId);
}
