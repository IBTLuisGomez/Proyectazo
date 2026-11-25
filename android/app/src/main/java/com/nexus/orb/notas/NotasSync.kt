package com.nexus.orb.notas

import android.content.BroadcastReceiver
import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * Sincronización del widget con el servidor sin abrir la app: envía lo pendiente y trae las listas.
 * Sin sesión o sin red no hace nada; lo pendiente se queda guardado para el siguiente intento.
 * Solo usa GET, POST y PUT (HttpURLConnection no admite PATCH).
 */
object NotasSync {
    private val executor = Executors.newSingleThreadExecutor()
    private const val CONNECT_TIMEOUT_MS = 4000
    private const val READ_TIMEOUT_MS = 5000

    /**
     * Lanza la sincronización en segundo plano y repinta los widgets al terminar.
     * Desde un BroadcastReceiver, pasar `goAsync()` para que el sistema no mate el proceso a medias.
     */
    fun enqueue(context: Context, pending: BroadcastReceiver.PendingResult? = null) {
        val app = context.applicationContext
        executor.execute {
            try {
                if (sync(app)) NotasWidgets.refreshAll(app)
            } catch (e: Exception) {
                // Sin red o respuesta inesperada: se reintenta en la siguiente actualización del widget
            } finally {
                pending?.finish()
            }
        }
    }

    private fun sync(context: Context): Boolean {
        val base = NotasStore.apiBase(context)
        val token = NotasStore.token(context)
        if (base.isBlank() || token.isBlank()) return false

        for (op in NotasStore.ops(context)) {
            val at = op.optString("at")
            val notaId = enc(op.optString("notaId"))
            val status = when (op.optString("type")) {
                "done" -> request("PUT", "$base/notas/$notaId/items/${enc(op.optString("itemId"))}", token,
                    JSONObject().put("done", op.optBoolean("done")).put("updatedAt", at))
                "add" -> request("POST", "$base/notas/$notaId/items", token,
                    JSONObject().put("id", op.optString("itemId")).put("text", op.optString("text")).put("updatedAt", at))
                "nota" -> request("POST", "$base/notas", token, op.optJSONObject("nota") ?: JSONObject())
                // El servidor ignora un segundo envío con el mismo id: reintentar no duplica
                "pensamiento" -> request("POST", "$base/pensadero", token,
                    JSONObject().put("id", op.optString("id")).put("content", op.optString("text")))
                else -> 400 to null
            }.first
            when {
                // Hecho, o ya no tiene sentido (la lista o el pendiente se borraron en otro dispositivo)
                status in 200..299 || status == 400 || status == 404 -> NotasStore.removeOps(context, listOf(op.optString("opId")))
                // Sesión caducada, sin red o servidor caído: se conserva para más tarde
                else -> return false
            }
        }

        val (status, body) = request("GET", "$base/notas", token, null)
        if (status != 200 || body == null) return false
        NotasStore.setNotas(context, body)
        return true
    }

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")

    private fun request(method: String, url: String, token: String, body: JSONObject?): Pair<Int, String?> {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Accept", "application/json")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                }
            }
            val status = connection.responseCode
            val text = if (status in 200..299) connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() } else null
            status to text
        } catch (e: Exception) {
            -1 to null
        } finally {
            connection?.disconnect()
        }
    }
}
