package com.proyectazo.repository;

import com.proyectazo.model.PensaderoItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PensaderoItemRepository extends JpaRepository<PensaderoItem, String> {
    List<PensaderoItem> findAllByOrderByIsPinnedDescCreatedAtDesc();
    List<PensaderoItem> findByCategoryOrderByCreatedAtDesc(String category);

    // --- Por dueño ---
    List<PensaderoItem> findByOwnerIdOrderByIsPinnedDescCreatedAtDesc(Long ownerId);
    List<PensaderoItem> findByOwnerIdAndCategoryOrderByCreatedAtDesc(Long ownerId, String category);
    Optional<PensaderoItem> findByIdAndOwnerId(String id, Long ownerId);
    @Transactional
    long deleteByOwnerId(Long ownerId);

    @Modifying
    @Transactional
    @Query("update PensaderoItem e set e.ownerId = :owner where e.ownerId is null")
    int assignOrphansTo(@Param("owner") Long owner);
}
