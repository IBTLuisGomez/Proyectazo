package com.proyectazo.service;

import com.proyectazo.model.SessionLog;
import com.proyectazo.repository.SessionLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SessionLogService {

    private final SessionLogRepository sessionLogRepository;

    public SessionLogService(SessionLogRepository sessionLogRepository) {
        this.sessionLogRepository = sessionLogRepository;
    }

    public List<SessionLog> getLogs(String projectId, String query) {
        if (query != null && !query.isBlank()) {
            return sessionLogRepository.searchLogs(query.trim());
        }
        if (projectId != null && !projectId.isBlank()) {
            return sessionLogRepository.findByProject_IdOrderByDateDesc(projectId);
        }
        return sessionLogRepository.findAllByOrderByDateDesc();
    }
}
