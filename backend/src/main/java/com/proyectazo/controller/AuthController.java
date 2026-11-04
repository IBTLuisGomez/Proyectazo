package com.proyectazo.controller;

import com.proyectazo.model.AppUser;
import com.proyectazo.security.AuthService;
import com.proyectazo.security.LoginRateLimiter;
import com.proyectazo.security.TokenAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneId;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    private final LoginRateLimiter rateLimiter;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    public record LoginRequest(String username, String password, Boolean remember) {}
    public record ChangeCredentialsRequest(String currentPassword, String newUsername, String newPassword) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletRequest request) {
        // getRemoteAddr ya respeta X-Forwarded-For de nginx (forward-headers-strategy: framework)
        String ip = request.getRemoteAddr();
        if (rateLimiter.isBlocked(ip)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "60")
                    .body(Map.of("error", "Demasiados intentos. Espera un minuto y vuelve a probar."));
        }
        return authService.login(req.username(), req.password(), !Boolean.FALSE.equals(req.remember()))
                .<ResponseEntity<?>>map(t -> { rateLimiter.reset(ip); return ResponseEntity.ok(toBody(t)); })
                .orElseGet(() -> {
                    rateLimiter.recordFailure(ip);
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("error", "Usuario o contraseña incorrectos."));
                });
    }

    /** También lo usa nginx (auth_request) para proteger el microservicio Nexus. */
    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal AppUser user) {
        return Map.of("username", user.getUsername());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(TokenAuthFilter.extractToken(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/credentials")
    public ResponseEntity<?> changeCredentials(@AuthenticationPrincipal AppUser user,
                                               @RequestBody ChangeCredentialsRequest req) {
        try {
            var issued = authService.changeCredentials(user, req.currentPassword(), req.newUsername(), req.newPassword());
            return ResponseEntity.ok(toBody(issued));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private static Map<String, Object> toBody(AuthService.IssuedToken t) {
        return Map.of(
                "token", t.token(),
                "username", t.username(),
                "expiresAt", t.expiresAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
    }
}
