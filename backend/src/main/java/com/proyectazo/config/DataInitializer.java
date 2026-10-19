package com.proyectazo.config;

import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer implements CommandLineRunner {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final PensaderoItemRepository pensaderoItemRepository;

    public DataInitializer(ProjectRepository projectRepository, 
                           TaskRepository taskRepository, 
                           PensaderoItemRepository pensaderoItemRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.pensaderoItemRepository = pensaderoItemRepository;
    }

    @Override
    public void run(String... args) {
        // Entorno limpio listo para producción y creación de proyectos reales del usuario (sin seed)
    }
}
