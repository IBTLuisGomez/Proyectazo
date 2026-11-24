package com.nexus.orb.notas

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ListView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.nexus.orb.R

/**
 * Cuadro de captura rápida que abren los widgets: escribir, Enter y seguir con el siguiente.
 * No necesita red ni que la app esté abierta; el pendiente se envía después.
 */
class QuickAddActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_add)
        setFinishOnTouchOutside(true)

        val notaId = intent.getStringExtra(NotasWidgets.EXTRA_NOTA_ID)
        val destino = NotasStore.notas(this).let { all ->
            all.firstOrNull { it.id == notaId && it.kind == "lista" } ?: all.firstOrNull { it.kind == "lista" }
        }
        findViewById<TextView>(R.id.quick_add_title).text =
            getString(R.string.quick_add_titulo, destino?.titulo ?: NotasStore.TITULO_POR_DEFECTO)

        val field = findViewById<EditText>(R.id.quick_add_text)
        val status = findViewById<TextView>(R.id.quick_add_status)

        fun add() {
            val text = field.text.toString().trim()
            if (text.isEmpty()) return
            // Siempre a la misma lista, aunque entre medias cambie cuál es la primera
            val titulo = NotasStore.addItem(this, destino?.id ?: notaId, text)
            field.setText("")
            status.text = getString(R.string.quick_add_hecho, text, titulo)
            status.visibility = View.VISIBLE
            NotasWidgets.refreshAll(this)
            NotasSync.enqueue(this)
        }

        field.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                add()
                true
            } else {
                false
            }
        }
        findViewById<Button>(R.id.quick_add_button).setOnClickListener { add() }
        findViewById<Button>(R.id.quick_add_close).setOnClickListener { finish() }
        field.requestFocus()
    }
}

/** Elegir qué lista enseña un widget (al colocarlo o al tocar su título). */
class NotasWidgetConfigActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Si se sale sin elegir al colocar el widget, Android no lo añade
        setResult(RESULT_CANCELED)
        val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        setContentView(R.layout.activity_widget_config)
        setFinishOnTouchOutside(true)

        fun done(notaId: String?) {
            NotasStore.setWidgetNota(this, widgetId, notaId)
            val manager = AppWidgetManager.getInstance(this)
            NotasWidgets.renderLista(this, manager, widgetId)
            manager.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
            finish()
        }

        val notas = NotasStore.notas(this)
        val list = findViewById<ListView>(R.id.config_list)
        val empty = findViewById<TextView>(R.id.config_empty)
        val accept = findViewById<Button>(R.id.config_accept)
        if (notas.isEmpty()) {
            // Sin listas todavía: el widget se coloca igual y enseñará la primera que se cree
            list.visibility = View.GONE
            empty.visibility = View.VISIBLE
            accept.visibility = View.VISIBLE
            accept.setOnClickListener { done(null) }
            return
        }
        list.adapter = ArrayAdapter(this, R.layout.item_widget_config, notas.map { it.titulo })
        list.setOnItemClickListener { _, _, position, _ -> done(notas[position].id) }
    }
}
