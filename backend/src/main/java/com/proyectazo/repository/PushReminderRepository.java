package com.proyectazo.repository;

import com.proyectazo.model.PushReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PushReminderRepository extends JpaRepository<PushReminder, Long> {
    List<PushReminder> findBySentAtIsNullAndSendAtLessThanEqual(LocalDateTime now);

    List<PushReminder> findByUserIdAndSentAtIsNullOrderBySendAtAsc(Long userId);
}
