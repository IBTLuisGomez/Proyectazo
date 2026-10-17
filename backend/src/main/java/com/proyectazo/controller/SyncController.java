package com.proyectazo.controller;

import com.proyectazo.dto.SyncDataDTO;
import com.proyectazo.service.SyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sync")
@CrossOrigin(origins = "*")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @GetMapping
    public ResponseEntity<SyncDataDTO> pull() {
        return ResponseEntity.ok(syncService.pullData());
    }

    @PostMapping
    public ResponseEntity<SyncDataDTO> push(@RequestBody SyncDataDTO syncData) {
        return ResponseEntity.ok(syncService.pushData(syncData));
    }
}
