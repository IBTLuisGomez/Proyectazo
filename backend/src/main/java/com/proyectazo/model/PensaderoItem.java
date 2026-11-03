package com.proyectazo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pensadero_items")
public class PensaderoItem {

    @Id
    @Column(length = 64)
    private String id;

    /** Dueño (AppUser.id). Lo asigna el servidor; no se expone ni se acepta desde el cliente. */
    @JsonIgnore
    @Column(name = "owner_id")
    private Long ownerId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(length = 32)
    private String category = "humo_general";

    @Column(length = 16)
    private String cognitiveWeight = "medio"; // ligero, medio, pesado, fuego

    @Column(length = 128)
    private String contactName;

    @Column(length = 32)
    private String amount;

    private Boolean isPinned = false;
    private Boolean isResolved = false;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void onPrePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (category == null) category = "humo_general";
        if (cognitiveWeight == null) cognitiveWeight = "medio";
        if (isPinned == null) isPinned = false;
        if (isResolved == null) isResolved = false;
    }

    @PreUpdate
    public void onPreUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public PensaderoItem() {}

    public PensaderoItem(String id, String content, String category) {
        this.id = id;
        this.content = content;
        this.category = category;
        this.cognitiveWeight = "medio";
        this.isPinned = false;
        this.isResolved = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getCognitiveWeight() { return cognitiveWeight; }
    public void setCognitiveWeight(String cognitiveWeight) { this.cognitiveWeight = cognitiveWeight; }

    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }

    public String getAmount() { return amount; }
    public void setAmount(String amount) { this.amount = amount; }

    public Boolean getIsPinned() { return isPinned; }
    public void setIsPinned(Boolean pinned) { isPinned = pinned; }

    public Boolean getIsResolved() { return isResolved; }
    public void setIsResolved(Boolean resolved) { isResolved = resolved; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
}
