package com.proyectazo.controller;

import com.proyectazo.model.InboxItem;
import com.proyectazo.model.Task;
import com.proyectazo.service.InboxService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inbox")
@CrossOrigin(origins = "*")
public class InboxController {

    private final InboxService inboxService;

    public InboxController(InboxService inboxService) {
        this.inboxService = inboxService;
    }

    @GetMapping
    public ResponseEntity<List<InboxItem>> listInbox() {
        return ResponseEntity.ok(inboxService.getAllItems());
    }

    @PostMapping
    public ResponseEntity<InboxItem> createInboxItem(@RequestBody Map<String, String> payload) {
        String text = payload.get("text");
        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(inboxService.addItem(text.trim()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInboxItem(@PathVariable String id) {
        inboxService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/convert-to-task")
    public ResponseEntity<Task> convertToTask(@PathVariable String id, @RequestParam String projectId) {
        return ResponseEntity.ok(inboxService.convertToTask(id, projectId));
    }
}
