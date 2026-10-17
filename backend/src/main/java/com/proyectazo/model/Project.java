package com.proyectazo.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(length = 16)
    private String emoji = "⚡";

    @Column(length = 32)
    private String color = "#10b981";

    @Column(length = 32, nullable = false)
    private String status = "activo"; // activo, pausado, idea, completado

    @Column(length = 32)
    private String energy = "media"; // baja, media, alta

    @Column(columnDefinition = "TEXT")
    private String objective;

    @Column(columnDefinition = "TEXT")
    private String context;

    @Column(columnDefinition = "TEXT")
    private String nextAction;

    @Column(length = 32)
    private String nextActionType = "hacer"; // hacer, esperar, decidir, explorar

    private LocalDateTime lastActivity;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonManagedReference("project-tasks")
    @OrderBy("createdAt ASC")
    private List<Task> tasks = new ArrayList<>();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonManagedReference("project-logs")
    @OrderBy("date DESC")
    private List<SessionLog> logs = new ArrayList<>();

    @PrePersist
    public void onPrePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (lastActivity == null) lastActivity = now;
    }

    @PreUpdate
    public void onPreUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Project() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getEnergy() { return energy; }
    public void setEnergy(String energy) { this.energy = energy; }

    public String getObjective() { return objective; }
    public void setObjective(String objective) { this.objective = objective; }

    public String getContext() { return context; }
    public void setContext(String context) { this.context = context; }

    public String getNextAction() { return nextAction; }
    public void setNextAction(String nextAction) { this.nextAction = nextAction; }

    public String getNextActionType() { return nextActionType; }
    public void setNextActionType(String nextActionType) { this.nextActionType = nextActionType; }

    public LocalDateTime getLastActivity() { return lastActivity; }
    public void setLastActivity(LocalDateTime lastActivity) { this.lastActivity = lastActivity; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<Task> getTasks() { return tasks; }
    public void setTasks(List<Task> tasks) { this.tasks = tasks; }

    public List<SessionLog> getLogs() { return logs; }
    public void setLogs(List<SessionLog> logs) { this.logs = logs; }
}
