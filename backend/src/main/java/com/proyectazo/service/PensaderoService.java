package com.proyectazo.service;

import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PensaderoService {

    private final PensaderoItemRepository pensaderoItemRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final ProjectService projectService;

    public PensaderoService(PensaderoItemRepository pensaderoItemRepository,
                            ProjectRepository projectRepository,
                            TaskRepository taskRepository,
                            ProjectService projectService) {
        this.pensaderoItemRepository = pensaderoItemRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.projectService = projectService;
    }

    public List<PensaderoItem> getAllItems(String category) {
        if (category != null && !category.isBlank()) {
            return pensaderoItemRepository.findByCategoryOrderByCreatedAtDesc(category);
        }
        return pensaderoItemRepository.findAllByOrderByIsPinnedDescCreatedAtDesc();
    }

    @Transactional
    public PensaderoItem addItem(String content, String category) {
        PensaderoItem item = new PensaderoItem();
        item.setId("pen-" + UUID.randomUUID().toString().substring(0, 8));
        item.setContent(content);
        item.setCategory(category != null ? category : "chispa");
        item.setIsPinned(false);
        item.setCreatedAt(LocalDateTime.now());
        return pensaderoItemRepository.save(item);
    }

    @Transactional
    public PensaderoItem togglePin(String id) {
        PensaderoItem item = pensaderoItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pensamiento no encontrado: " + id));
        item.setIsPinned(!Boolean.TRUE.equals(item.getIsPinned()));
        return pensaderoItemRepository.save(item);
    }

    @Transactional
    public void deleteItem(String id) {
        pensaderoItemRepository.deleteById(id);
    }

    @Transactional
    public Task convertToTask(String id, String projectId) {
        PensaderoItem item = pensaderoItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pensamiento no encontrado: " + id));

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Proyecto no encontrado: " + projectId));

        Task task = new Task();
        task.setId("t-" + UUID.randomUUID().toString().substring(0, 8));
        task.setProject(project);
        task.setTitle(item.getContent());
        task.setColumn("buzon");
        task.setEffort("S");
        task.setCreatedAt(LocalDateTime.now());

        Task saved = taskRepository.save(task);
        pensaderoItemRepository.deleteById(id);
        return saved;
    }

    @Transactional
    public Project convertToProject(String id, String projectName) {
        PensaderoItem item = pensaderoItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pensamiento no encontrado: " + id));

        Project project = new Project();
        project.setId("p-" + UUID.randomUUID().toString().substring(0, 8));
        project.setName(projectName != null && !projectName.isBlank() ? projectName : item.getContent().substring(0, Math.min(30, item.getContent().length())));
        project.setEmoji("💡");
        project.setColor("#10b981");
        project.setStatus("activo");
        project.setEnergy("media");
        project.setObjective(item.getContent());
        project.setNextAction("Definir primera micro-acción");
        project.setNextActionType("hacer");
        project.setCreatedAt(LocalDateTime.now());
        project.setLastActivity(LocalDateTime.now());

        Project saved = projectService.saveProject(project);
        pensaderoItemRepository.deleteById(id);
        return saved;
    }
}
