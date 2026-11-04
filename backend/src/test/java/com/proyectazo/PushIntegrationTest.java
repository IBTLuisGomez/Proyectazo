package com.proyectazo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proyectazo.model.PushSubscription;
import com.proyectazo.push.PushNotificationService;
import com.proyectazo.push.PushSender;
import com.proyectazo.repository.PushSubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pushdb;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.auth.admin-user=tester",
        "app.auth.admin-password=ClaveSegura123",
        "app.push.dispatch-interval-ms=3600000"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class PushIntegrationTest {

    /** Sustituye el envío real: registra los mensajes y permite simular respuestas del servicio de push. */
    static class FakePushSender implements PushSender {
        final List<String> payloads = new CopyOnWriteArrayList<>();
        volatile int nextStatus = 201;
        volatile String configuredPublicKey;

        @Override
        public void configure(String pub, String priv, String subject) {
            configuredPublicKey = pub;
        }

        @Override
        public int send(PushSubscription subscription, String payloadJson) {
            payloads.add(payloadJson);
            return nextStatus;
        }
    }

    @TestConfiguration
    static class FakeSenderConfig {
        @Bean
        @Primary
        FakePushSender fakePushSender() {
            return new FakePushSender();
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private FakePushSender fake;
    @Autowired private PushNotificationService pushService;
    @Autowired private PushSubscriptionRepository subscriptions;

    private String token;

    @BeforeEach
    void login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"tester\",\"password\":\"ClaveSegura123\"}"))
                .andReturn().getResponse().getContentAsString();
        token = "Bearer " + mapper.readTree(body).get("token").asText();
    }

    private void subscribe(String endpoint) throws Exception {
        mvc.perform(post("/api/push/subscribe").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"" + endpoint + "\",\"keys\":{\"p256dh\":\"BPk\",\"auth\":\"au\"}}"))
                .andExpect(status().isOk());
    }

    @Test
    void publicKeyIsGeneratedAndRequiresLogin() throws Exception {
        mvc.perform(get("/api/push/public-key")).andExpect(status().isUnauthorized());
        String body = mvc.perform(get("/api/push/public-key").header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String key = mapper.readTree(body).get("publicKey").asText();
        // 65 bytes en base64url sin relleno = 87 caracteres; el mismo que recibió el emisor
        assertEquals(87, key.length());
        assertEquals(fake.configuredPublicKey, key);
    }

    @Test
    void subscribeRejectsNonHttpsAndIncomplete() throws Exception {
        mvc.perform(post("/api/push/subscribe").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"http://inseguro\",\"keys\":{\"p256dh\":\"a\",\"auth\":\"b\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/push/subscribe").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endpoint\":\"https://push.example/x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testPushReachesEverySubscribedDevice() throws Exception {
        subscribe("https://push.example/movil");
        subscribe("https://push.example/pc");
        subscribe("https://push.example/pc"); // repetir no duplica
        mvc.perform(post("/api/push/test").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delivered").value(2));
        assertEquals(2, fake.payloads.size());
        assertTrue(fake.payloads.get(0).contains("\"title\""));
    }

    @Test
    void expiredSubscriptionsAreRemoved() throws Exception {
        subscribe("https://push.example/caducada");
        fake.nextStatus = 410;
        mvc.perform(post("/api/push/test").header("Authorization", token))
                .andExpect(jsonPath("$.delivered").value(0));
        assertTrue(subscriptions.findByEndpoint("https://push.example/caducada").isEmpty());
    }

    @Test
    void dueRemindersAreSentOnceAndFutureOnesWait() throws Exception {
        subscribe("https://push.example/movil");
        long past = System.currentTimeMillis() - 60_000;
        long future = System.currentTimeMillis() + 3_600_000;
        mvc.perform(post("/api/push/reminders").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Llamar al cliente\",\"taskId\":\"t1\",\"sendAt\":" + past + "}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/push/reminders").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Más tarde\",\"sendAt\":" + future + "}"))
                .andExpect(status().isCreated());

        assertEquals(1, pushService.dispatchDueReminders());
        assertEquals(1, fake.payloads.size());
        assertTrue(fake.payloads.get(0).contains("Llamar al cliente"));
        assertEquals(0, pushService.dispatchDueReminders(), "no se reenvía");

        String pending = mvc.perform(get("/api/push/reminders").header("Authorization", token))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        List<String> titles = new ArrayList<>();
        mapper.readTree(pending).forEach(n -> titles.add(n.get("title").asText()));
        assertEquals(List.of("Más tarde"), titles);
    }

    @Test
    void reschedulingATaskReplacesItsPendingReminder() throws Exception {
        long soon = System.currentTimeMillis() + 3_600_000;
        long later = soon + 86_400_000;
        for (long at : new long[] { soon, later }) {
            mvc.perform(post("/api/push/reminders").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Dentista\",\"taskId\":\"t-den\",\"sendAt\":" + at + "}"))
                    .andExpect(status().isCreated());
        }
        String pending = mvc.perform(get("/api/push/reminders").header("Authorization", token))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        com.fasterxml.jackson.databind.JsonNode list = mapper.readTree(pending);
        assertEquals(1, list.size(), "un solo aviso pendiente por tarea");
        assertEquals(later, list.get(0).get("sendAt").asLong() / 1000 * 1000, 1000);
    }

    @Test
    void reminderValidation() throws Exception {
        mvc.perform(post("/api/push/reminders").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\",\"sendAt\":" + System.currentTimeMillis() + "}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/push/reminders").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Sin fecha\"}"))
                .andExpect(status().isBadRequest());
    }
}
