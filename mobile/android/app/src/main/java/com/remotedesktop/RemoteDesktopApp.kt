package com.remotedesktop

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.remotedesktop.config.ConfigStore
import com.remotedesktop.config.FirebaseConfig

class RemoteDesktopApp : Application() {

    val configStore: ConfigStore by lazy { ConfigStore(this) }

    @Volatile private var initialised: FirebaseApp? = null

    override fun onCreate() {
        super.onCreate()
        configStore.load()?.let { initialiseFirebase(it) }
    }

    @Synchronized
    fun initialiseFirebase(config: FirebaseConfig): FirebaseApp {
        initialised?.let { return it }
        val options = FirebaseOptions.Builder()
            .setApiKey(config.apiKey)
            .setApplicationId(config.applicationId)
            .setProjectId(config.projectId)
            .setDatabaseUrl(config.databaseURL)
            .build()
        val app = if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this, options)
        } else {
            FirebaseApp.getInstance()
        }
        FirebaseDatabase.getInstance(app).setPersistenceEnabled(false)
        initialised = app
        return app
    }

    fun isFirebaseInitialised(): Boolean = initialised != null

    val auth: FirebaseAuth
        get() = FirebaseAuth.getInstance(requireFirebaseApp())

    val database: FirebaseDatabase
        get() = FirebaseDatabase.getInstance(requireFirebaseApp())

    private fun requireFirebaseApp(): FirebaseApp =
        initialised ?: throw IllegalStateException("Firebase not initialised - scan the QR code first")
}
