package com.proyectazo.repository;

import com.proyectazo.model.PensaderoItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PensaderoItemRepository extends JpaRepository<PensaderoItem, String> {
    List<PensaderoItem> findAllByOrderByIsPinnedDescCreatedAtDesc();
    List<PensaderoItem> findByCategoryOrderByCreatedAtDesc(String category);
}
