package com.remotedesktop.config

import org.json.JSONObject

data class FirebaseConfig(
    val apiKey: String,
    val applicationId: String,
    val projectId: String,
    val databaseURL: String
) {
    companion object {
        const val PAYLOAD_VERSION = 1

        fun fromQrPayload(raw: String): FirebaseConfig? {
            return try {
                val obj = JSONObject(raw)
                if (obj.optInt("v", -1) != PAYLOAD_VERSION) return null
                if (obj.optString("backend") != "firebase") return null
                val android = obj.optJSONObject("android") ?: return null
                FirebaseConfig(
                    apiKey = android.optString("apiKey").takeIf { it.isNotBlank() } ?: return null,
                    applicationId = android.optString("applicationId").takeIf { it.isNotBlank() } ?: return null,
                    projectId = android.optString("projectId").takeIf { it.isNotBlank() } ?: return null,
                    databaseURL = android.optString("databaseURL").takeIf { it.isNotBlank() } ?: return null
                )
            } catch (_: Exception) {
                null
            }
        }
    }

    fun toJson(): String =
        JSONObject().apply {
            put("apiKey", apiKey)
            put("applicationId", applicationId)
            put("projectId", projectId)
            put("databaseURL", databaseURL)
        }.toString()
}
