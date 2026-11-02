package com.proyectazo.controller;

import com.proyectazo.dto.CheckoutRequest;
import com.proyectazo.model.Project;
import com.proyectazo.model.SessionLog;
import com.proyectazo.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public ResponseEntity<List<Project>> listProjects(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(projectService.getAllProjects(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Project> getProject(@PathVariable String id) {
        return projectService.getProjectById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Project> createProject(@Valid @RequestBody Project project) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.saveProject(project));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Project> updateProject(@PathVariable String id, @RequestBody Project project) {
        return ResponseEntity.ok(projectService.updateProject(id, project));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(@PathVariable String id) {
        projectService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/skip")
    public ResponseEntity<Project> skipProject(@PathVariable String id) {
        return ResponseEntity.ok(projectService.skipProjectWithoutGuilt(id));
    }

    @PostMapping("/{id}/checkout")
    public ResponseEntity<SessionLog> checkoutSession(@PathVariable String id, @Valid @RequestBody CheckoutRequest request) {
        return ResponseEntity.ok(projectService.checkoutSession(id, request));
    }
}
