package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.RefreshToken;
import com.stayeaze.backend.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByToken(String token);

    Optional<RefreshToken> findByUser(User user);

    @Modifying
    int deleteByUser(User user);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT t FROM RefreshToken t LEFT JOIN FETCH t.user u LEFT JOIN FETCH u.organization")
    java.util.List<RefreshToken> findAllWithUserAndOrg();
}
