package com.proyectazo.model;

import jakarta.persistence.*;

/** Ajustes del servidor que deben sobrevivir a reinicios (p. ej. las claves VAPID generadas). */
@Entity
@Table(name = "app_settings")
public class AppSetting {

    @Id
    @Column(length = 64)
    private String settingKey;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String settingValue;

    public AppSetting() {}

    public AppSetting(String settingKey, String settingValue) {
        this.settingKey = settingKey;
        this.settingValue = settingValue;
    }

    public String getSettingKey() { return settingKey; }
    public String getSettingValue() { return settingValue; }
}
