package com.proyectazo.repository;

import com.proyectazo.model.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Repository
public interface AuthTokenRepository extends JpaRepository<AuthToken, String> {

    @Modifying
    @Transactional
    @Query("delete from AuthToken t where t.expiresAt < :now")
    int deleteExpired(@Param("now") LocalDateTime now);

    @Modifying
    @Transactional
    @Query("delete from AuthToken t where t.userId = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);
}
