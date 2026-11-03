package com.proyectazo.security;

import com.proyectazo.repository.AppUserRepository;
import com.proyectazo.repository.InboxItemRepository;
import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Los datos creados antes de separar por usuario no tienen dueño: se asignan al primer usuario
 * (el administrador inicial). Se ejecuta después de crear ese usuario.
 */
@Component
@Order(2)
public class OwnershipMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(OwnershipMigration.class);

    private final AppUserRepository users;
    private final ProjectRepository projects;
    private final PensaderoItemRepository pensadero;
    private final InboxItemRepository inbox;

    public OwnershipMigration(AppUserRepository users, ProjectRepository projects,
                              PensaderoItemRepository pensadero, InboxItemRepository inbox) {
        this.users = users;
        this.projects = projects;
        this.pensadero = pensadero;
        this.inbox = inbox;
    }

    @Override
    @Transactional
    public void run(String... args) {
        users.findFirstByOrderByIdAsc().ifPresent(owner -> {
            int moved = projects.assignOrphansTo(owner.getId())
                    + pensadero.assignOrphansTo(owner.getId())
                    + inbox.assignOrphansTo(owner.getId());
            if (moved > 0) log.info("{} registros sin dueño asignados a '{}'", moved, owner.getUsername());
        });
    }
}
