package com.remotedesktop.config

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

class ConfigStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(): FirebaseConfig? {
        val raw = prefs.getString(KEY_PAYLOAD, null) ?: return null
        return try {
            val obj = JSONObject(raw)
            FirebaseConfig(
                apiKey = obj.getString("apiKey"),
                applicationId = obj.getString("applicationId"),
                projectId = obj.getString("projectId"),
                databaseURL = obj.getString("databaseURL")
            )
        } catch (_: Exception) {
            null
        }
    }

    fun save(config: FirebaseConfig) {
        prefs.edit().putString(KEY_PAYLOAD, config.toJson()).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_PAYLOAD).apply()
    }

    fun exists(): Boolean = prefs.contains(KEY_PAYLOAD)

    companion object {
        const val PREFS_NAME = "backend_config"
        const val KEY_PAYLOAD = "firebase_payload_v1"
    }
}
