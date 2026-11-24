package com.nexus.orb

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.nexus.orb.notas.NotasStore
import com.nexus.orb.notas.NotasSync
import com.nexus.orb.notas.NotasWidgets
import org.json.JSONArray

class NexusNativeBridge(private val context: Context) {

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(durationMs.coerceAtLeast(10), VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(durationMs.coerceAtLeast(10))
            }
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    // ---------------- Listas de pendientes: enlace con los widgets (js/app/views/notas.js) ----------------

    /** La app web entrega sus listas cada vez que cambian; los widgets se repintan con ellas. */
    @JavascriptInterface
    fun publishNotas(json: String) {
        NotasStore.setNotas(context, json)
        NotasWidgets.refreshAll(context)
    }

    /** Dirección de la API y sesión, para que el widget pueda sincronizar con la app cerrada. Vacío = sin sesión. */
    @JavascriptInterface
    fun setSession(apiBase: String, token: String) {
        val changed = NotasStore.token(context) != token.trim() || NotasStore.apiBase(context) != apiBase.trim().trimEnd('/')
        NotasStore.setSession(context, apiBase, token)
        if (changed && token.isNotBlank()) NotasSync.enqueue(context)
    }

    /** Lo marcado o añadido en el widget que aún no llegó al servidor (JSON). */
    @JavascriptInterface
    fun getWidgetOps(): String = NotasStore.opsJson(context)

    /** La app web confirma qué operaciones ya aplicó (lista JSON de opId). */
    @JavascriptInterface
    fun ackWidgetOps(opIdsJson: String) {
        val ids = try {
            JSONArray(opIdsJson).let { array -> (0 until array.length()).map { array.optString(it) } }
        } catch (e: Exception) {
            emptyList()
        }
        NotasStore.removeOps(context, ids)
    }

    @JavascriptInterface
    fun getNativeVersion(): String = "1.1.0-kotlin"

    @JavascriptInterface
    fun isTablet(): Boolean {
        return context.resources.configuration.smallestScreenWidthDp >= 600
    }

    @JavascriptInterface
    fun getFormFactor(): String {
        val sw = context.resources.configuration.smallestScreenWidthDp
        val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        return when {
            sw >= 600 -> "tablet"
            landscape && sw >= 480 -> "tablet"
            else -> "phone"
        }
    }
}
