package com.proyectazo.service;

import com.proyectazo.dto.TaskMoveRequest;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
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
        return taskRepository.findByProject_Id(projectId);
    }

    @Transactional
    public Task addTask(String projectId, Task task) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Proyecto no encontrado: " + projectId));

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
    public Task moveTask(String taskId, TaskMoveRequest request) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Tarea no encontrada: " + taskId));

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
        taskRepository.deleteById(taskId);
    }
}
