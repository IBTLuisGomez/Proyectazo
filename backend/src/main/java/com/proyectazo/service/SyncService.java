package com.proyectazo.service;

import com.proyectazo.dto.SyncDataDTO;
import com.proyectazo.model.InboxItem;
import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import com.proyectazo.model.Task;
import com.proyectazo.repository.InboxItemRepository;
import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class SyncService {

    private final ProjectRepository projectRepository;
    private final InboxItemRepository inboxItemRepository;
    private final PensaderoItemRepository pensaderoItemRepository;
    private final ProjectService projectService;

    private static final Set<String> DEMO_PROJECT_IDS = Set.of(
        "p-focusflow", "p-cytohelix", "p-cytocore",
        "proj_focusflow", "proj_cytohelix", "proj_cytocore"
    );
    private static final Set<String> DEMO_NAMES = Set.of(
        "FocusFlow OS", "CytoHelix", "CytoCore"
    );

    public SyncService(ProjectRepository projectRepository,
                       InboxItemRepository inboxItemRepository,
                       PensaderoItemRepository pensaderoItemRepository,
                       ProjectService projectService) {
        this.projectRepository = projectRepository;
        this.inboxItemRepository = inboxItemRepository;
        this.pensaderoItemRepository = pensaderoItemRepository;
        this.projectService = projectService;
    }

    public SyncDataDTO pullData() {
        List<Project> projects = projectRepository.findAllByOrderByLastActivityDesc();
        List<InboxItem> inbox = inboxItemRepository.findAllByOrderByCreatedAtDesc();
        List<PensaderoItem> pensadero = pensaderoItemRepository.findAllByOrderByIsPinnedDescCreatedAtDesc();
        return new SyncDataDTO(projects, inbox, pensadero);
    }

    @Transactional
    public SyncDataDTO pushData(SyncDataDTO incoming) {
        if (incoming == null) return pullData();
        if (Boolean.TRUE.equals(incoming.getWipe())) {
            projectRepository.deleteAll();
            inboxItemRepository.deleteAll();
            pensaderoItemRepository.deleteAll();
            return pullData();
        }

        if (incoming.getProjects() != null) {
            for (Project project : incoming.getProjects()) {
                if (project == null) continue;
                if (project.getId() != null && DEMO_PROJECT_IDS.contains(project.getId())) continue;
                if (project.getName() != null && DEMO_NAMES.contains(project.getName().trim())) continue;
                mergeProject(project);
            }
        }
        if (incoming.getInbox() != null) {
            for (InboxItem item : incoming.getInbox()) {
                if (item == null || item.getId() == null || item.getText() == null || item.getText().isBlank()) continue;
                if (!inboxItemRepository.existsById(item.getId())) {
                    inboxItemRepository.save(item);
                }
            }
        }
        if (incoming.getPensadero() != null) {
            for (PensaderoItem item : incoming.getPensadero()) {
                mergePensadero(item);
            }
        }
        return pullData();
    }

    private void mergeProject(Project incoming) {
        if (incoming.getId() == null || incoming.getId().isBlank()) {
            projectService.saveProject(incoming);
            return;
        }
        Project existing = projectRepository.findById(incoming.getId()).orElse(null);
        if (existing == null) {
            projectService.saveProject(incoming);
            return;
        }

        LocalDateTime incomingStamp = incoming.getUpdatedAt() != null ? incoming.getUpdatedAt() : incoming.getLastActivity();
        LocalDateTime existingStamp = existing.getUpdatedAt() != null ? existing.getUpdatedAt() : existing.getLastActivity();
        boolean newer = isNewer(incomingStamp, existingStamp);
        if (newer) {
            copyProjectScalars(existing, incoming);
        }
        mergeTasks(existing, incoming.getTasks(), newer);
        projectRepository.save(existing);
    }

    private void copyProjectScalars(Project target, Project source) {
        if (source.getName() != null && !source.getName().isBlank()) target.setName(source.getName());
        if (source.getEmoji() != null) target.setEmoji(source.getEmoji());
        if (source.getColor() != null) target.setColor(source.getColor());
        if (source.getStatus() != null) target.setStatus(source.getStatus());
        if (source.getEnergy() != null) target.setEnergy(source.getEnergy());
        if (source.getObjective() != null) target.setObjective(source.getObjective());
        if (source.getContext() != null) target.setContext(source.getContext());
        if (source.getNextAction() != null) target.setNextAction(source.getNextAction());
        if (source.getNextActionType() != null) target.setNextActionType(source.getNextActionType());
        if (source.getLastActivity() != null) target.setLastActivity(source.getLastActivity());
    }

    private void mergeTasks(Project existing, List<Task> incomingTasks, boolean projectNewer) {
        if (incomingTasks == null) return;
        Map<String, Task> byId = new HashMap<>();
        for (Task task : existing.getTasks()) {
            if (task.getId() != null) byId.put(task.getId(), task);
        }
        for (Task incoming : incomingTasks) {
            if (incoming == null || incoming.getTitle() == null || incoming.getTitle().isBlank()) continue;
            if (incoming.getId() == null || incoming.getId().isBlank()) {
                incoming.setId("t-" + UUID.randomUUID().toString().substring(0, 8));
            }
            Task current = byId.get(incoming.getId());
            if (current == null) {
                incoming.setProject(existing);
                if (incoming.getColumn() == null || incoming.getColumn().isBlank()) incoming.setColumn("buzon");
                existing.getTasks().add(incoming);
                byId.put(incoming.getId(), incoming);
            } else if (isNewer(incoming.getUpdatedAt(), current.getUpdatedAt()) || (incoming.getUpdatedAt() == null && projectNewer)) {
                copyTask(current, incoming);
            }
        }
    }

    private void copyTask(Task target, Task source) {
        target.setTitle(source.getTitle());
        if (source.getColumn() != null) target.setColumn(source.getColumn());
        if (source.getEffort() != null) target.setEffort(source.getEffort());
        if (source.getNotes() != null) target.setNotes(source.getNotes());
        if (source.getOriginThoughtContent() != null) target.setOriginThoughtContent(source.getOriginThoughtContent());
        if (source.getOriginThoughtId() != null) target.setOriginThoughtId(source.getOriginThoughtId());
        if (source.getCodeSnippet() != null) target.setCodeSnippet(source.getCodeSnippet());
        if (source.getIsBureaucratic() != null) target.setIsBureaucratic(source.getIsBureaucratic());
        if (source.getIsMicroStep() != null) target.setIsMicroStep(source.getIsMicroStep());
    }

    private void mergePensadero(PensaderoItem incoming) {
        if (incoming == null || incoming.getContent() == null || incoming.getContent().isBlank()) return;
        if (incoming.getId() != null && (incoming.getId().startsWith("pens_init_") || incoming.getId().startsWith("demo_"))) return;
        if (incoming.getId() == null || incoming.getId().isBlank()) {
            pensaderoItemRepository.save(incoming);
            return;
        }
        PensaderoItem existing = pensaderoItemRepository.findById(incoming.getId()).orElse(null);
        if (existing == null) {
            pensaderoItemRepository.save(incoming);
            return;
        }
        if (!isNewer(incoming.getUpdatedAt(), existing.getUpdatedAt()) && incoming.getUpdatedAt() != null) return;
        if (incoming.getUpdatedAt() == null && existing.getUpdatedAt() != null) return;
        existing.setContent(incoming.getContent());
        if (incoming.getCategory() != null) existing.setCategory(incoming.getCategory());
        if (incoming.getCognitiveWeight() != null) existing.setCognitiveWeight(incoming.getCognitiveWeight());
        if (incoming.getContactName() != null) existing.setContactName(incoming.getContactName());
        if (incoming.getAmount() != null) existing.setAmount(incoming.getAmount());
        if (incoming.getIsPinned() != null) existing.setIsPinned(incoming.getIsPinned());
        if (incoming.getIsResolved() != null) existing.setIsResolved(incoming.getIsResolved());
        pensaderoItemRepository.save(existing);
    }

    private boolean isNewer(LocalDateTime incoming, LocalDateTime existing) {
        if (incoming == null) return false;
        if (existing == null) return true;
        return incoming.isAfter(existing);
    }
}
