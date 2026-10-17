package com.proyectazo.service;

import com.proyectazo.model.InboxItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.InboxItemRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.repository.TaskRepository;
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
        return inboxItemRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public InboxItem addItem(String text) {
        InboxItem item = new InboxItem();
        item.setId("inb-" + UUID.randomUUID().toString().substring(0, 8));
        item.setText(text);
        item.setCreatedAt(LocalDateTime.now());
        return inboxItemRepository.save(item);
    }

    @Transactional
    public void deleteItem(String id) {
        inboxItemRepository.deleteById(id);
    }

    @Transactional
    public Task convertToTask(String inboxId, String projectId) {
        InboxItem item = inboxItemRepository.findById(inboxId)
                .orElseThrow(() -> new IllegalArgumentException("Idea no encontrada: " + inboxId));

        Project project = projectRepository.findById(projectId)
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
