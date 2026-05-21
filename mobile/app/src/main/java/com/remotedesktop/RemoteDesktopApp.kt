package com.remotedesktop

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase

class RemoteDesktopApp : Application() {

    val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    val database: FirebaseDatabase by lazy { FirebaseDatabase.getInstance() }

    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        database.setPersistenceEnabled(false)
    }
}
