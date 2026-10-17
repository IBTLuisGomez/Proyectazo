package com.proyectazo.repository;

import com.proyectazo.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, String> {
    List<Task> findByProject_Id(String projectId);
    List<Task> findByProject_IdAndColumn(String projectId, String column);
    long countByProject_IdAndColumn(String projectId, String column);
}
