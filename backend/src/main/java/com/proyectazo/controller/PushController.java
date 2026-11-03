package com.proyectazo.controller;

import com.proyectazo.model.AppUser;
import com.proyectazo.model.PushReminder;
import com.proyectazo.push.PushNotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushNotificationService pushService;

    public PushController(PushNotificationService pushService) {
        this.pushService = pushService;
    }

    public record Keys(String p256dh, String auth) {}
    public record SubscribeRequest(String endpoint, Keys keys) {}
    public record UnsubscribeRequest(String endpoint) {}
    public record ReminderRequest(String title, String body, String taskId, Long sendAt) {}

    @GetMapping("/public-key")
    public ResponseEntity<?> publicKey(@AuthenticationPrincipal AppUser user) {
        if (!pushService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "Web Push no está disponible en el servidor."));
        }
        return ResponseEntity.ok(Map.of("publicKey", pushService.getPublicKey(), "devices", pushService.countSubscriptions(user)));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@AuthenticationPrincipal AppUser user, @RequestBody SubscribeRequest req) {
        try {
            Keys keys = req.keys() == null ? new Keys(null, null) : req.keys();
            pushService.subscribe(user, req.endpoint(), keys.p256dh(), keys.auth());
            return ResponseEntity.ok(Map.of("devices", pushService.countSubscriptions(user)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(@AuthenticationPrincipal AppUser user, @RequestBody UnsubscribeRequest req) {
        pushService.unsubscribe(user, req.endpoint());
        return ResponseEntity.ok(Map.of("devices", pushService.countSubscriptions(user)));
    }

    @PostMapping("/test")
    public Map<String, Object> test(@AuthenticationPrincipal AppUser user) {
        int delivered = pushService.sendToUser(user.getId(), "🔔 Nexus Orb", "Los avisos con la app cerrada funcionan en este dispositivo.", "./index.html");
        return Map.of("delivered", delivered);
    }

    @PostMapping("/reminders")
    public ResponseEntity<?> schedule(@AuthenticationPrincipal AppUser user, @RequestBody ReminderRequest req) {
        if (req.sendAt() == null) return ResponseEntity.badRequest().body(Map.of("error", "Falta la fecha del recordatorio."));
        try {
            PushReminder r = pushService.schedule(user, req.title(), req.body(), req.taskId(), req.sendAt());
            return ResponseEntity.status(HttpStatus.CREATED).body(toBody(r));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/reminders")
    public List<Map<String, Object>> pending(@AuthenticationPrincipal AppUser user) {
        return pushService.pendingFor(user).stream().map(PushController::toBody).toList();
    }

    @DeleteMapping("/reminders/{id}")
    public ResponseEntity<Void> cancel(@AuthenticationPrincipal AppUser user, @PathVariable Long id) {
        return pushService.cancel(user, id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    private static Map<String, Object> toBody(PushReminder r) {
        return Map.of(
                "id", r.getId(),
                "title", r.getTitle(),
                "taskId", r.getTaskId() == null ? "" : r.getTaskId(),
                "sendAt", r.getSendAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
    }
}
