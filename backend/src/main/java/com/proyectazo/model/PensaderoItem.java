package com.proyectazo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pensadero_items")
public class PensaderoItem {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(length = 32)
    private String category = "chispa"; // chispa, tarea, duda, descarga

    private Boolean isPinned = false;
    private LocalDateTime createdAt;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (category == null) category = "chispa";
        if (isPinned == null) isPinned = false;
    }

    public PensaderoItem() {}

    public PensaderoItem(String id, String content, String category) {
        this.id = id;
        this.content = content;
        this.category = category;
        this.isPinned = false;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public Boolean getIsPinned() { return isPinned; }
    public void setIsPinned(Boolean pinned) { isPinned = pinned; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
