package com.proyectazo.service;

import com.proyectazo.dto.CheckoutRequest;
import com.proyectazo.model.Project;
import com.proyectazo.model.SessionLog;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.SessionLogRepository;
import com.proyectazo.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final SessionLogRepository sessionLogRepository;

    public ProjectService(ProjectRepository projectRepository, SessionLogRepository sessionLogRepository) {
        this.projectRepository = projectRepository;
        this.sessionLogRepository = sessionLogRepository;
    }

    public List<Project> getAllProjects(String status) {
        if (status != null && !status.isBlank()) {
            return projectRepository.findByOwnerIdAndStatusOrderByLastActivityDesc(CurrentUser.id(), status);
        }
        return projectRepository.findByOwnerIdOrderByLastActivityDesc(CurrentUser.id());
    }

    public Optional<Project> getProjectById(String id) {
        return projectRepository.findByIdAndOwnerId(id, CurrentUser.id());
    }

    /** Proyecto del usuario actual; uno ajeno se trata como inexistente. */
    public Project requireOwned(String id) {
        return projectRepository.findByIdAndOwnerId(id, CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Proyecto no encontrado: " + id));
    }

    @Transactional
    public Project saveProject(Project project) {
        if (project.getId() == null || project.getId().isBlank()) {
            project.setId("p-" + UUID.randomUUID().toString().substring(0, 8));
        }
        Long owner = CurrentUser.id();
        projectRepository.findById(project.getId()).ifPresent(existing -> {
            // Un id que ya usa otra cuenta no se puede sobrescribir: se crea con un id nuevo
            if (!owner.equals(existing.getOwnerId())) project.setId("p-" + UUID.randomUUID().toString().substring(0, 8));
        });
        project.setOwnerId(owner);
        if (project.getCreatedAt() == null) {
            project.setCreatedAt(LocalDateTime.now());
        }
        if (project.getLastActivity() == null) {
            project.setLastActivity(LocalDateTime.now());
        }
        project.setUpdatedAt(LocalDateTime.now());

        // Associate bidirectional relations if provided
        if (project.getTasks() != null) {
            project.getTasks().forEach(t -> {
                if (t.getId() == null || t.getId().isBlank()) {
                    t.setId("t-" + UUID.randomUUID().toString().substring(0, 8));
                }
                t.setProject(project);
            });
        }
        if (project.getLogs() != null) {
            project.getLogs().forEach(l -> {
                if (l.getId() == null || l.getId().isBlank()) {
                    l.setId("l-" + UUID.randomUUID().toString().substring(0, 8));
                }
                l.setProject(project);
            });
        }

        return projectRepository.save(project);
    }

    @Transactional
    public Project updateProject(String id, Project projectData) {
        Project existing = requireOwned(id);

        if (projectData.getName() != null) existing.setName(projectData.getName());
        if (projectData.getEmoji() != null) existing.setEmoji(projectData.getEmoji());
        if (projectData.getColor() != null) existing.setColor(projectData.getColor());
        if (projectData.getStatus() != null) existing.setStatus(projectData.getStatus());
        if (projectData.getEnergy() != null) existing.setEnergy(projectData.getEnergy());
        if (projectData.getObjective() != null) existing.setObjective(projectData.getObjective());
        if (projectData.getContext() != null) existing.setContext(projectData.getContext());
        if (projectData.getNextAction() != null) existing.setNextAction(projectData.getNextAction());
        if (projectData.getNextActionType() != null) existing.setNextActionType(projectData.getNextActionType());
        if (projectData.getKeywords() != null) existing.setKeywords(projectData.getKeywords());

        existing.setUpdatedAt(LocalDateTime.now());
        return projectRepository.save(existing);
    }

    @Transactional
    public void deleteProject(String id) {
        projectRepository.findByIdAndOwnerId(id, CurrentUser.id()).ifPresent(projectRepository::delete);
    }

    @Transactional
    public Project skipProjectWithoutGuilt(String id) {
        Project project = requireOwned(id);
        project.setLastActivity(LocalDateTime.now());
        project.setUpdatedAt(LocalDateTime.now());
        return projectRepository.save(project);
    }

    @Transactional
    public SessionLog checkoutSession(String projectId, CheckoutRequest request) {
        Project project = requireOwned(projectId);

        SessionLog log = new SessionLog();
        log.setId("log-" + UUID.randomUUID().toString().substring(0, 8));
        log.setProject(project);
        log.setDate(LocalDateTime.now());
        log.setAchievement(request.getAchievement());
        log.setNextStep(request.getNextStep());
        log.setEnergy(request.getEnergy() != null ? request.getEnergy() : "media");
        log.setDuration(request.getDuration() != null ? request.getDuration() : 25);

        // Update project momentum state
        project.setNextAction(request.getNextStep());
        if (request.getNextActionType() != null) {
            project.setNextActionType(request.getNextActionType());
        }
        if (request.getStatus() != null) {
            project.setStatus(request.getStatus());
        }
        if (request.getEnergy() != null) {
            project.setEnergy(request.getEnergy());
        }
        project.setLastActivity(LocalDateTime.now());
        project.setUpdatedAt(LocalDateTime.now());

        projectRepository.save(project);
        return sessionLogRepository.save(log);
    }
}
