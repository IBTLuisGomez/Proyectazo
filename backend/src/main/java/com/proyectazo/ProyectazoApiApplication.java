package com.proyectazo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ProyectazoApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProyectazoApiApplication.class, args);
    }
}
