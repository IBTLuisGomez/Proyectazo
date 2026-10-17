package com.proyectazo.dto;

import jakarta.validation.constraints.NotBlank;

public class CheckoutRequest {
    @NotBlank
    private String achievement;

    @NotBlank
    private String nextStep;

    private String nextActionType = "hacer"; // hacer, esperar, decidir, explorar
    private String energy = "media"; // baja, media, alta
    private String status = "activo"; // activo, pausado, completado
    private Integer duration = 25;

    public CheckoutRequest() {}

    public String getAchievement() { return achievement; }
    public void setAchievement(String achievement) { this.achievement = achievement; }

    public String getNextStep() { return nextStep; }
    public void setNextStep(String nextStep) { this.nextStep = nextStep; }

    public String getNextActionType() { return nextActionType; }
    public void setNextActionType(String nextActionType) { this.nextActionType = nextActionType; }

    public String getEnergy() { return energy; }
    public void setEnergy(String energy) { this.energy = energy; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }
}
