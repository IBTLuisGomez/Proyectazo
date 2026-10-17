package com.proyectazo.repository;

import com.proyectazo.model.InboxItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InboxItemRepository extends JpaRepository<InboxItem, String> {
    List<InboxItem> findAllByOrderByCreatedAtDesc();
}
