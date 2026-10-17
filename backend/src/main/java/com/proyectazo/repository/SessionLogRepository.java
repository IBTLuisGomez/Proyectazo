package com.proyectazo.repository;

import com.proyectazo.model.SessionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionLogRepository extends JpaRepository<SessionLog, String> {
    List<SessionLog> findByProject_IdOrderByDateDesc(String projectId);
    List<SessionLog> findAllByOrderByDateDesc();

    @Query("SELECT l FROM SessionLog l WHERE LOWER(l.achievement) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(l.nextStep) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY l.date DESC")
    List<SessionLog> searchLogs(@Param("query") String query);
}
