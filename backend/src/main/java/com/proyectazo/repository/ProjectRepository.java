package com.proyectazo.repository;

import com.proyectazo.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, String> {
    List<Project> findByStatusOrderByLastActivityDesc(String status);
    List<Project> findAllByOrderByLastActivityDesc();
}
