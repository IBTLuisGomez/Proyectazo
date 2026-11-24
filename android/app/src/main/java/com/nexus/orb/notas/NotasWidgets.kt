package com.nexus.orb.notas

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.nexus.orb.MainActivity
import com.nexus.orb.R

/** Piezas comunes de los dos widgets: repintado e intents. */
object NotasWidgets {
    const val ACTION_TOGGLE = "com.nexus.orb.notas.TOGGLE"
    const val EXTRA_NOTA_ID = "nota_id"
    const val EXTRA_ITEM_ID = "item_id"
    const val EXTRA_DONE = "done"

    private val immutable = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    // La plantilla de la lista se completa con los datos de cada fila: desde Android 12 debe ser mutable
    private val mutable = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)

    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        val ids = manager.getAppWidgetIds(ComponentName(context, NotasWidgetProvider::class.java))
        ids.forEach { renderLista(context, manager, it) }
        if (ids.isNotEmpty()) manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
        manager.getAppWidgetIds(ComponentName(context, QuickAddWidgetProvider::class.java))
            .forEach { renderQuickAdd(context, manager, it) }
    }

    fun renderLista(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val nota = NotasStore.notaForWidget(context, widgetId)
        val views = RemoteViews(context.packageName, R.layout.widget_notas)
        views.setTextViewText(R.id.widget_title_text, nota?.titulo ?: NotasStore.TITULO_POR_DEFECTO)
        val pendientes = nota?.pendientes?.size ?: 0
        views.setTextViewText(R.id.widget_count, when {
            nota == null -> context.getString(R.string.widget_sin_listas)
            nota.kind != "lista" -> ""
            pendientes == 0 -> context.getString(R.string.widget_todo_hecho)
            else -> context.resources.getQuantityString(R.plurals.widget_pendientes, pendientes, pendientes)
        })

        // Cada widget necesita un intent distinto (data) o Android reutiliza el adaptador del primero
        val adapter = Intent(context, NotasWidgetService::class.java)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        adapter.data = Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME))
        views.setRemoteAdapter(R.id.widget_list, adapter)
        views.setEmptyView(R.id.widget_list, R.id.widget_empty)

        val toggle = Intent(context, NotasWidgetProvider::class.java).setAction(ACTION_TOGGLE)
        views.setPendingIntentTemplate(R.id.widget_list, PendingIntent.getBroadcast(context, widgetId, toggle, mutable))

        val elegir = Intent(context, NotasWidgetConfigActivity::class.java)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            .setData(Uri.parse("nexus://widget/$widgetId"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        views.setOnClickPendingIntent(R.id.widget_title, PendingIntent.getActivity(context, widgetId, elegir, immutable))
        views.setOnClickPendingIntent(R.id.widget_add, quickAdd(context, widgetId, nota?.id))
        views.setOnClickPendingIntent(R.id.widget_open, openApp(context, widgetId, nota?.id))
        manager.updateAppWidget(widgetId, views)
    }

    fun renderQuickAdd(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_quick_add)
        views.setOnClickPendingIntent(R.id.quick_add_field, quickAdd(context, widgetId, null))
        views.setOnClickPendingIntent(R.id.quick_add_open, openApp(context, widgetId, null))
        manager.updateAppWidget(widgetId, views)
    }

    private fun quickAdd(context: Context, widgetId: Int, notaId: String?): PendingIntent {
        val intent = Intent(context, QuickAddActivity::class.java)
            .putExtra(EXTRA_NOTA_ID, notaId)
            .setData(Uri.parse("nexus://add/$widgetId"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        return PendingIntent.getActivity(context, widgetId, intent, immutable)
    }

    private fun openApp(context: Context, widgetId: Int, notaId: String?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_OPEN_NOTAS, true)
            .putExtra(MainActivity.EXTRA_OPEN_NOTA_ID, notaId)
            .setData(Uri.parse("nexus://open/$widgetId"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(context, widgetId, intent, immutable)
    }
}

/** Widget «Lista de pendientes»: una lista con casillas que se marcan sin abrir la app. */
class NotasWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { NotasWidgets.renderLista(context, manager, it) }
        manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
        // Cada 30 min (updatePeriodMillis) y al colocar el widget: traer cambios de otros dispositivos
        NotasSync.enqueue(context, goAsync())
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != NotasWidgets.ACTION_TOGGLE) {
            super.onReceive(context, intent)
            return
        }
        val notaId = intent.getStringExtra(NotasWidgets.EXTRA_NOTA_ID)
        val itemId = intent.getStringExtra(NotasWidgets.EXTRA_ITEM_ID)
        if (notaId.isNullOrBlank() || itemId.isNullOrBlank()) return
        NotasStore.setDone(context, notaId, itemId, intent.getBooleanExtra(NotasWidgets.EXTRA_DONE, true))
        NotasWidgets.refreshAll(context)
        NotasSync.enqueue(context, goAsync())
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        ids.forEach { NotasStore.forgetWidget(context, it) }
    }
}

/** Widget «Añadir pendiente»: una barra que abre el cuadro de captura rápida. */
class QuickAddWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { NotasWidgets.renderQuickAdd(context, manager, it) }
    }
}

/** Filas del widget de lista: primero lo pendiente, debajo lo completado (tachado). */
class NotasWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
        Factory(applicationContext, intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID))

    private class Row(val notaId: String, val itemId: String?, val text: String, val done: Boolean)

    private class Factory(private val context: Context, private val widgetId: Int) : RemoteViewsFactory {
        private var rows: List<Row> = emptyList()

        override fun onCreate() {}

        override fun onDataSetChanged() {
            val nota = NotasStore.notaForWidget(context, widgetId)
            rows = when {
                nota == null -> emptyList()
                nota.kind != "lista" && nota.items.isEmpty() ->
                    if (nota.text.isBlank()) emptyList() else listOf(Row(nota.id, null, nota.text, false))
                else -> nota.items.sortedBy { it.done }.map { Row(nota.id, it.id, it.text, it.done) }
            }
        }

        override fun onDestroy() {
            rows = emptyList()
        }

        override fun getCount(): Int = rows.size

        override fun getViewAt(position: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_notas_item)
            val row = rows.getOrNull(position) ?: return views
            views.setTextViewText(R.id.item_text, row.text)
            if (row.itemId == null) {
                // Nota de texto: sin casilla y no se puede marcar
                views.setViewVisibility(R.id.item_check, View.GONE)
                views.setInt(R.id.item_text, "setMaxLines", 12)
                return views
            }
            views.setViewVisibility(R.id.item_check, View.VISIBLE)
            views.setInt(R.id.item_text, "setMaxLines", 3)
            views.setImageViewResource(R.id.item_check, if (row.done) R.drawable.ic_widget_check_on else R.drawable.ic_widget_check_off)
            views.setInt(R.id.item_text, "setPaintFlags",
                Paint.ANTI_ALIAS_FLAG or (if (row.done) Paint.STRIKE_THRU_TEXT_FLAG else 0))
            views.setTextColor(R.id.item_text, context.getColor(if (row.done) R.color.widget_text_muted else R.color.widget_text))
            views.setContentDescription(R.id.item_check,
                context.getString(if (row.done) R.string.widget_desmarcar else R.string.widget_marcar))
            views.setOnClickFillInIntent(R.id.item_root, Intent()
                .putExtra(NotasWidgets.EXTRA_NOTA_ID, row.notaId)
                .putExtra(NotasWidgets.EXTRA_ITEM_ID, row.itemId)
                .putExtra(NotasWidgets.EXTRA_DONE, !row.done))
            return views
        }

        override fun getLoadingView(): RemoteViews? = null

        override fun getViewTypeCount(): Int = 1

        override fun getItemId(position: Int): Long = rows.getOrNull(position)?.let { (it.itemId ?: it.notaId).hashCode().toLong() } ?: position.toLong()

        override fun hasStableIds(): Boolean = true
    }
}
