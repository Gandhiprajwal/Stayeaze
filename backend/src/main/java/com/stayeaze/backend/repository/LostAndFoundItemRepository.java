package com.stayeaze.backend.repository;

import com.stayeaze.backend.models.LostAndFoundItem;
import com.stayeaze.backend.models.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LostAndFoundItemRepository extends JpaRepository<LostAndFoundItem, UUID> {
    List<LostAndFoundItem> findByOrganizationOrderByCreatedAtDesc(Organization organization);
    
    @Query("SELECT i FROM LostAndFoundItem i WHERE i.organization = :org AND i.property.id = :propId ORDER BY i.createdAt DESC")
    List<LostAndFoundItem> findByOrganizationAndPropertyIdOrderByCreatedAtDesc(@Param("org") Organization organization, @Param("propId") UUID propertyId);
    
    List<LostAndFoundItem> findByOrganizationAndStatus(Organization organization, String status);
}
