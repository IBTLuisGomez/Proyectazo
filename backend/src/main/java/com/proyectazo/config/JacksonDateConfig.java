package com.proyectazo.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

@Configuration
public class JacksonDateConfig {

    @Bean
    public com.fasterxml.jackson.databind.Module flexibleLocalDateTimeModule() {
        SimpleModule module = new SimpleModule();
        module.addDeserializer(LocalDateTime.class, new JsonDeserializer<>() {
            @Override
            public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                String raw = parser.getValueAsString();
                if (raw == null || raw.isBlank()) {
                    return null;
                }
                String value = raw.trim();
                try {
                    return LocalDateTime.parse(value);
                } catch (Exception ignored) {
                    // ISO con zona, por ejemplo 2026-10-22T22:00:00.000Z
                }
                try {
                    return OffsetDateTime.parse(value).toLocalDateTime();
                } catch (Exception ignored) {
                    // sigue abajo
                }
                try {
                    return LocalDateTime.ofInstant(Instant.parse(value), ZoneId.systemDefault());
                } catch (Exception ignored) {
                    return null;
                }
            }
        });
        return module;
    }
}
