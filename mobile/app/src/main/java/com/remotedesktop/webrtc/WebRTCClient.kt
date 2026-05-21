package com.remotedesktop.webrtc

import android.content.Context
import com.remotedesktop.signaling.IceCandidatePayload
import com.remotedesktop.signaling.SdpPayload
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.VideoTrack
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean

class WebRTCClient(
    context: Context,
    private val eglBase: EglBase,
    private val callbacks: Callbacks
) {
    interface Callbacks {
        fun onLocalIceCandidate(candidate: IceCandidatePayload)
        fun onRemoteVideoTrack(track: VideoTrack)
        fun onDataChannel(channel: DataChannel)
        fun onConnectionStateChange(state: PeerConnection.PeerConnectionState)
    }

    private val factory: PeerConnectionFactory
    private var peerConnection: PeerConnection? = null
    private val closed = AtomicBoolean(false)

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .createInitializationOptions()
        )
        val encoder = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoder = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoder)
            .setVideoDecoderFactory(decoder)
            .createPeerConnectionFactory()
    }

    fun createConnection(iceServers: List<PeerConnection.IceServer>) {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.DISABLED
            iceTransportsType = PeerConnection.IceTransportsType.ALL
        }
        peerConnection = factory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onIceCandidate(candidate: IceCandidate) {
                callbacks.onLocalIceCandidate(IceCandidatePayload(
                    candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex
                ))
            }
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel) {
                callbacks.onDataChannel(channel)
            }
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                val track = receiver?.track() ?: return
                when (track) {
                    is VideoTrack -> callbacks.onRemoteVideoTrack(track)
                    is AudioTrack -> {}
                }
            }
            override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
                callbacks.onConnectionStateChange(state)
            }
        }) ?: error("Failed to create peer connection")
    }

    fun setRemoteOffer(payload: SdpPayload, onSuccess: () -> Unit, onError: (String) -> Unit) {
        val description = SessionDescription(SessionDescription.Type.fromCanonicalForm(payload.type), payload.sdp)
        val pc = peerConnection ?: return onError("peer connection not initialised")
        pc.setRemoteDescription(simpleObserver(onSuccess, onError), description)
    }

    fun createAnswer(onSuccess: (SdpPayload) -> Unit, onError: (String) -> Unit) {
        val pc = peerConnection ?: return onError("peer connection not initialised")
        val constraints = MediaConstraints()
        pc.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription) {
                pc.setLocalDescription(simpleObserver({
                    onSuccess(SdpPayload(description.type.canonicalForm(), description.description))
                }, onError), description)
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String) { onError(error) }
            override fun onSetFailure(error: String) { onError(error) }
        }, constraints)
    }

    fun addRemoteIceCandidate(payload: IceCandidatePayload) {
        val pc = peerConnection ?: return
        val candidate = IceCandidate(payload.sdpMid ?: "", payload.sdpMLineIndex ?: 0, payload.candidate)
        pc.addIceCandidate(candidate)
    }

    fun sendData(channel: DataChannel, message: String) {
        val bytes = message.toByteArray(StandardCharsets.UTF_8)
        val buffer = DataChannel.Buffer(ByteBuffer.wrap(bytes), false)
        channel.send(buffer)
    }

    fun dispose() {
        if (!closed.compareAndSet(false, true)) return
        try { peerConnection?.close() } catch (_: Exception) {}
        peerConnection = null
        try { factory.dispose() } catch (_: Exception) {}
    }

    private fun simpleObserver(onSuccess: () -> Unit, onError: (String) -> Unit): SdpObserver =
        object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription?) {}
            override fun onSetSuccess() { onSuccess() }
            override fun onCreateFailure(error: String) { onError(error) }
            override fun onSetFailure(error: String) { onError(error) }
        }

    companion object {
        val DEFAULT_ICE_SERVERS: List<PeerConnection.IceServer> = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )
    }
}
