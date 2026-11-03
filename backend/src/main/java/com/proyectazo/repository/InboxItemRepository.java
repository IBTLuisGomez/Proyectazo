package com.proyectazo.repository;

import com.proyectazo.model.InboxItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InboxItemRepository extends JpaRepository<InboxItem, String> {
    List<InboxItem> findAllByOrderByCreatedAtDesc();

    // --- Por dueño ---
    List<InboxItem> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);
    Optional<InboxItem> findByIdAndOwnerId(String id, Long ownerId);
    @Transactional
    long deleteByOwnerId(Long ownerId);

    @Modifying
    @Transactional
    @Query("update InboxItem e set e.ownerId = :owner where e.ownerId is null")
    int assignOrphansTo(@Param("owner") Long owner);
}
