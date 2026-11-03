package com.proyectazo.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.proyectazo.model.AppSetting;
import com.proyectazo.model.AppUser;
import com.proyectazo.model.PushReminder;
import com.proyectazo.model.PushSubscription;
import com.proyectazo.repository.AppSettingRepository;
import com.proyectazo.repository.PushReminderRepository;
import com.proyectazo.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);
    private static final String KEY_PUBLIC = "vapid.public";
    private static final String KEY_PRIVATE = "vapid.private";

    private final PushSubscriptionRepository subscriptionRepository;
    private final PushReminderRepository reminderRepository;
    private final AppSettingRepository settingRepository;
    private final PushSender sender;
    private final ObjectMapper mapper;

    @Value("${app.push.vapid-public-key:}")
    private String configuredPublicKey;

    @Value("${app.push.vapid-private-key:}")
    private String configuredPrivateKey;

    @Value("${app.push.subject:mailto:admin@localhost}")
    private String subject;

    private String publicKey;
    private boolean enabled;

    public PushNotificationService(PushSubscriptionRepository subscriptionRepository,
                                   PushReminderRepository reminderRepository,
                                   AppSettingRepository settingRepository,
                                   PushSender sender,
                                   ObjectMapper mapper) {
        this.subscriptionRepository = subscriptionRepository;
        this.reminderRepository = reminderRepository;
        this.settingRepository = settingRepository;
        this.sender = sender;
        this.mapper = mapper;
    }

    /** Claves VAPID: de NEXUS_VAPID_* si existen; si no, se generan una vez y se guardan en la BD. */
    @PostConstruct
    void initKeys() {
        try {
            String pub = configuredPublicKey;
            String priv = configuredPrivateKey;
            if (pub == null || pub.isBlank() || priv == null || priv.isBlank()) {
                pub = settingRepository.findById(KEY_PUBLIC).map(AppSetting::getSettingValue).orElse(null);
                priv = settingRepository.findById(KEY_PRIVATE).map(AppSetting::getSettingValue).orElse(null);
                if (pub == null || priv == null) {
                    String[] generated = generateVapidKeys();
                    pub = generated[0];
                    priv = generated[1];
                    settingRepository.save(new AppSetting(KEY_PUBLIC, pub));
                    settingRepository.save(new AppSetting(KEY_PRIVATE, priv));
                    log.info("Claves VAPID generadas y guardadas en la base de datos.");
                }
            }
            sender.configure(pub, priv, subject);
            this.publicKey = pub;
            this.enabled = true;
        } catch (Exception e) {
            this.enabled = false;
            log.warn("Web Push desactivado: no se pudieron preparar las claves VAPID ({})", e.getMessage());
        }
    }

    static String[] generateVapidKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair pair = generator.generateKeyPair();
        ECPublicKey pub = (ECPublicKey) pair.getPublic();
        ECPrivateKey priv = (ECPrivateKey) pair.getPrivate();

        // Punto sin comprimir: 0x04 || X(32) || Y(32), como lo espera applicationServerKey
        byte[] point = new byte[65];
        point[0] = 0x04;
        System.arraycopy(toFixed32(pub.getW().getAffineX()), 0, point, 1, 32);
        System.arraycopy(toFixed32(pub.getW().getAffineY()), 0, point, 33, 32);

        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        return new String[] { b64.encodeToString(point), b64.encodeToString(toFixed32(priv.getS())) };
    }

    private static byte[] toFixed32(BigInteger value) {
        byte[] raw = value.toByteArray();
        byte[] out = new byte[32];
        int copy = Math.min(raw.length, 32);
        System.arraycopy(raw, raw.length - copy, out, 32 - copy, copy);
        return out;
    }

    public boolean isEnabled() { return enabled; }

    public String getPublicKey() { return publicKey; }

    @Transactional
    public void subscribe(AppUser user, String endpoint, String p256dh, String auth) {
        if (isBlank(endpoint) || isBlank(p256dh) || isBlank(auth)) {
            throw new IllegalArgumentException("Suscripción incompleta: faltan endpoint o claves.");
        }
        if (!endpoint.startsWith("https://")) {
            throw new IllegalArgumentException("El endpoint de push debe ser https.");
        }
        PushSubscription sub = subscriptionRepository.findByEndpoint(endpoint)
                .orElseGet(() -> new PushSubscription(user.getId(), endpoint, p256dh, auth));
        sub.setUserId(user.getId());
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        subscriptionRepository.save(sub);
    }

    public void unsubscribe(AppUser user, String endpoint) {
        if (!isBlank(endpoint)) subscriptionRepository.deleteByEndpointAndUserId(endpoint, user.getId());
    }

    public int countSubscriptions(AppUser user) {
        return subscriptionRepository.findByUserId(user.getId()).size();
    }

    /** Envía a todos los dispositivos del usuario. Las suscripciones caducadas (404/410) se borran. */
    public int sendToUser(Long userId, String title, String body, String url) {
        if (!enabled) return 0;
        String payload;
        try {
            payload = mapper.writeValueAsString(Map.of(
                    "title", title,
                    "body", body == null ? "" : body,
                    "data", Map.of("url", url == null ? "./index.html" : url)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        int delivered = 0;
        for (PushSubscription sub : subscriptionRepository.findByUserId(userId)) {
            try {
                int status = sender.send(sub, payload);
                if (status == 404 || status == 410) {
                    subscriptionRepository.delete(sub);
                } else if (status >= 200 && status < 300) {
                    delivered++;
                } else {
                    log.warn("Push rechazado con estado {} para la suscripción {}", status, sub.getId());
                }
            } catch (Exception e) {
                log.warn("Fallo enviando push a la suscripción {}: {}", sub.getId(), e.getMessage());
            }
        }
        return delivered;
    }

    @Transactional
    public PushReminder schedule(AppUser user, String title, String body, String taskId, long sendAtEpochMillis) {
        if (isBlank(title)) throw new IllegalArgumentException("El recordatorio necesita un título.");
        LocalDateTime sendAt = LocalDateTime.ofInstant(Instant.ofEpochMilli(sendAtEpochMillis), ZoneId.systemDefault());
        if (sendAt.isAfter(LocalDateTime.now().plusYears(1))) {
            throw new IllegalArgumentException("La fecha del recordatorio es demasiado lejana.");
        }
        String safeTitle = title.length() > 255 ? title.substring(0, 255) : title;
        return reminderRepository.save(new PushReminder(user.getId(), safeTitle, body, taskId, sendAt));
    }

    public List<PushReminder> pendingFor(AppUser user) {
        return reminderRepository.findByUserIdAndSentAtIsNullOrderBySendAtAsc(user.getId());
    }

    @Transactional
    public boolean cancel(AppUser user, Long reminderId) {
        return reminderRepository.findById(reminderId)
                .filter(r -> r.getUserId().equals(user.getId()) && r.getSentAt() == null)
                .map(r -> { reminderRepository.delete(r); return true; })
                .orElse(false);
    }

    /** Cada 30 s: envía los recordatorios vencidos. Se marcan como enviados aunque no haya dispositivos, para no repetir. */
    @Scheduled(fixedDelayString = "${app.push.dispatch-interval-ms:30000}", initialDelay = 15000)
    @Transactional
    public int dispatchDueReminders() {
        List<PushReminder> due = reminderRepository.findBySentAtIsNullAndSendAtLessThanEqual(LocalDateTime.now());
        for (PushReminder r : due) {
            sendToUser(r.getUserId(), "⏰ " + r.getTitle(), r.getBody() == null || r.getBody().isBlank() ? "Es el momento de tu micro-paso." : r.getBody(), "./index.html#hacer");
            r.setSentAt(LocalDateTime.now());
        }
        return due.size();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
