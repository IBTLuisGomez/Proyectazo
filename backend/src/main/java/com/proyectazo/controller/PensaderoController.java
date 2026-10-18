package com.proyectazo.controller;

import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.service.PensaderoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pensadero")
@CrossOrigin(origins = "*")
public class PensaderoController {

    private final PensaderoService pensaderoService;

    public PensaderoController(PensaderoService pensaderoService) {
        this.pensaderoService = pensaderoService;
    }

    @GetMapping
    public ResponseEntity<List<PensaderoItem>> listPensadero(@RequestParam(required = false) String category) {
        return ResponseEntity.ok(pensaderoService.getAllItems(category));
    }

    @PostMapping
    public ResponseEntity<PensaderoItem> addPensaderoItem(@RequestBody Map<String, String> payload) {
        String content = payload.get("content");
        String category = payload.get("category");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(pensaderoService.addItem(content.trim(), category));
    }

    @PatchMapping("/{id}/pin")
    public ResponseEntity<PensaderoItem> togglePin(@PathVariable String id) {
        return ResponseEntity.ok(pensaderoService.togglePin(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable String id) {
        pensaderoService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/convert-to-task")
    public ResponseEntity<Task> convertToTask(@PathVariable String id, @RequestParam String projectId) {
        return ResponseEntity.ok(pensaderoService.convertToTask(id, projectId));
    }

    @PostMapping("/{id}/convert-to-project")
    public ResponseEntity<Project> convertToProject(@PathVariable String id, @RequestParam(required = false) String projectName) {
        return ResponseEntity.ok(pensaderoService.convertToProject(id, projectName));
    }
}
