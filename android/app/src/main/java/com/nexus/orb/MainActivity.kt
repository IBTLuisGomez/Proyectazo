package com.nexus.orb

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar

    private val RECORD_AUDIO_REQUEST_CODE = 101
    private var pendingPermissionRequest: PermissionRequest? = null

    // Default URL to connect to current host IP
    private val DEFAULT_URL = "http://192.168.100.13:8000"
    private val PREFS_NAME = "NexusOrbPrefs"
    private val KEY_SERVER_URL = "server_url"

    // Lista que pidió abrir un widget; se abre cuando la página termina de cargar
    private var pendingNotaId: String? = null
    private var pageReady = false

    companion object {
        const val EXTRA_OPEN_NOTAS = "open_notas"
        const val EXTRA_OPEN_NOTA_ID = "open_nota_id"
    }

    private fun getServerUrl(): String {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        return prefs.getString(KEY_SERVER_URL, DEFAULT_URL) ?: DEFAULT_URL
    }

    private fun setServerUrl(newUrl: String) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putString(KEY_SERVER_URL, newUrl).apply()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        setupWebView()
        setupBackNavigation()

        checkAudioPermissions()

        val url = getServerUrl()
        if (intent?.getBooleanExtra(EXTRA_OPEN_NOTAS, false) == true) {
            pendingNotaId = safeId(intent.getStringExtra(EXTRA_OPEN_NOTA_ID))
            webView.loadUrl(if (url.contains("#")) url else "$url#notas")
        } else {
            webView.loadUrl(url)
        }
    }

    // La app ya estaba abierta y se toca un widget
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!intent.getBooleanExtra(EXTRA_OPEN_NOTAS, false)) return
        pendingNotaId = safeId(intent.getStringExtra(EXTRA_OPEN_NOTA_ID))
        if (pageReady) openNotasInPage()
    }

    override fun onResume() {
        super.onResume()
        // Recoger lo marcado o añadido en los widgets mientras la app estaba en segundo plano
        if (pageReady) {
            webView.evaluateJavascript("if(typeof app!=='undefined'&&app&&app.recogerCambiosDelWidget)app.recogerCambiosDelWidget();", null)
        }
    }

    // El id viaja dentro de un fragmento de JavaScript: solo los caracteres que generan la web y el widget
    private fun safeId(id: String?): String = (id ?: "").filter { it.isLetterOrDigit() || it == '-' || it == '_' }

    // La variable global de la web (app) se declara con let: existe, pero no como window.app
    private fun openNotasInPage() {
        val id = pendingNotaId ?: return
        pendingNotaId = null
        webView.evaluateJavascript("if(typeof app!=='undefined'&&app&&app.abrirDesdeWidget)app.abrirDesdeWidget('$id');", null)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.textZoom = 100
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }
        webView.setInitialScale(0)

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        // Native JavaScript bridge
        webView.addJavascriptInterface(NexusNativeBridge(this), "NexusNative")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
                pageReady = false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                injectFormFactor()
                pageReady = true
                openNotasInPage()
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                showServerConfigDialog("Error al conectar: $description")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.let {
                    val requestedResources = it.resources
                    if (requestedResources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        pendingPermissionRequest = it
                        if (hasAudioPermission()) {
                            it.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                        } else {
                            ActivityCompat.requestPermissions(
                                this@MainActivity,
                                arrayOf(Manifest.permission.RECORD_AUDIO),
                                RECORD_AUDIO_REQUEST_CODE
                            )
                        }
                    } else {
                        it.deny()
                    }
                }
            }
        }
    }

    private fun injectFormFactor() {
        val form = if (resources.configuration.smallestScreenWidthDp >= 600) "tablet" else "phone"
        val js = "document.documentElement.dataset.native='android';" +
            "document.documentElement.dataset.form='$form';" +
            "if(window.app&&app.applyFormFactor)app.applyFormFactor();"
        webView.evaluateJavascript(js, null)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        injectFormFactor()
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun hasAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun checkAudioPermissions() {
        if (!hasAudioPermission()) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                RECORD_AUDIO_REQUEST_CODE
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RECORD_AUDIO_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingPermissionRequest?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                pendingPermissionRequest?.deny()
            }
            pendingPermissionRequest = null
        }
    }

    private fun showServerConfigDialog(message: String) {
        val input = android.widget.EditText(this)
        input.setText(getServerUrl())
        input.setSingleLine(true)

        android.app.AlertDialog.Builder(this)
            .setTitle("Configurar Conexión Nexus Orb")
            .setMessage("$message\n\nVerifica que tu celular esté en el mismo Wi-Fi y especifica la IP de tu PC:")
            .setView(input)
            .setPositiveButton("Conectar") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    setServerUrl(newUrl)
                    webView.loadUrl(newUrl)
                }
            }
            .setNeutralButton("IP Actual (192.168.100.13)") { _, _ ->
                val defUrl = "http://192.168.100.13:8000"
                setServerUrl(defUrl)
                webView.loadUrl(defUrl)
            }
            .setNegativeButton("Reintentar") { _, _ ->
                webView.reload()
            }
            .setCancelable(true)
            .show()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
