package com.proyectazo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.proyectazo.model.AppUser;
import com.proyectazo.model.Project;
import com.proyectazo.repository.AppUserRepository;
import com.proyectazo.repository.ProjectRepository;
import com.proyectazo.security.OwnershipMigration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Cada cuenta ve y modifica solo sus datos, también por sync. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:ownerdb;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.auth.admin-user=ana",
        "app.auth.admin-password=ClaveDeAna123",
        "app.push.dispatch-interval-ms=3600000"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class OwnershipIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private AppUserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ProjectRepository projects;
    @Autowired private OwnershipMigration migration;

    private String ana;
    private String beto;

    private String login(String user, String pass) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + user + "\",\"password\":\"" + pass + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("token").asText();
    }

    private JsonNode json(String token, String url) throws Exception {
        return mapper.readTree(mvc.perform(get(url).header("Authorization", token))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @BeforeEach
    void setUp() throws Exception {
        users.save(new AppUser("beto", encoder.encode("ClaveDeBeto123")));
        ana = login("ana", "ClaveDeAna123");
        beto = login("beto", "ClaveDeBeto123");

        mvc.perform(post("/api/projects").header("Authorization", ana).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"p-ana\",\"name\":\"Proyecto de Ana\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/projects/p-ana/tasks").header("Authorization", ana).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"t-ana\",\"title\":\"Tarea de Ana\",\"column\":\"buzon\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/pensadero").header("Authorization", ana).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Pensamiento íntimo de Ana\",\"category\":\"humo_blanco\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void anotherAccountSeesNothing() throws Exception {
        assertEquals(1, json(ana, "/api/projects").size());
        assertEquals(0, json(beto, "/api/projects").size());
        assertEquals(0, json(beto, "/api/pensadero").size());
        JsonNode pull = json(beto, "/api/sync");
        assertEquals(0, pull.get("projects").size());
        assertEquals(0, pull.get("pensadero").size());
        // El dueño no se expone en el JSON
        assertFalse(json(ana, "/api/projects").get(0).has("ownerId"));
    }

    @Test
    void anotherAccountCannotReadChangeOrDelete() throws Exception {
        mvc.perform(get("/api/projects/p-ana").header("Authorization", beto)).andExpect(status().isNotFound());
        mvc.perform(get("/api/projects/p-ana/tasks").header("Authorization", beto)).andExpect(status().is4xxClientError());
        mvc.perform(put("/api/tasks/t-ana").header("Authorization", beto).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"hackeado\"}")).andExpect(status().isNotFound());
        mvc.perform(patch("/api/tasks/t-ana/move").header("Authorization", beto).contentType(MediaType.APPLICATION_JSON)
                .content("{\"column\":\"enfoco\"}")).andExpect(status().is4xxClientError());
        mvc.perform(delete("/api/tasks/t-ana").header("Authorization", beto));
        mvc.perform(delete("/api/projects/p-ana").header("Authorization", beto));

        JsonNode mine = json(ana, "/api/projects/p-ana");
        assertEquals("Proyecto de Ana", mine.get("name").asText());
        assertEquals(1, json(ana, "/api/projects/p-ana/tasks").size());
        assertEquals("Tarea de Ana", json(ana, "/api/projects/p-ana/tasks").get(0).get("title").asText());
    }

    @Test
    void syncCannotOverwriteOrWipeAnotherAccount() throws Exception {
        mvc.perform(post("/api/sync").header("Authorization", beto).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projects\":[{\"id\":\"p-ana\",\"name\":\"Robado\",\"updatedAt\":\"2099-01-01T00:00:00\"}],\"inbox\":[],\"pensadero\":[]}"))
                .andExpect(status().isOk());
        assertEquals("Proyecto de Ana", json(ana, "/api/projects/p-ana").get("name").asText());
        assertEquals(0, json(beto, "/api/projects").size(), "no se le crea una copia a Beto");

        mvc.perform(post("/api/sync").header("Authorization", beto).header("X-Confirm-Wipe", "BORRAR-TODO")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"wipe\":true}"))
                .andExpect(status().isOk());
        assertEquals(1, json(ana, "/api/projects").size(), "el borrado total de Beto no toca a Ana");
        assertEquals(1, json(ana, "/api/pensadero").size());
    }

    @Test
    void reusingAnotherAccountsIdCreatesASeparateProject() throws Exception {
        mvc.perform(post("/api/projects").header("Authorization", beto).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"p-ana\",\"name\":\"De Beto\"}"))
                .andExpect(status().isCreated());
        assertEquals("Proyecto de Ana", json(ana, "/api/projects/p-ana").get("name").asText());
        JsonNode betos = json(beto, "/api/projects");
        assertEquals(1, betos.size());
        assertNotEquals("p-ana", betos.get(0).get("id").asText());
    }

    @Test
    void orphanDataIsAssignedToTheFirstUser() throws Exception {
        Project legacy = new Project();
        legacy.setId("p-antiguo");
        legacy.setName("Creado antes de separar por usuario");
        projects.save(legacy);
        assertNull(projects.findById("p-antiguo").orElseThrow().getOwnerId());

        migration.run();

        Long anaId = users.findByUsername("ana").orElseThrow().getId();
        assertEquals(anaId, projects.findById("p-antiguo").orElseThrow().getOwnerId());
        assertEquals(2, json(ana, "/api/projects").size());
        assertEquals(0, json(beto, "/api/projects").size());
    }
}
