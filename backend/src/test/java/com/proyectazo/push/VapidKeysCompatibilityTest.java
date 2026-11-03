package com.proyectazo.push;

import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.client.methods.HttpPost;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Security;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprueba que las claves VAPID que generamos tienen el formato que espera la librería web-push:
 * se cifra un mensaje real para una suscripción simulada de navegador (sin enviarlo a la red).
 */
class VapidKeysCompatibilityTest {

    private static String uncompressedPoint(ECPublicKey key) {
        byte[] point = new byte[65];
        point[0] = 0x04;
        System.arraycopy(fixed32(key.getW().getAffineX()), 0, point, 1, 32);
        System.arraycopy(fixed32(key.getW().getAffineY()), 0, point, 33, 32);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(point);
    }

    private static byte[] fixed32(BigInteger v) {
        byte[] raw = v.toByteArray();
        byte[] out = new byte[32];
        int n = Math.min(raw.length, 32);
        System.arraycopy(raw, raw.length - n, out, 32 - n, n);
        return out;
    }

    @Test
    void generatedKeysEncryptAndSignAPushMessage() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        String[] vapid = PushNotificationService.generateVapidKeys();
        PushService service = new PushService(vapid[0], vapid[1]);
        service.setSubject("mailto:test@localhost");

        // Lo que entregaría PushManager.subscribe() en el navegador
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair browser = g.generateKeyPair();
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);

        Notification notification = new Notification(
                "https://fcm.googleapis.com/fcm/send/prueba",
                uncompressedPoint((ECPublicKey) browser.getPublic()),
                Base64.getUrlEncoder().withoutPadding().encodeToString(auth),
                "{\"title\":\"hola\"}".getBytes(StandardCharsets.UTF_8));

        HttpPost post = service.preparePost(notification, Encoding.AES128GCM);
        assertEquals("aes128gcm", post.getFirstHeader("Content-Encoding").getValue());
        assertTrue(post.getFirstHeader("Authorization").getValue().startsWith("vapid t="), "firma VAPID presente");
        assertTrue(post.getEntity().getContentLength() > 0, "cuerpo cifrado presente");
        assertEquals(87, vapid[0].length());
        assertEquals(43, vapid[1].length());
    }
}
