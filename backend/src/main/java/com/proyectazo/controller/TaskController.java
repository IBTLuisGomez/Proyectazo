package com.proyectazo.controller;

import com.proyectazo.dto.TaskMoveRequest;
import com.proyectazo.model.Task;
import com.proyectazo.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping("/api/projects/{projectId}/tasks")
    public ResponseEntity<List<Task>> listTasksByProject(@PathVariable String projectId) {
        return ResponseEntity.ok(taskService.getTasksByProjectId(projectId));
    }

    @PostMapping("/api/projects/{projectId}/tasks")
    public ResponseEntity<?> createTask(@PathVariable String projectId, @Valid @RequestBody Task task) {
        try {
            Task created = taskService.addTask(projectId, task);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/api/tasks/{taskId}")
    public ResponseEntity<?> updateTask(@PathVariable String taskId, @RequestBody Task task) {
        try {
            Task updated = taskService.updateTask(taskId, task);
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/api/tasks/{taskId}/move")
    public ResponseEntity<?> moveTask(@PathVariable String taskId, @Valid @RequestBody TaskMoveRequest request) {
        try {
            Task moved = taskService.moveTask(taskId, request);
            return ResponseEntity.ok(moved);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/api/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable String taskId) {
        taskService.deleteTask(taskId);
        return ResponseEntity.noContent().build();
    }
}
