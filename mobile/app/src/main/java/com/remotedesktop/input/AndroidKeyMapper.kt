package com.remotedesktop.input

import android.view.KeyEvent

object AndroidKeyMapper {

    fun toProtocolKey(keyCode: Int): String? {
        return when (keyCode) {
            in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z ->
                ('A' + (keyCode - KeyEvent.KEYCODE_A)).toString()
            in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 ->
                (keyCode - KeyEvent.KEYCODE_0).toString()
            KeyEvent.KEYCODE_SPACE -> "Space"
            KeyEvent.KEYCODE_ENTER -> "Enter"
            KeyEvent.KEYCODE_TAB -> "Tab"
            KeyEvent.KEYCODE_DEL -> "Backspace"
            KeyEvent.KEYCODE_FORWARD_DEL -> "Delete"
            KeyEvent.KEYCODE_ESCAPE -> "Escape"
            KeyEvent.KEYCODE_DPAD_LEFT -> "Left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "Right"
            KeyEvent.KEYCODE_DPAD_UP -> "Up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "Down"
            KeyEvent.KEYCODE_MOVE_HOME -> "Home"
            KeyEvent.KEYCODE_MOVE_END -> "End"
            KeyEvent.KEYCODE_PAGE_UP -> "PageUp"
            KeyEvent.KEYCODE_PAGE_DOWN -> "PageDown"
            in KeyEvent.KEYCODE_F1..KeyEvent.KEYCODE_F12 ->
                "F" + (keyCode - KeyEvent.KEYCODE_F1 + 1)
            else -> null
        }
    }

    fun toProtocolModifiers(metaState: Int): List<String> {
        val mods = mutableListOf<String>()
        if (metaState and KeyEvent.META_CTRL_ON != 0)  mods.add("control")
        if (metaState and KeyEvent.META_SHIFT_ON != 0) mods.add("shift")
        if (metaState and KeyEvent.META_ALT_ON != 0)   mods.add("alt")
        if (metaState and KeyEvent.META_META_ON != 0)  mods.add("meta")
        return mods
    }
}
