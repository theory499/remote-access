package com.remotedesktop.input

import org.json.JSONArray
import org.json.JSONObject

object InputEventEncoder {

    const val TYPE_TEXT_MAX_LENGTH: Int = 256

    val BUTTONS: Set<String> = setOf("left", "right", "middle")
    val MODIFIERS: Set<String> = setOf("control", "shift", "alt", "meta")
    val KEYS: Set<String> = buildSet {
        addAll(('A'..'Z').map { it.toString() })
        addAll((0..9).map { it.toString() })
        addAll(listOf("Space", "Enter", "Tab", "Backspace", "Delete", "Escape"))
        addAll(listOf("Left", "Right", "Up", "Down"))
        addAll(listOf("Home", "End", "PageUp", "PageDown"))
        addAll((1..12).map { "F$it" })
    }

    private fun normalised(value: Double): Double = value.coerceIn(0.0, 1.0)

    fun mouseMove(x: Double, y: Double): String =
        JSONObject().apply {
            put("type", "mousemove")
            put("x", normalised(x))
            put("y", normalised(y))
        }.toString()

    fun mouseDown(button: String): String {
        require(button in BUTTONS) { "Unknown mouse button: $button" }
        return JSONObject().apply {
            put("type", "mousedown")
            put("button", button)
        }.toString()
    }

    fun mouseUp(button: String): String {
        require(button in BUTTONS) { "Unknown mouse button: $button" }
        return JSONObject().apply {
            put("type", "mouseup")
            put("button", button)
        }.toString()
    }

    fun click(x: Double, y: Double, button: String): String {
        require(button in BUTTONS) { "Unknown mouse button: $button" }
        return JSONObject().apply {
            put("type", "click")
            put("x", normalised(x))
            put("y", normalised(y))
            put("button", button)
        }.toString()
    }

    fun scroll(dx: Int, dy: Int): String =
        JSONObject().apply {
            put("type", "scroll")
            put("dx", dx)
            put("dy", dy)
        }.toString()

    fun keyDown(key: String, modifiers: List<String> = emptyList()): String =
        keyEvent("keydown", key, modifiers)

    fun keyUp(key: String, modifiers: List<String> = emptyList()): String =
        keyEvent("keyup", key, modifiers)

    private fun keyEvent(type: String, key: String, modifiers: List<String>): String {
        require(key in KEYS) { "Unknown key: $key" }
        for (m in modifiers) require(m in MODIFIERS) { "Unknown modifier: $m" }
        return JSONObject().apply {
            put("type", type)
            put("key", key)
            put("modifiers", JSONArray(modifiers))
        }.toString()
    }

    fun typeText(text: String): String {
        require(text.isNotEmpty()) { "text must not be empty" }
        val truncated = if (text.length > TYPE_TEXT_MAX_LENGTH) text.substring(0, TYPE_TEXT_MAX_LENGTH) else text
        return JSONObject().apply {
            put("type", "type")
            put("text", truncated)
        }.toString()
    }

    fun ping(id: Int): String {
        require(id >= 0)
        return JSONObject().apply {
            put("type", "ping")
            put("id", id)
        }.toString()
    }

    fun pong(id: Int): String {
        require(id >= 0)
        return JSONObject().apply {
            put("type", "pong")
            put("id", id)
        }.toString()
    }
}
