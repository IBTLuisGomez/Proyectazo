package com.proyectazo.push;

import com.proyectazo.model.PushSubscription;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Security;

@Component
public class WebPushSender implements PushSender {

    private volatile PushService pushService;

    @Override
    public void configure(String vapidPublicKey, String vapidPrivateKey, String subject) throws Exception {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        PushService service = new PushService(vapidPublicKey, vapidPrivateKey);
        service.setSubject(subject);
        this.pushService = service;
    }

    @Override
    public int send(PushSubscription subscription, String payloadJson) throws Exception {
        if (pushService == null) throw new IllegalStateException("Web Push no está configurado");
        Notification notification = new Notification(
                subscription.getEndpoint(),
                subscription.getP256dh(),
                subscription.getAuth(),
                payloadJson.getBytes(StandardCharsets.UTF_8));
        HttpResponse response = pushService.send(notification);
        return response.getStatusLine().getStatusCode();
    }
}
