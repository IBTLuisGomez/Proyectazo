package com.proyectazo.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_logs")
public class SessionLog {

    @Id
    @Column(length = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonBackReference("project-logs")
    private Project project;

    private LocalDateTime date;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String achievement;

    @Column(columnDefinition = "TEXT")
    private String nextStep;

    @Column(length = 32)
    private String energy = "media";

    private Integer duration = 25;

    @PrePersist
    public void onPrePersist() {
        if (date == null) date = LocalDateTime.now();
    }

    public SessionLog() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    @JsonProperty("projectId")
    public String getProjectId() {
        return project != null ? project.getId() : null;
    }

    @JsonProperty("projectName")
    public String getProjectName() {
        return project != null ? project.getName() : null;
    }

    @JsonProperty("projectEmoji")
    public String getProjectEmoji() {
        return project != null ? project.getEmoji() : null;
    }

    @JsonProperty("projectColor")
    public String getProjectColor() {
        return project != null ? project.getColor() : null;
    }

    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }

    public String getAchievement() { return achievement; }
    public void setAchievement(String achievement) { this.achievement = achievement; }

    public String getNextStep() { return nextStep; }
    public void setNextStep(String nextStep) { this.nextStep = nextStep; }

    public String getEnergy() { return energy; }
    public void setEnergy(String energy) { this.energy = energy; }

    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }
}
