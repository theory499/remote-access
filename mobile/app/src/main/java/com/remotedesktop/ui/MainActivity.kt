package com.remotedesktop.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.remotedesktop.R
import com.remotedesktop.RemoteDesktopApp
import com.remotedesktop.databinding.ActivityMainBinding
import com.remotedesktop.input.PairingCode

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var auth: FirebaseAuth

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        auth = (application as RemoteDesktopApp).auth
        binding.connectButton.isEnabled = false
        binding.statusText.text = getString(R.string.status_signing_in)
        binding.progress.visibility = View.VISIBLE

        signIn()

        binding.codeInput.addTextChangedListener(object : TextWatcher {
            private var muted = false
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (muted || s == null) return
                val current = s.toString()
                val normalised = PairingCode.normalise(current)
                if (normalised != current) {
                    muted = true
                    s.replace(0, s.length, normalised)
                    muted = false
                }
                binding.connectButton.isEnabled = PairingCode.isValid(normalised)
            }
        })

        binding.connectButton.setOnClickListener {
            val code = PairingCode.normalise(binding.codeInput.text?.toString().orEmpty())
            if (!PairingCode.isValid(code)) {
                Toast.makeText(this, R.string.error_invalid_code, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            startActivity(Intent(this, RemoteControlActivity::class.java).apply {
                putExtra(RemoteControlActivity.EXTRA_SESSION_CODE, code)
            })
        }
    }

    private fun signIn() {
        val current = auth.currentUser
        if (current != null) {
            onSignedIn()
            return
        }
        auth.signInAnonymously().addOnCompleteListener(this) { task ->
            if (task.isSuccessful) onSignedIn()
            else onSignInFailed(task.exception?.localizedMessage)
        }
    }

    private fun onSignedIn() {
        binding.progress.visibility = View.GONE
        binding.statusText.text = getString(R.string.status_signed_in, auth.currentUser?.uid?.take(8) ?: "?")
        binding.connectButton.isEnabled = PairingCode.isValid(binding.codeInput.text?.toString().orEmpty())
    }

    private fun onSignInFailed(reason: String?) {
        binding.progress.visibility = View.GONE
        binding.statusText.text = getString(R.string.status_sign_in_failed, reason ?: "unknown")
        binding.connectButton.isEnabled = false
    }
}
