package com.proyectazo.dto;

import com.proyectazo.model.InboxItem;
import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import java.util.List;

public class SyncDataDTO {
    private List<Project> projects;
    private List<InboxItem> inbox;
    private List<PensaderoItem> pensadero;

    public SyncDataDTO() {}

    public SyncDataDTO(List<Project> projects, List<InboxItem> inbox, List<PensaderoItem> pensadero) {
        this.projects = projects;
        this.inbox = inbox;
        this.pensadero = pensadero;
    }

    public List<Project> getProjects() { return projects; }
    public void setProjects(List<Project> projects) { this.projects = projects; }

    public List<InboxItem> getInbox() { return inbox; }
    public void setInbox(List<InboxItem> inbox) { this.inbox = inbox; }

    public List<PensaderoItem> getPensadero() { return pensadero; }
    public void setPensadero(List<PensaderoItem> pensadero) { this.pensadero = pensadero; }
}
