package com.proyectazo.service;

import com.proyectazo.dto.SyncDataDTO;
import com.proyectazo.model.InboxItem;
import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import com.proyectazo.repository.InboxItemRepository;
import com.proyectazo.repository.PensaderoItemRepository;
import com.proyectazo.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SyncService {

    private final ProjectRepository projectRepository;
    private final InboxItemRepository inboxItemRepository;
    private final PensaderoItemRepository pensaderoItemRepository;
    private final ProjectService projectService;

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
        if (incoming.getProjects() != null) {
            for (Project p : incoming.getProjects()) {
                projectService.saveProject(p);
            }
        }
        if (incoming.getInbox() != null) {
            for (InboxItem item : incoming.getInbox()) {
                if (!inboxItemRepository.existsById(item.getId())) {
                    inboxItemRepository.save(item);
                }
            }
        }
        if (incoming.getPensadero() != null) {
            for (PensaderoItem pItem : incoming.getPensadero()) {
                if (!pensaderoItemRepository.existsById(pItem.getId())) {
                    pensaderoItemRepository.save(pItem);
                }
            }
        }
        return pullData();
    }
}
