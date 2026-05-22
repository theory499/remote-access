package com.remotedesktop.input

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingCodeTest {

    @Test fun normaliseUpperCasesAndStrips() {
        assertEquals("ABCDEF", PairingCode.normalise("  abcdef  "))
        assertEquals("ABCDEF", PairingCode.normalise("a-b c d-e f"))
    }

    @Test fun normaliseFiltersAmbiguousCharacters() {
        assertEquals("ABCDEF", PairingCode.normalise("AB0C1DOIE1F"))
    }

    @Test fun normaliseTakesAtMostSix() {
        assertEquals("ABCDEF", PairingCode.normalise("ABCDEFGHIJ"))
    }

    @Test fun isValidAcceptsCanonicalCodes() {
        assertTrue(PairingCode.isValid("ABCDEF"))
        assertTrue(PairingCode.isValid("X3K9PQ"))
    }

    @Test fun isValidRejectsBadInput() {
        assertFalse(PairingCode.isValid(""))
        assertFalse(PairingCode.isValid("abcdef"))
        assertFalse(PairingCode.isValid("AAAA"))
        assertFalse(PairingCode.isValid("ABCDEFG"))
        assertFalse(PairingCode.isValid("AAAA0A"))
        assertFalse(PairingCode.isValid("AAAA1A"))
        assertFalse(PairingCode.isValid("AAAAOA"))
        assertFalse(PairingCode.isValid("AAAAIA"))
    }
}
