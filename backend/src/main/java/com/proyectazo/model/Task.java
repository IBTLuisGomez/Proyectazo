package com.proyectazo.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @Column(length = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonBackReference("project-tasks")
    private Project project;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(name = "column_key", length = 32, nullable = false)
    private String column = "buzon"; // buzon, proximo, enfoco, esperando, victorias

    @Column(length = 8)
    private String effort = "S"; // S, M, L

    private Boolean isMicroStep = false;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void onPrePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    public void onPreUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Task() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    @JsonProperty("projectId")
    public String getProjectId() {
        return project != null ? project.getId() : null;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getColumn() { return column; }
    public void setColumn(String column) { this.column = column; }

    public String getEffort() { return effort; }
    public void setEffort(String effort) { this.effort = effort; }

    public Boolean getIsMicroStep() { return isMicroStep; }
    public void setIsMicroStep(Boolean microStep) { isMicroStep = microStep; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
