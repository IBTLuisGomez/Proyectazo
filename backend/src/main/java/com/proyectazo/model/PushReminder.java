package com.proyectazo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Recordatorio que el servidor envía por Web Push cuando llega su hora, aunque la app esté cerrada. */
@Entity
@Table(name = "push_reminders")
public class PushReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Column(length = 64)
    private String taskId;

    @Column(nullable = false)
    private LocalDateTime sendAt;

    private LocalDateTime sentAt;

    private LocalDateTime createdAt;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public PushReminder() {}

    public PushReminder(Long userId, String title, String body, String taskId, LocalDateTime sendAt) {
        this.userId = userId;
        this.title = title;
        this.body = body;
        this.taskId = taskId;
        this.sendAt = sendAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getTaskId() { return taskId; }
    public LocalDateTime getSendAt() { return sendAt; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
