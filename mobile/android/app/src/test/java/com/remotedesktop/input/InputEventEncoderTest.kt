package com.remotedesktop.input

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class InputEventEncoderTest {

    @Test fun mouseMove_clampsAndSerialises() {
        val json = JSONObject(InputEventEncoder.mouseMove(0.5, 0.25))
        assertEquals("mousemove", json.getString("type"))
        assertEquals(0.5, json.getDouble("x"), 0.0)
        assertEquals(0.25, json.getDouble("y"), 0.0)
    }

    @Test fun mouseMove_clampsOutOfRange() {
        val json = JSONObject(InputEventEncoder.mouseMove(-1.0, 2.0))
        assertEquals(0.0, json.getDouble("x"), 0.0)
        assertEquals(1.0, json.getDouble("y"), 0.0)
    }

    @Test fun mouseDown_acceptsKnownButton() {
        val json = JSONObject(InputEventEncoder.mouseDown("right"))
        assertEquals("mousedown", json.getString("type"))
        assertEquals("right", json.getString("button"))
    }

    @Test fun mouseDown_rejectsUnknownButton() {
        try {
            InputEventEncoder.mouseDown("side")
            fail("expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("Unknown mouse button"))
        }
    }

    @Test fun click_serialisesAllFields() {
        val json = JSONObject(InputEventEncoder.click(0.1, 0.9, "left"))
        assertEquals("click", json.getString("type"))
        assertEquals(0.1, json.getDouble("x"), 0.0)
        assertEquals(0.9, json.getDouble("y"), 0.0)
        assertEquals("left", json.getString("button"))
    }

    @Test fun scroll_serialisesDeltas() {
        val json = JSONObject(InputEventEncoder.scroll(0, -120))
        assertEquals("scroll", json.getString("type"))
        assertEquals(0, json.getInt("dx"))
        assertEquals(-120, json.getInt("dy"))
    }

    @Test fun keyDown_includesModifiers() {
        val json = JSONObject(InputEventEncoder.keyDown("A", listOf("shift", "control")))
        assertEquals("keydown", json.getString("type"))
        assertEquals("A", json.getString("key"))
        val mods = json.getJSONArray("modifiers")
        assertEquals(2, mods.length())
        assertEquals("shift", mods.getString(0))
        assertEquals("control", mods.getString(1))
    }

    @Test fun keyDown_rejectsUnknownKey() {
        try {
            InputEventEncoder.keyDown("AltGr")
            fail("expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("Unknown key"))
        }
    }

    @Test fun keyDown_rejectsUnknownModifier() {
        try {
            InputEventEncoder.keyDown("A", listOf("hyper"))
            fail("expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("Unknown modifier"))
        }
    }

    @Test fun typeText_truncatesLongText() {
        val long = "x".repeat(InputEventEncoder.TYPE_TEXT_MAX_LENGTH + 100)
        val json = JSONObject(InputEventEncoder.typeText(long))
        assertEquals("type", json.getString("type"))
        assertEquals(InputEventEncoder.TYPE_TEXT_MAX_LENGTH, json.getString("text").length)
    }

    @Test fun typeText_rejectsEmpty() {
        try {
            InputEventEncoder.typeText("")
            fail("expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertNotNull(e.message)
        }
    }

    @Test fun ping_includesId() {
        val json = JSONObject(InputEventEncoder.ping(42))
        assertEquals("ping", json.getString("type"))
        assertEquals(42, json.getInt("id"))
    }

    @Test fun pong_includesId() {
        val json = JSONObject(InputEventEncoder.pong(0))
        assertEquals("pong", json.getString("type"))
        assertEquals(0, json.getInt("id"))
    }
}
