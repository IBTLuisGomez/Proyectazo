package com.nexus.orb.notas

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

data class NotaItem(val id: String, val text: String, val done: Boolean)

data class Nota(
    val id: String,
    val title: String,
    val kind: String,
    val text: String,
    val items: List<NotaItem>
) {
    val pendientes: List<NotaItem> get() = items.filter { !it.done }
    val titulo: String get() = title.ifBlank { if (kind == "lista") "Lista sin título" else "Nota" }
}

/**
 * Copia local de las listas para los widgets (funcionan con la app cerrada y sin red).
 *
 * - `notas`: lo último que publicó la app web o devolvió el servidor, con los cambios pendientes ya aplicados.
 * - `ops`: lo marcado o añadido en el widget que aún no ha llegado al servidor. Se envía desde
 *   [NotasSync] o lo recoge la app web al abrirse (NexusNative.getWidgetOps); las operaciones llevan
 *   valores explícitos, así que aplicarlas dos veces no cambia nada.
 *
 * El formato de notas y operaciones es el de js/notas-core.js.
 */
object NotasStore {
    private const val PREFS = "NexusNotas"
    private const val KEY_NOTAS = "notas"
    private const val KEY_OPS = "ops"
    private const val KEY_API = "api_base"
    private const val KEY_TOKEN = "token"
    private const val KEY_WIDGET = "widget_"
    const val TITULO_POR_DEFECTO = "Pendientes"

    private val lock = Any()
    private val isoFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun now(): String = isoFormat.format(Instant.now())

    private fun newId(prefix: String): String = "$prefix-" + UUID.randomUUID().toString().replace("-", "").take(12)

    private fun parseArray(text: String?): JSONArray =
        try {
            JSONArray(text ?: "[]")
        } catch (e: Exception) {
            JSONArray()
        }

    // ---------------- Sesión (la entrega la app web tras iniciar sesión) ----------------
    fun setSession(context: Context, apiBase: String, token: String) {
        val base = apiBase.trim().trimEnd('/')
        val valid = base.startsWith("http://") || base.startsWith("https://")
        prefs(context).edit()
            .putString(KEY_API, if (valid) base else "")
            .putString(KEY_TOKEN, if (valid) token.trim() else "")
            .apply()
    }

    fun apiBase(context: Context): String = prefs(context).getString(KEY_API, "") ?: ""

    fun token(context: Context): String = prefs(context).getString(KEY_TOKEN, "") ?: ""

    // ---------------- Lectura ----------------
    fun notas(context: Context): List<Nota> = synchronized(lock) {
        val array = parseArray(prefs(context).getString(KEY_NOTAS, "[]"))
        (0 until array.length()).mapNotNull { toNota(array.optJSONObject(it)) }
    }

    private fun toNota(json: JSONObject?): Nota? {
        if (json == null || json.optBoolean("deleted") || json.optBoolean("archived")) return null
        val id = json.optString("id")
        if (id.isBlank()) return null
        val array = json.optJSONArray("items") ?: JSONArray()
        val items = (0 until array.length()).mapNotNull { i ->
            val item = array.optJSONObject(i) ?: return@mapNotNull null
            if (item.optBoolean("deleted") || item.optString("id").isBlank()) null
            else NotaItem(item.optString("id"), item.optString("text"), item.optBoolean("done"))
        }
        return Nota(id, json.optString("title"), json.optString("kind", "lista"), json.optString("text"), items)
    }

    /** Lista elegida para un widget; si no hay (o se borró), la primera lista. */
    fun notaForWidget(context: Context, widgetId: Int): Nota? {
        val all = notas(context)
        val chosen = prefs(context).getString(KEY_WIDGET + widgetId, null)
        return all.firstOrNull { it.id == chosen } ?: defaultNota(all)
    }

    private fun defaultNota(all: List<Nota>): Nota? = all.firstOrNull { it.kind == "lista" } ?: all.firstOrNull()

    fun setWidgetNota(context: Context, widgetId: Int, notaId: String?) {
        prefs(context).edit().apply {
            if (notaId == null) remove(KEY_WIDGET + widgetId) else putString(KEY_WIDGET + widgetId, notaId)
        }.apply()
    }

    // ---------------- Escritura ----------------
    /** Sustituye la copia por la de la web o el servidor y vuelve a aplicar encima lo pendiente de enviar. */
    fun setNotas(context: Context, json: String) = synchronized(lock) {
        val notas = parseArray(json)
        val ops = parseArray(prefs(context).getString(KEY_OPS, "[]"))
        for (i in 0 until ops.length()) ops.optJSONObject(i)?.let { applyOp(notas, it) }
        prefs(context).edit().putString(KEY_NOTAS, notas.toString()).apply()
    }

    fun setDone(context: Context, notaId: String, itemId: String, done: Boolean) {
        addOp(context, JSONObject()
            .put("type", "done").put("notaId", notaId).put("itemId", itemId).put("done", done))
    }

    /** Añade un pendiente a la lista indicada o, sin ella, a la primera lista (creando «Pendientes» si no hay). */
    fun addItem(context: Context, notaId: String?, text: String): String {
        val clean = text.trim().take(2000)
        if (clean.isEmpty()) return ""
        val all = notas(context)
        val target = all.firstOrNull { it.id == notaId && it.kind == "lista" } ?: all.firstOrNull { it.kind == "lista" }
        val stamp = now()
        if (target == null) {
            val item = JSONObject().put("id", newId("i")).put("text", clean).put("done", false).put("updatedAt", stamp)
            val nota = JSONObject()
                .put("id", newId("n")).put("kind", "lista").put("title", TITULO_POR_DEFECTO).put("text", "")
                .put("color", "ninguno").put("pinned", false).put("archived", false).put("deleted", false)
                .put("items", JSONArray().put(item))
                .put("createdAt", stamp).put("updatedAt", stamp).put("metaAt", stamp)
            addOp(context, JSONObject().put("type", "nota").put("nota", nota))
            return TITULO_POR_DEFECTO
        }
        addOp(context, JSONObject()
            .put("type", "add").put("notaId", target.id).put("itemId", newId("i")).put("text", clean))
        return target.titulo
    }

    /**
     * Pensamiento capturado en el widget «Soltar». No toca las listas: viaja como operación hasta el
     * Pensadero (POST /api/pensadero, o la app web al abrirse, que además lo clasifica).
     */
    fun addPensamiento(context: Context, text: String): Boolean {
        val clean = text.trim().take(2000)
        if (clean.isEmpty()) return false
        addOp(context, JSONObject().put("type", "pensamiento").put("id", newId("pen")).put("text", clean))
        return true
    }

    private fun addOp(context: Context, op: JSONObject) = synchronized(lock) {
        op.put("opId", newId("op"))
        if (!op.has("at")) op.put("at", now())
        val p = prefs(context)
        val ops = parseArray(p.getString(KEY_OPS, "[]")).put(op)
        val notas = parseArray(p.getString(KEY_NOTAS, "[]"))
        applyOp(notas, op)
        p.edit().putString(KEY_OPS, ops.toString()).putString(KEY_NOTAS, notas.toString()).apply()
    }

    fun ops(context: Context): List<JSONObject> = synchronized(lock) {
        val array = parseArray(prefs(context).getString(KEY_OPS, "[]"))
        (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }

    fun opsJson(context: Context): String = synchronized(lock) {
        prefs(context).getString(KEY_OPS, "[]") ?: "[]"
    }

    fun removeOps(context: Context, opIds: Collection<String>) = synchronized(lock) {
        if (opIds.isEmpty()) return@synchronized
        val p = prefs(context)
        val current = parseArray(p.getString(KEY_OPS, "[]"))
        val kept = JSONArray()
        for (i in 0 until current.length()) {
            val op = current.optJSONObject(i) ?: continue
            if (op.optString("opId") !in opIds) kept.put(op)
        }
        p.edit().putString(KEY_OPS, kept.toString()).apply()
    }

    // La misma regla que NotasCore.aplicarOperacion (js/notas-core.js)
    private fun applyOp(notas: JSONArray, op: JSONObject) {
        val at = op.optString("at")
        if (op.optString("type") == "nota") {
            val nota = op.optJSONObject("nota") ?: return
            if (find(notas, nota.optString("id")) == null) notas.put(JSONObject(nota.toString()))
            return
        }
        val nota = find(notas, op.optString("notaId")) ?: return
        if (nota.optBoolean("deleted")) return
        val items = nota.optJSONArray("items") ?: JSONArray().also { nota.put("items", it) }
        when (op.optString("type")) {
            "add" -> {
                val itemId = op.optString("itemId")
                if (itemId.isBlank() || find(items, itemId) != null) return
                items.put(JSONObject().put("id", itemId).put("text", op.optString("text")).put("done", false).put("updatedAt", at))
            }
            "done" -> {
                val item = find(items, op.optString("itemId")) ?: return
                // Las fechas ISO en UTC con el mismo formato se pueden comparar como texto
                if (item.optBoolean("deleted") || at < item.optString("updatedAt")) return
                item.put("done", op.optBoolean("done")).put("updatedAt", at)
            }
        }
    }

    private fun find(array: JSONArray, id: String): JSONObject? {
        if (id.isBlank()) return null
        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i) ?: continue
            if (item.optString("id") == id) return item
        }
        return null
    }

    fun forgetWidget(context: Context, widgetId: Int) = setWidgetNota(context, widgetId, null)
}
