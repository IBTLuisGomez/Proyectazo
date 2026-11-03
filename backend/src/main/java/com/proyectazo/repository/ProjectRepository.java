package com.proyectazo.repository;

import com.proyectazo.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, String> {
    List<Project> findByStatusOrderByLastActivityDesc(String status);
    List<Project> findAllByOrderByLastActivityDesc();

    // --- Por dueño ---
    List<Project> findByOwnerIdOrderByLastActivityDesc(Long ownerId);
    List<Project> findByOwnerIdAndStatusOrderByLastActivityDesc(Long ownerId, String status);
    Optional<Project> findByIdAndOwnerId(String id, Long ownerId);
    @Transactional
    long deleteByOwnerId(Long ownerId);

    @Modifying
    @Transactional
    @Query("update Project e set e.ownerId = :owner where e.ownerId is null")
    int assignOrphansTo(@Param("owner") Long owner);
}
