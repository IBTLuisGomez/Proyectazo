package com.nexus.orb

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    private lateinit var videoView: VideoView
    private var isNavigated = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        videoView = findViewById(R.id.splashVideoView)
        val btnSkip: Button = findViewById(R.id.btnSkipSplash)
        val btnEnter: Button = findViewById(R.id.btnEnterApp)

        val videoUri = Uri.parse("android.resource://" + packageName + "/" + R.raw.nexus_orb_neon)
        videoView.setVideoURI(videoUri)

        videoView.setOnPreparedListener { mp ->
            mp.isLooping = false
            mp.setVolume(0f, 0f)
            videoView.start()
        }

        videoView.setOnCompletionListener {
            navigateToMain()
        }

        btnSkip.setOnClickListener {
            navigateToMain()
        }

        btnEnter.setOnClickListener {
            navigateToMain()
        }
    }

    private fun navigateToMain() {
        if (isNavigated) return
        isNavigated = true
        videoView.stopPlayback()
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }
}
