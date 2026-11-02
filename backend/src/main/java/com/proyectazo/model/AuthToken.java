package com.proyectazo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Token de sesión opaco. Solo se guarda su hash SHA-256, nunca el valor en claro. */
@Entity
@Table(name = "auth_tokens")
public class AuthToken {

    @Id
    @Column(length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime createdAt;

    @PrePersist
    public void onPrePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public AuthToken() {}

    public AuthToken(String tokenHash, Long userId, LocalDateTime expiresAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.expiresAt = expiresAt;
    }

    public String getTokenHash() { return tokenHash; }
    public Long getUserId() { return userId; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
