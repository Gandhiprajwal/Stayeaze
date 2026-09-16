package com.stayeaze.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "lost_and_found_items")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class LostAndFoundItem {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    @JsonIgnore
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    @JsonIgnore
    private Property property;

    @Column(name = "item_name", nullable = false)
    private String itemName;

    @Column(name = "category", nullable = false)
    private String category = "ELECTRONICS"; // ELECTRONICS, KEYS, WALLET, CLOTHING, OTHER

    @Column(name = "found_location", nullable = false)
    private String foundLocation;

    @Column(name = "found_date", nullable = false)
    private LocalDate foundDate = LocalDate.now();

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(name = "found_by_name")
    private String foundByName;

    @Column(name = "storage_rack")
    private String storageRack = "Front Desk Cabinet";

    @Column(name = "status", nullable = false)
    private String status = "UNCLAIMED"; // UNCLAIMED, CLAIMED, DISPOSED

    @Column(name = "claimed_by_name")
    private String claimedByName;

    @Column(name = "claimed_by_phone")
    private String claimedByPhone;

    @Column(name = "claimed_at")
    private OffsetDateTime claimedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public LostAndFoundItem() {}

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getFoundLocation() { return foundLocation; }
    public void setFoundLocation(String foundLocation) { this.foundLocation = foundLocation; }

    public LocalDate getFoundDate() { return foundDate; }
    public void setFoundDate(LocalDate foundDate) { this.foundDate = foundDate; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getFoundByName() { return foundByName; }
    public void setFoundByName(String foundByName) { this.foundByName = foundByName; }

    public String getStorageRack() { return storageRack; }
    public void setStorageRack(String storageRack) { this.storageRack = storageRack; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getClaimedByName() { return claimedByName; }
    public void setClaimedByName(String claimedByName) { this.claimedByName = claimedByName; }

    public String getClaimedByPhone() { return claimedByPhone; }
    public void setClaimedByPhone(String claimedByPhone) { this.claimedByPhone = claimedByPhone; }

    public OffsetDateTime getClaimedAt() { return claimedAt; }
    public void setClaimedAt(OffsetDateTime claimedAt) { this.claimedAt = claimedAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public UUID getPropertyId() { return property != null ? property.getId() : null; }
}
