package com.nexus.orb

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.widget.Toast

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
