package com.proyectazo.security;

import com.proyectazo.model.AppUser;
import com.proyectazo.model.AuthToken;
import com.proyectazo.repository.AppUserRepository;
import com.proyectazo.repository.AuthTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    public static final int MIN_PASSWORD_LENGTH = 8;

    private final AppUserRepository userRepository;
    private final AuthTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(AppUserRepository userRepository,
                       AuthTokenRepository tokenRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public record IssuedToken(String token, LocalDateTime expiresAt, String username) {}

    /** Crea el usuario administrador inicial si la tabla está vacía. */
    @Transactional
    public void bootstrapAdmin(String username, String password) {
        if (userRepository.count() > 0) return;
        String user = (username == null || username.isBlank()) ? "admin" : username.trim();
        String pass = password;
        boolean generated = false;
        if (pass == null || pass.length() < MIN_PASSWORD_LENGTH) {
            pass = randomString(12);
            generated = true;
        }
        userRepository.save(new AppUser(user, passwordEncoder.encode(pass)));
        if (generated) {
            log.warn("==========================================================");
            log.warn(" Usuario inicial creado: '{}'  contraseña temporal: {}", user, pass);
            log.warn(" Cámbiala desde Ajustes o define NEXUS_ADMIN_PASSWORD.");
            log.warn("==========================================================");
        } else {
            log.info("Usuario inicial '{}' creado desde NEXUS_ADMIN_PASSWORD.", user);
        }
    }

    @Transactional
    public Optional<IssuedToken> login(String username, String password, boolean remember) {
        if (username == null || password == null) return Optional.empty();
        Optional<AppUser> user = userRepository.findByUsername(username.trim());
        if (user.isEmpty() || !passwordEncoder.matches(password, user.get().getPasswordHash())) {
            return Optional.empty();
        }
        tokenRepository.deleteExpired(LocalDateTime.now());
        return Optional.of(issueToken(user.get(), remember ? 30 : 7));
    }

    private IssuedToken issueToken(AppUser user, int days) {
        String raw = randomString(32);
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(days);
        tokenRepository.save(new AuthToken(sha256(raw), user.getId(), expiresAt));
        return new IssuedToken(raw, expiresAt, user.getUsername());
    }

    public Optional<AppUser> resolve(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        return tokenRepository.findById(sha256(rawToken))
                .filter(t -> t.getExpiresAt().isAfter(LocalDateTime.now()))
                .flatMap(t -> userRepository.findById(t.getUserId()));
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken != null) tokenRepository.deleteById(sha256(rawToken));
    }

    /** Cambia usuario y/o contraseña. Revoca todas las sesiones y emite un token nuevo. */
    @Transactional
    public IssuedToken changeCredentials(AppUser user, String currentPassword, String newUsername, String newPassword) {
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("La contraseña actual no coincide.");
        }
        if (newUsername != null && !newUsername.isBlank()) {
            String trimmed = newUsername.trim();
            if (trimmed.length() < 2) throw new IllegalArgumentException("El usuario debe tener al menos 2 caracteres.");
            Optional<AppUser> existing = userRepository.findByUsername(trimmed);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                throw new IllegalArgumentException("Ese nombre de usuario ya existe.");
            }
            user.setUsername(trimmed);
        }
        if (newPassword != null && !newPassword.isEmpty()) {
            if (newPassword.length() < MIN_PASSWORD_LENGTH) {
                throw new IllegalArgumentException("La nueva contraseña debe tener al menos " + MIN_PASSWORD_LENGTH + " caracteres.");
            }
            user.setPasswordHash(passwordEncoder.encode(newPassword));
        }
        userRepository.save(user);
        tokenRepository.deleteAllByUserId(user.getId());
        return issueToken(user, 30);
    }

    private static String randomString(int bytes) {
        byte[] buf = new byte[bytes];
        RANDOM.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
