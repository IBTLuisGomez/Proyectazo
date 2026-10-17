package com.proyectazo.dto;

import jakarta.validation.constraints.NotBlank;

public class TaskMoveRequest {
    @NotBlank
    private String column;

    public TaskMoveRequest() {}

    public TaskMoveRequest(String column) {
        this.column = column;
    }

    public String getColumn() { return column; }
    public void setColumn(String column) { this.column = column; }
}
