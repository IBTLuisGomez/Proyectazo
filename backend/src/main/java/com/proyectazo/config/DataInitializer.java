package com.proyectazo.config;

import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

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
        if (projectRepository.count() > 0) {
            return; // Data already exists
        }

        // 1. FocusFlow OS
        Project p1 = new Project();
        p1.setId("proj_focusflow");
        p1.setName("FocusFlow OS");
        p1.setEmoji("⚡");
        p1.setColor("#10b981");
        p1.setStatus("activo");
        p1.setEnergy("alta");
        p1.setObjective("Consolidar el sistema operativo personal para TDAH con Nexus Orb 3D, Spring Boot y despliegue Droplet");
        p1.setContext("Arquitectura unificada offline-first con sincronización automática REST, ruido marrón Web Audio y Nexus Orb.");
        p1.setNextAction("Ejecutar suite de pruebas de sincronización y empaquetar contenedor Docker");
        p1.setNextActionType("hacer");
        p1.setLastActivity(LocalDateTime.now());
        projectRepository.save(p1);

        createTask("task_ff_1", p1, "Configurar Dockerfile multi-stage y docker-compose para droplet", "victorias", "M");
        createTask("task_ff_2", p1, "Integrar Nexus Orb con endpoint /api/pensadero", "victorias", "M");
        createTask("task_ff_3", p1, "Verificar sincronización bidireccional frontend-backend", "enfoco", "S");
        createTask("task_ff_4", p1, "Ejecutar y validar despliegue en servidor droplet", "proximo", "M");

        // 2. CytoHelix
        Project p2 = new Project();
        p2.setId("proj_cytohelix");
        p2.setName("CytoHelix");
        p2.setEmoji("🌐");
        p2.setColor("#3b82f6");
        p2.setStatus("activo");
        p2.setEnergy("alta");
        p2.setObjective("Página web moderna y plataforma para desarrollo y consultoría de software de alto impacto");
        p2.setContext("Sitio web corporativo y showcase tecnológico: arquitecturas cloud, microservicios, UI reactivo e IA.");
        p2.setNextAction("Diseñar la sección de servicios y casos de éxito de desarrollo de software en CytoHelix");
        p2.setNextActionType("hacer");
        p2.setLastActivity(LocalDateTime.now().minusHours(2));
        projectRepository.save(p2);

        createTask("task_ch_1", p2, "Redactar propuesta de valor y catálogo de servicios de software", "buzon", "S");
        createTask("task_ch_2", p2, "Implementar animaciones 3D e interactivas en el hero de CytoHelix", "proximo", "M");
        createTask("task_ch_3", p2, "Diseñar sección de servicios y casos de éxito", "enfoco", "M");
        createTask("task_ch_4", p2, "Desplegar versión preliminar en Vercel / Nginx", "victorias", "S");

        // 3. CytoCore
        Project p3 = new Project();
        p3.setId("proj_cytocore");
        p3.setName("CytoCore");
        p3.setEmoji("🔬");
        p3.setColor("#06b6d4");
        p3.setStatus("activo");
        p3.setEnergy("alta");
        p3.setObjective("Programa web y app para laboratorio de células mesenquimales, cultivo celular y manejo de dosis");
        p3.setContext("Control de lotes de cultivo celular, viabilidad celular, pases biológicos, criopreservación y calculadora precisa de dosis terapéuticas.");
        p3.setNextAction("Validar el módulo de cálculo de dosis según peso del paciente y concentración celular");
        p3.setNextActionType("hacer");
        p3.setLastActivity(LocalDateTime.now().minusHours(1));
        projectRepository.save(p3);

        createTask("task_cc_1", p3, "Formulario de registro de donantes y consentimientos biológicos", "buzon", "M");
        createTask("task_cc_2", p3, "Algoritmo de cálculo de dosis celulares por kg de peso", "proximo", "M");
        createTask("task_cc_3", p3, "Módulo de monitoreo de cámaras de cultivo y confluencia", "enfoco", "L");
        createTask("task_cc_4", p3, "Trazabilidad de criopreservación en tanques de nitrógeno", "esperando", "M");
        createTask("task_cc_5", p3, "Arquitectura inicial de base de datos para cultivo mesenquimal", "victorias", "L");

        // 5. El Pensadero inicial (brain dump)
        if (pensaderoItemRepository.count() == 0) {
            PensaderoItem i1 = new PensaderoItem("pens_init_1", "Probar integrar atajos con teclado global (Alt+Espacio) para abrir el Pensadero rápidamente", "chispa");
            i1.setIsPinned(true);
            pensaderoItemRepository.save(i1);

            PensaderoItem i2 = new PensaderoItem("pens_init_2", "¿Deberíamos agregar exportación de bitácora a formato Markdown descargable?", "duda");
            pensaderoItemRepository.save(i2);

            PensaderoItem i3 = new PensaderoItem("pens_init_3", "Ajustar volumen predeterminado del Ruido Marrón al 60% para que sea suave", "micro");
            pensaderoItemRepository.save(i3);
        }
    }

    private void createTask(String id, Project project, String title, String column, String effort) {
        Task task = new Task();
        task.setId(id);
        task.setProject(project);
        task.setTitle(title);
        task.setColumn(column);
        task.setEffort(effort);
        task.setIsMicroStep(false);
        taskRepository.save(task);
    }
}
