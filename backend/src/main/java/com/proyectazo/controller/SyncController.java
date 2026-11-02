package com.proyectazo.controller;

import com.proyectazo.dto.SyncDataDTO;
import com.proyectazo.service.SyncService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    /** Valor que debe llevar la cabecera X-Confirm-Wipe para permitir el borrado total. */
    public static final String WIPE_CONFIRMATION = "BORRAR-TODO";

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @GetMapping
    public ResponseEntity<SyncDataDTO> pull() {
        return ResponseEntity.ok(syncService.pullData());
    }

    @PostMapping
    public ResponseEntity<?> push(@RequestBody SyncDataDTO syncData,
                                  @RequestHeader(value = "X-Confirm-Wipe", required = false) String confirmWipe) {
        if (syncData != null && Boolean.TRUE.equals(syncData.getWipe()) && !WIPE_CONFIRMATION.equals(confirmWipe)) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                    .body(Map.of("error", "El borrado total requiere la cabecera X-Confirm-Wipe: " + WIPE_CONFIRMATION));
        }
        return ResponseEntity.ok(syncService.pushData(syncData));
    }
}
