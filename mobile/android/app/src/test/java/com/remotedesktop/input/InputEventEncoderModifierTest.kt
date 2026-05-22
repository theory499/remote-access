package com.remotedesktop.input

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class InputEventEncoderModifierTest {

    @Test fun keyUpDoesNotIncludeModifiersByDefault() {
        val json = JSONObject(InputEventEncoder.keyUp("A"))
        assertEquals(0, json.getJSONArray("modifiers").length())
    }

    @Test fun keyUpAcceptsExplicitEmptyModifiers() {
        val json = JSONObject(InputEventEncoder.keyUp("A", emptyList()))
        assertEquals(0, json.getJSONArray("modifiers").length())
    }

    @Test fun keyDownPreservesModifierOrder() {
        val json = JSONObject(InputEventEncoder.keyDown("A", listOf("control", "shift", "alt")))
        val mods = json.getJSONArray("modifiers")
        assertEquals("control", mods.getString(0))
        assertEquals("shift", mods.getString(1))
        assertEquals("alt", mods.getString(2))
    }
}
