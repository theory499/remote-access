package com.remotedesktop.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class FirebaseConfigTest {

    private val androidBlob = """
        "android": {
          "apiKey": "AIza-android",
          "applicationId": "1:1:android:abc",
          "projectId": "demo",
          "databaseURL": "https://demo-default-rtdb.firebaseio.com"
        }
    """.trimIndent()

    @Test fun parsesValidQrPayload() {
        val payload = """{"v":1,"backend":"firebase",$androidBlob,"projectId":"demo","databaseURL":"https://demo-default-rtdb.firebaseio.com"}"""
        val config = FirebaseConfig.fromQrPayload(payload)
        assertNotNull(config)
        assertEquals("AIza-android", config!!.apiKey)
        assertEquals("1:1:android:abc", config.applicationId)
        assertEquals("demo", config.projectId)
        assertEquals("https://demo-default-rtdb.firebaseio.com", config.databaseURL)
    }

    @Test fun rejectsWrongVersion() {
        val payload = """{"v":2,"backend":"firebase",$androidBlob}"""
        assertNull(FirebaseConfig.fromQrPayload(payload))
    }

    @Test fun rejectsWrongBackend() {
        val payload = """{"v":1,"backend":"aws",$androidBlob}"""
        assertNull(FirebaseConfig.fromQrPayload(payload))
    }

    @Test fun rejectsPayloadMissingAndroid() {
        val payload = """{"v":1,"backend":"firebase","ios":{}}"""
        assertNull(FirebaseConfig.fromQrPayload(payload))
    }

    @Test fun rejectsAndroidMissingField() {
        val brokenBlob = """"android":{"apiKey":"x","applicationId":"y","projectId":"z"}"""
        val payload = """{"v":1,"backend":"firebase",$brokenBlob}"""
        assertNull(FirebaseConfig.fromQrPayload(payload))
    }

    @Test fun rejectsMalformedJson() {
        assertNull(FirebaseConfig.fromQrPayload("not json"))
        assertNull(FirebaseConfig.fromQrPayload(""))
    }

    @Test fun roundTripsThroughToJson() {
        val original = FirebaseConfig(
            apiKey = "AIza",
            applicationId = "1:1:android:abc",
            projectId = "demo",
            databaseURL = "https://demo.firebaseio.com"
        )
        val json = original.toJson()
        val parsed = org.json.JSONObject(json)
        assertEquals(original.apiKey, parsed.getString("apiKey"))
        assertEquals(original.applicationId, parsed.getString("applicationId"))
        assertEquals(original.projectId, parsed.getString("projectId"))
        assertEquals(original.databaseURL, parsed.getString("databaseURL"))
    }
}
