package com.remotedesktop.input

object PairingCode {

    private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private const val LENGTH = 6
    private val regex = Regex("^[" + Regex.escape(ALPHABET) + "]{$LENGTH}$")

    fun normalise(raw: String): String =
        raw.trim().uppercase().filter { it in ALPHABET }.take(LENGTH)

    fun isValid(code: String): Boolean = regex.matches(code)
}
