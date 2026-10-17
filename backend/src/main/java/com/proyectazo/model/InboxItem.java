package com.proyectazo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "inbox_items")
public class InboxItem {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    private LocalDateTime createdAt;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public InboxItem() {}

    public InboxItem(String id, String text) {
        this.id = id;
        this.text = text;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
