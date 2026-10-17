package com.proyectazo.dto;

import com.proyectazo.model.InboxItem;
import com.proyectazo.model.Project;
import java.util.List;

public class SyncDataDTO {
    private List<Project> projects;
    private List<InboxItem> inbox;

    public SyncDataDTO() {}

    public SyncDataDTO(List<Project> projects, List<InboxItem> inbox) {
        this.projects = projects;
        this.inbox = inbox;
    }

    public List<Project> getProjects() { return projects; }
    public void setProjects(List<Project> projects) { this.projects = projects; }

    public List<InboxItem> getInbox() { return inbox; }
    public void setInbox(List<InboxItem> inbox) { this.inbox = inbox; }
}
