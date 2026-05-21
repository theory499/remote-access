package com.remotedesktop.signaling

data class SdpPayload(val type: String, val sdp: String) {
    companion object {
        fun fromMap(map: Map<*, *>): SdpPayload? {
            val type = map["type"] as? String ?: return null
            val sdp = map["sdp"] as? String ?: return null
            return SdpPayload(type, sdp)
        }
    }

    fun toMap(): Map<String, String> = mapOf("type" to type, "sdp" to sdp)
}

data class IceCandidatePayload(
    val candidate: String,
    val sdpMid: String?,
    val sdpMLineIndex: Int?
) {
    companion object {
        fun fromMap(map: Map<*, *>): IceCandidatePayload? {
            val candidate = map["candidate"] as? String ?: return null
            val sdpMid = map["sdpMid"] as? String
            val mLine = (map["sdpMLineIndex"] as? Number)?.toInt()
            return IceCandidatePayload(candidate, sdpMid, mLine)
        }
    }

    fun toMap(): Map<String, Any?> = mapOf(
        "candidate" to candidate,
        "sdpMid" to sdpMid,
        "sdpMLineIndex" to sdpMLineIndex
    )
}
