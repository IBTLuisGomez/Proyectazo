package com.proyectazo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.auth.admin-user=tester",
        "app.auth.admin-password=ClaveSegura123",
        "app.cors.allowed-origins=http://localhost:8080,null"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class SecurityAndWipIntegrationTest {

    private static final String PASSWORD = "ClaveSegura123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    private String token;

    @BeforeEach
    void login() throws Exception {
        token = loginAs("tester", PASSWORD);
    }

    private String loginAs(String user, String pass) throws Exception {
        String body = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + user + "\",\"password\":\"" + pass + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("token").asText();
    }

    private String bearer() {
        return "Bearer " + token;
    }

    @Test
    void apiRequiresToken() throws Exception {
        mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/projects").header("Authorization", "Bearer invalido")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/projects").header("Authorization", bearer())).andExpect(status().isOk());
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void wrongPasswordIsRejected() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"tester\",\"password\":\"incorrecta\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesToken() throws Exception {
        mvc.perform(post("/api/auth/logout").header("Authorization", bearer())).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization", bearer())).andExpect(status().isUnauthorized());
    }

    @Test
    void changingPasswordRevokesOldSessions() throws Exception {
        String body = mvc.perform(post("/api/auth/credentials")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"OtraClave456\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String newToken = mapper.readTree(body).get("token").asText();

        mvc.perform(get("/api/auth/me").header("Authorization", bearer())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + newToken)).andExpect(status().isOk());
        loginAs("tester", "OtraClave456");
    }

    @Test
    void shortNewPasswordIsRejected() throws Exception {
        mvc.perform(post("/api/auth/credentials")
                        .header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"corta\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void wipeRequiresConfirmationHeader() throws Exception {
        String wipe = "{\"wipe\":true,\"projects\":[],\"inbox\":[],\"pensadero\":[]}";
        mvc.perform(post("/api/sync").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(wipe))
                .andExpect(status().isPreconditionRequired());
        mvc.perform(post("/api/sync").header("Authorization", bearer())
                        .header("X-Confirm-Wipe", "BORRAR-TODO")
                        .contentType(MediaType.APPLICATION_JSON).content(wipe))
                .andExpect(status().isOk());
    }

    @Test
    void corsRejectsUnknownOrigin() throws Exception {
        mvc.perform(options("/api/projects")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
        mvc.perform(options("/api/projects")
                        .header("Origin", "http://localhost:8080")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8080"));
    }

    @Test
    void corsAllowsDesktopFileOrigin() throws Exception {
        // Electron carga index.html con file://, cuyo Origin es "null"
        mvc.perform(options("/api/projects")
                        .header("Origin", "null")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk());
    }

    @Test
    void syncKeepsRealProjectNamedLikeOldDemo() throws Exception {
        String payload = "{\"projects\":["
                + "{\"id\":\"p-real-1\",\"name\":\"CytoHelix\"},"
                + "{\"id\":\"p-cytohelix\",\"name\":\"CytoHelix demo\"}],"
                + "\"inbox\":[],\"pensadero\":[]}";
        mvc.perform(post("/api/sync").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());

        String body = mvc.perform(get("/api/sync").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode projects = mapper.readTree(body).get("projects");
        java.util.List<String> ids = new java.util.ArrayList<>();
        projects.forEach(p -> ids.add(p.get("id").asText()));
        org.junit.jupiter.api.Assertions.assertTrue(ids.contains("p-real-1"), "el proyecto real debe sincronizarse");
        org.junit.jupiter.api.Assertions.assertFalse(ids.contains("p-cytohelix"), "el ID demo legacy se sigue filtrando");
    }

    @Test
    void wipLimitAllowsAtMostThreeTasksInFocus() throws Exception {
        String projectBody = mvc.perform(post("/api/projects").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"p-test\",\"name\":\"Proyecto Test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode project = mapper.readTree(projectBody);
        String projectId = project.get("id").asText();

        for (int i = 1; i <= 3; i++) {
            mvc.perform(post("/api/projects/" + projectId + "/tasks").header("Authorization", bearer())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Tarea " + i + "\",\"column\":\"enfoco\"}"))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/projects/" + projectId + "/tasks").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Tarea 4\",\"column\":\"enfoco\"}"))
                .andExpect(status().isBadRequest());
    }
}
