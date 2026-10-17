package com.proyectazo.controller;

import com.proyectazo.model.SessionLog;
import com.proyectazo.service.SessionLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
@CrossOrigin(origins = "*")
public class SessionLogController {

    private final SessionLogService sessionLogService;

    public SessionLogController(SessionLogService sessionLogService) {
        this.sessionLogService = sessionLogService;
    }

    @GetMapping
    public ResponseEntity<List<SessionLog>> getLogs(
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String query) {
        return ResponseEntity.ok(sessionLogService.getLogs(projectId, query));
    }
}
