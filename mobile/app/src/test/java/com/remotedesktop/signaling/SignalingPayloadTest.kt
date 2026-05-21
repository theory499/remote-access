package com.remotedesktop.signaling

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SignalingPayloadTest {

    @Test fun sdpRoundTrip() {
        val payload = SdpPayload("offer", "v=0\r\n...")
        val map = payload.toMap()
        assertEquals("offer", map["type"])
        assertEquals("v=0\r\n...", map["sdp"])
        val parsed = SdpPayload.fromMap(map)!!
        assertEquals(payload, parsed)
    }

    @Test fun sdpFromMapRejectsMissingFields() {
        assertNull(SdpPayload.fromMap(mapOf("type" to "offer")))
        assertNull(SdpPayload.fromMap(mapOf("sdp" to "x")))
        assertNull(SdpPayload.fromMap(emptyMap<String, Any>()))
    }

    @Test fun iceCandidateRoundTrip() {
        val payload = IceCandidatePayload("candidate:1 1 udp 2113937151 0.0.0.0 0 typ host", "0", 0)
        val map = payload.toMap()
        assertEquals(payload.candidate, map["candidate"])
        assertEquals(payload.sdpMid, map["sdpMid"])
        assertEquals(payload.sdpMLineIndex, map["sdpMLineIndex"])
        val parsed = IceCandidatePayload.fromMap(map)!!
        assertEquals(payload, parsed)
    }

    @Test fun iceCandidateAcceptsNullableFields() {
        val map = mapOf("candidate" to "x", "sdpMid" to null, "sdpMLineIndex" to null)
        val parsed = IceCandidatePayload.fromMap(map)!!
        assertEquals("x", parsed.candidate)
        assertNull(parsed.sdpMid)
        assertNull(parsed.sdpMLineIndex)
    }
}
