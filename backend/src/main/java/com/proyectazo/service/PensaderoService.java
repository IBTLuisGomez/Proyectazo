package com.proyectazo.service;

import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
import com.proyectazo.security.CurrentUser;
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
            return pensaderoItemRepository.findByOwnerIdAndCategoryOrderByCreatedAtDesc(CurrentUser.id(), category);
        }
        return pensaderoItemRepository.findByOwnerIdOrderByIsPinnedDescCreatedAtDesc(CurrentUser.id());
    }

    private PensaderoItem requireOwned(String id) {
        return pensaderoItemRepository.findByIdAndOwnerId(id, CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Pensamiento no encontrado: " + id));
    }

    @Transactional
    public PensaderoItem addItem(String content, String category) {
        return addItem(content, category, null, null);
    }

    @Transactional
    public PensaderoItem addItem(String content, String category, String amount, String contactName) {
        PensaderoItem item = new PensaderoItem();
        item.setId("pen-" + UUID.randomUUID().toString().substring(0, 8));
        item.setContent(content);
        item.setCategory(category != null ? category : "humo_general");
        item.setIsPinned(false);
        item.setIsResolved(false);
        item.setCreatedAt(LocalDateTime.now());
        item.setUpdatedAt(LocalDateTime.now());
        item.setOwnerId(CurrentUser.id());
        if (amount != null && !amount.isBlank()) item.setAmount(amount);
        if (contactName != null && !contactName.isBlank()) item.setContactName(contactName);
        return pensaderoItemRepository.save(item);
    }

    @Transactional
    public PensaderoItem updateItem(String id, PensaderoItem itemData) {
        PensaderoItem existing = requireOwned(id);

        if (itemData.getContent() != null) existing.setContent(itemData.getContent());
        if (itemData.getCategory() != null) existing.setCategory(itemData.getCategory());
        if (itemData.getCognitiveWeight() != null) existing.setCognitiveWeight(itemData.getCognitiveWeight());
        if (itemData.getContactName() != null) existing.setContactName(itemData.getContactName());
        if (itemData.getAmount() != null) existing.setAmount(itemData.getAmount());
        if (itemData.getIsPinned() != null) existing.setIsPinned(itemData.getIsPinned());
        if (itemData.getIsResolved() != null) existing.setIsResolved(itemData.getIsResolved());
        existing.setUpdatedAt(LocalDateTime.now());
        return pensaderoItemRepository.save(existing);
    }

    @Transactional
    public PensaderoItem togglePin(String id) {
        PensaderoItem item = requireOwned(id);
        item.setIsPinned(!Boolean.TRUE.equals(item.getIsPinned()));
        item.setUpdatedAt(LocalDateTime.now());
        return pensaderoItemRepository.save(item);
    }

    @Transactional
    public void deleteItem(String id) {
        pensaderoItemRepository.findByIdAndOwnerId(id, CurrentUser.id()).ifPresent(pensaderoItemRepository::delete);
    }

    @Transactional
    public Task convertToTask(String id, String projectId) {
        PensaderoItem item = requireOwned(id);

        Project project = projectService.requireOwned(projectId);

        Task task = new Task();
        task.setId("t-" + UUID.randomUUID().toString().substring(0, 8));
        task.setProject(project);
        task.setTitle(item.getContent());
        task.setColumn("buzon");
        task.setEffort("S");
        task.setOriginThoughtId(item.getId());
        task.setOriginThoughtContent(item.getContent());
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        Task saved = taskRepository.save(task);
        pensaderoItemRepository.deleteById(id);
        return saved;
    }

    @Transactional
    public Project convertToProject(String id, String projectName) {
        PensaderoItem item = requireOwned(id);

        Project project = new Project();
        project.setId("p-" + UUID.randomUUID().toString().substring(0, 8));
        project.setName(projectName != null && !projectName.isBlank() ? projectName : item.getContent().substring(0, Math.min(30, item.getContent().length())));
        project.setEmoji("⚡");
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
