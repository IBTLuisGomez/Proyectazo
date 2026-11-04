package com.proyectazo.security;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Frena la adivinación de contraseñas: como máximo 5 intentos fallidos por minuto y por IP. */
@Component
public class LoginRateLimiter {

    static final int MAX_FAILURES = 5;
    static final long WINDOW_MS = 60_000;

    private final Map<String, Deque<Long>> failures = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        Deque<Long> q = failures.get(key);
        if (q == null) return false;
        synchronized (q) {
            prune(q, System.currentTimeMillis());
            return q.size() >= MAX_FAILURES;
        }
    }

    public void recordFailure(String key) {
        Deque<Long> q = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            long now = System.currentTimeMillis();
            prune(q, now);
            q.addLast(now);
        }
        if (failures.size() > 10_000) failures.entrySet().removeIf(e -> {
            synchronized (e.getValue()) { prune(e.getValue(), System.currentTimeMillis()); return e.getValue().isEmpty(); }
        });
    }

    public void reset(String key) {
        failures.remove(key);
    }

    private static void prune(Deque<Long> q, long now) {
        while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) q.pollFirst();
    }
}
