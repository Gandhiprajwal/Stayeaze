package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.Parcel;
import com.stayeaze.backend.models.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ParcelRepository extends JpaRepository<Parcel, UUID> {
    List<Parcel> findByTenant(Tenant tenant);
    Optional<Parcel> findByIdAndTenant(UUID id, Tenant tenant);
}
