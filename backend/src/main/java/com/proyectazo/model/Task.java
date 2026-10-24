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
    private String column = "buzon"; // buzon, proximo, enfoco, esperando, victorias, congelador

    @Column(length = 8)
    private String effort = "S"; // XS, S, M, L

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String originThoughtContent;

    @Column(length = 64)
    private String originThoughtId;

    @Column(columnDefinition = "TEXT")
    private String codeSnippet;

    private Boolean isBureaucratic = false;
    private Boolean isMicroStep = false;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void onPrePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (isBureaucratic == null) isBureaucratic = false;
        if (isMicroStep == null) isMicroStep = false;
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

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getOriginThoughtContent() { return originThoughtContent; }
    public void setOriginThoughtContent(String originThoughtContent) { this.originThoughtContent = originThoughtContent; }

    public String getOriginThoughtId() { return originThoughtId; }
    public void setOriginThoughtId(String originThoughtId) { this.originThoughtId = originThoughtId; }

    public String getCodeSnippet() { return codeSnippet; }
    public void setCodeSnippet(String codeSnippet) { this.codeSnippet = codeSnippet; }

    public Boolean getIsBureaucratic() { return isBureaucratic; }
    public void setIsBureaucratic(Boolean bureaucratic) { isBureaucratic = bureaucratic; }

    public Boolean getIsMicroStep() { return isMicroStep; }
    public void setIsMicroStep(Boolean microStep) { isMicroStep = microStep; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
