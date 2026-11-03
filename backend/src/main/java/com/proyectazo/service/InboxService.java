package com.proyectazo.service;

import com.proyectazo.model.InboxItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.InboxItemRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
import com.proyectazo.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class InboxService {

    private final InboxItemRepository inboxItemRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    public InboxService(InboxItemRepository inboxItemRepository, ProjectRepository projectRepository, TaskRepository taskRepository) {
        this.inboxItemRepository = inboxItemRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }

    public List<InboxItem> getAllItems() {
        return inboxItemRepository.findByOwnerIdOrderByCreatedAtDesc(CurrentUser.id());
    }

    @Transactional
    public InboxItem addItem(String text) {
        InboxItem item = new InboxItem();
        item.setId("inb-" + UUID.randomUUID().toString().substring(0, 8));
        item.setText(text);
        item.setCreatedAt(LocalDateTime.now());
        item.setOwnerId(CurrentUser.id());
        return inboxItemRepository.save(item);
    }

    @Transactional
    public void deleteItem(String id) {
        inboxItemRepository.findByIdAndOwnerId(id, CurrentUser.id()).ifPresent(inboxItemRepository::delete);
    }

    @Transactional
    public Task convertToTask(String inboxId, String projectId) {
        Long owner = CurrentUser.id();
        InboxItem item = inboxItemRepository.findByIdAndOwnerId(inboxId, owner)
                .orElseThrow(() -> new IllegalArgumentException("Idea no encontrada: " + inboxId));

        Project project = projectRepository.findByIdAndOwnerId(projectId, owner)
                .orElseThrow(() -> new IllegalArgumentException("Proyecto no encontrado: " + projectId));

        Task task = new Task();
        task.setId("t-" + UUID.randomUUID().toString().substring(0, 8));
        task.setProject(project);
        task.setTitle(item.getText());
        task.setColumn("buzon");
        task.setEffort("S");
        task.setCreatedAt(LocalDateTime.now());

        Task saved = taskRepository.save(task);
        inboxItemRepository.deleteById(inboxId);
        return saved;
    }
}
