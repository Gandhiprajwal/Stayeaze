package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);
    Optional<User> findByMobile(String mobile);
    Optional<User> findFirstByMobile(String mobile);
    Boolean existsByEmail(String email);
    Boolean existsByMobile(String mobile);

    @Query("SELECT u FROM User u WHERE u.organization.id = :orgId")
    List<User> findByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT u FROM User u WHERE u.organization.id = :orgId")
    Page<User> findByOrganizationId(@Param("orgId") UUID orgId, Pageable pageable);

    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.roles WHERE u.organization.id IN (:orgIds)")
    List<User> findByOrganizationIdIn(@Param("orgIds") List<UUID> orgIds);

    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.roles LEFT JOIN FETCH u.organization")
    List<User> findAllWithRoles();

    @Query("SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.roles LEFT JOIN FETCH u.organization WHERE u.organization.id = :orgId")
    List<User> findByOrganizationIdWithRoles(@Param("orgId") UUID orgId);

    @Query("SELECT r.id, COUNT(u.id) FROM User u JOIN u.roles r GROUP BY r.id")
    List<Object[]> countUsersPerRole();
}
