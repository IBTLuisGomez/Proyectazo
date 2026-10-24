package com.proyectazo.dto;

import com.proyectazo.model.InboxItem;
import com.proyectazo.model.PensaderoItem;
import com.proyectazo.model.Project;
import java.util.List;

public class SyncDataDTO {
    private List<Project> projects;
    private List<InboxItem> inbox;
    private List<PensaderoItem> pensadero;
    private Boolean wipe;
    private String deviceId;
    private String deviceLabel;

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

    public Boolean getWipe() { return wipe; }
    public void setWipe(Boolean wipe) { this.wipe = wipe; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getDeviceLabel() { return deviceLabel; }
    public void setDeviceLabel(String deviceLabel) { this.deviceLabel = deviceLabel; }
}
