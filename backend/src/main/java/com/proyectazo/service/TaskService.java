package com.proyectazo.service;

import com.proyectazo.dto.TaskMoveRequest;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
import com.proyectazo.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;

    public TaskService(TaskRepository taskRepository, ProjectRepository projectRepository) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
    }

    public List<Task> getTasksByProjectId(String projectId) {
        requireOwnedProject(projectId);
        return taskRepository.findByProject_Id(projectId);
    }

    private Project requireOwnedProject(String projectId) {
        return projectRepository.findByIdAndOwnerId(projectId, CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Proyecto no encontrado: " + projectId));
    }

    /** Tarea de un proyecto del usuario actual; una ajena se trata como inexistente. */
    private Task requireOwnedTask(String taskId) {
        Long owner = CurrentUser.id();
        return taskRepository.findById(taskId)
                .filter(t -> t.getProject() != null && owner.equals(t.getProject().getOwnerId()))
                .orElseThrow(() -> new IllegalArgumentException("Tarea no encontrada: " + taskId));
    }

    @Transactional
    public Task addTask(String projectId, Task task) {
        Project project = requireOwnedProject(projectId);

        if (task.getId() == null || task.getId().isBlank()) {
            task.setId("t-" + UUID.randomUUID().toString().substring(0, 8));
        }

        // Strict ADHD WIP Limit: max 3 in 'enfoco'
        if ("enfoco".equalsIgnoreCase(task.getColumn())) {
            long currentEnfoco = taskRepository.countByProject_IdAndColumn(projectId, "enfoco");
            if (currentEnfoco >= 3) {
                throw new IllegalStateException("Límite de Foco TDAH alcanzado: No puedes tener más de 3 tareas en 'En Foco'");
            }
        }

        task.setProject(project);
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Transactional
    public Task updateTask(String taskId, Task taskData) {
        Task task = requireOwnedTask(taskId);

        if (taskData.getTitle() != null && !taskData.getTitle().isBlank()) {
            task.setTitle(taskData.getTitle().trim());
        }
        if (taskData.getColumn() != null && !taskData.getColumn().isBlank()) {
            String targetCol = taskData.getColumn().toLowerCase();
            if ("enfoco".equals(targetCol) && !targetCol.equals(task.getColumn())) {
                long currentEnfoco = taskRepository.countByProject_IdAndColumn(task.getProject().getId(), "enfoco");
                if (currentEnfoco >= 3) {
                    throw new IllegalStateException("Límite de Foco TDAH alcanzado: No puedes tener más de 3 tareas en 'En Foco'");
                }
            }
            task.setColumn(targetCol);
        }
        if (taskData.getEffort() != null) task.setEffort(taskData.getEffort());
        if (taskData.getNotes() != null) task.setNotes(taskData.getNotes());
        if (taskData.getCodeSnippet() != null) task.setCodeSnippet(taskData.getCodeSnippet());
        if (taskData.getIsBureaucratic() != null) task.setIsBureaucratic(taskData.getIsBureaucratic());
        if (taskData.getIsMicroStep() != null) task.setIsMicroStep(taskData.getIsMicroStep());
        if (taskData.getDueAt() != null) task.setDueAt(taskData.getDueAt());

        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Transactional
    public Task moveTask(String taskId, TaskMoveRequest request) {
        Task task = requireOwnedTask(taskId);

        String targetColumn = request.getColumn().toLowerCase();

        // If moving into 'enfoco', enforce max 3 limit
        if ("enfoco".equals(targetColumn) && !targetColumn.equals(task.getColumn())) {
            long currentEnfoco = taskRepository.countByProject_IdAndColumn(task.getProject().getId(), "enfoco");
            if (currentEnfoco >= 3) {
                throw new IllegalStateException("Límite de Foco TDAH alcanzado: No puedes tener más de 3 tareas en 'En Foco'");
            }
        }

        task.setColumn(targetColumn);
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Transactional
    public void deleteTask(String taskId) {
        Long owner = CurrentUser.id();
        taskRepository.findById(taskId)
                .filter(t -> t.getProject() != null && owner.equals(t.getProject().getOwnerId()))
                .ifPresent(taskRepository::delete);
    }
}
