package com.proyectazo.push;

import com.proyectazo.model.PushSubscription;

/** Envía un mensaje cifrado a un servicio de push (FCM, Mozilla, WNS…). Devuelve el código HTTP. */
public interface PushSender {

    void configure(String vapidPublicKey, String vapidPrivateKey, String subject) throws Exception;

    int send(PushSubscription subscription, String payloadJson) throws Exception;
}
