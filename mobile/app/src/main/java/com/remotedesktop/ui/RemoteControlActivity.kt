package com.remotedesktop.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.GestureDetector
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.appcompat.app.AppCompatActivity
import com.remotedesktop.R
import com.remotedesktop.RemoteDesktopApp
import com.remotedesktop.databinding.ActivityRemoteControlBinding
import com.remotedesktop.input.AndroidKeyMapper
import com.remotedesktop.input.InputEventEncoder
import com.remotedesktop.input.RemoteSurfaceController
import com.remotedesktop.signaling.IceCandidatePayload
import com.remotedesktop.signaling.SdpPayload
import com.remotedesktop.signaling.SignalingClient
import com.remotedesktop.webrtc.WebRTCClient
import org.webrtc.DataChannel
import org.webrtc.EglBase
import org.webrtc.PeerConnection
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean

class RemoteControlActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SESSION_CODE = "session_code"
    }

    private lateinit var binding: ActivityRemoteControlBinding
    private val eglBase: EglBase = EglBase.create()
    private val surfaceController = RemoteSurfaceController()

    private var signaling: SignalingClient? = null
    private var webRtc: WebRTCClient? = null
    private var inputChannel: DataChannel? = null
    private var remoteVideo: VideoTrack? = null

    private var sessionCode: String = ""
    private val offerAccepted = AtomicBoolean(false)
    private val pendingIce = mutableListOf<IceCandidatePayload>()
    private var remoteDescriptionSet = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRemoteControlBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionCode = intent.getStringExtra(EXTRA_SESSION_CODE).orEmpty()
        if (sessionCode.isEmpty()) {
            finish()
            return
        }
        binding.codeLabel.text = getString(R.string.label_pairing_code, sessionCode)

        configureRenderer(binding.remoteVideo)
        configureTouchInput()
        configureKeyboardInput()

        startSession()
    }

    private fun configureRenderer(renderer: SurfaceViewRenderer) {
        renderer.init(eglBase.eglBaseContext, null)
        renderer.setEnableHardwareScaler(true)
        renderer.setMirror(false)
        renderer.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            surfaceController.updateSurfaceSize(v.width, v.height)
        }
    }

    private fun configureTouchInput() {
        val detector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapUp(e: MotionEvent): Boolean {
                val p = surfaceController.toNormalised(e.x, e.y)
                send(InputEventEncoder.click(p.x, p.y, "left"))
                return true
            }
            override fun onLongPress(e: MotionEvent) {
                val p = surfaceController.toNormalised(e.x, e.y)
                send(InputEventEncoder.click(p.x, p.y, "right"))
            }
        })

        binding.remoteVideo.setOnTouchListener { v, event ->
            detector.onTouchEvent(event)
            if (event.actionMasked == MotionEvent.ACTION_MOVE) {
                val p = surfaceController.toNormalised(event.x, event.y)
                send(InputEventEncoder.mouseMove(p.x, p.y))
            }
            if (event.actionMasked == MotionEvent.ACTION_UP) v.performClick()
            true
        }

        binding.keyboardButton.setOnClickListener {
            binding.keyboardInput.requestFocus()
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(binding.keyboardInput, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun configureKeyboardInput() {
        binding.keyboardInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (s == null || s.isEmpty()) return
                val toSend = s.toString()
                send(InputEventEncoder.typeText(toSend))
                s.clear()
            }
        })
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val key = AndroidKeyMapper.toProtocolKey(keyCode)
        if (key != null) {
            send(InputEventEncoder.keyDown(key, AndroidKeyMapper.toProtocolModifiers(event.metaState)))
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        val key = AndroidKeyMapper.toProtocolKey(keyCode)
        if (key != null) {
            send(InputEventEncoder.keyUp(key))
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    private fun send(message: String) {
        val channel = inputChannel ?: return
        if (channel.state() != DataChannel.State.OPEN) return
        webRtc?.sendData(channel, message)
    }

    private fun startSession() {
        val app = application as RemoteDesktopApp
        val uid = app.auth.currentUser?.uid ?: run {
            updateStatus(getString(R.string.status_not_signed_in))
            return
        }

        val sig = SignalingClient(app.database, uid, sessionCode, SignalingClient.Role.CLIENT)
        signaling = sig

        val rtc = WebRTCClient(applicationContext, eglBase, object : WebRTCClient.Callbacks {
            override fun onLocalIceCandidate(candidate: IceCandidatePayload) {
                sig.sendIceCandidate(candidate)
            }
            override fun onRemoteVideoTrack(track: VideoTrack) {
                runOnUiThread {
                    remoteVideo?.removeSink(binding.remoteVideo)
                    remoteVideo = track
                    track.addSink(binding.remoteVideo)
                }
            }
            override fun onDataChannel(channel: DataChannel) {
                attachDataChannel(channel)
            }
            override fun onConnectionStateChange(state: PeerConnection.PeerConnectionState) {
                runOnUiThread { updateStatus(state.name) }
            }
        })
        webRtc = rtc
        rtc.createConnection(WebRTCClient.DEFAULT_ICE_SERVERS)

        sig.registerPresence { error ->
            if (error != null) updateStatus(getString(R.string.status_signaling_failed, error.localizedMessage))
        }

        sig.watchOffer { offer ->
            if (!offerAccepted.compareAndSet(false, true)) return@watchOffer
            rtc.setRemoteOffer(offer, onSuccess = {
                remoteDescriptionSet = true
                synchronized(pendingIce) {
                    for (candidate in pendingIce) rtc.addRemoteIceCandidate(candidate)
                    pendingIce.clear()
                }
                rtc.createAnswer(onSuccess = { answer ->
                    sig.sendAnswer(answer)
                }, onError = { updateStatus(it) })
            }, onError = { updateStatus(it) })
        }

        sig.watchIceCandidates { candidate ->
            if (remoteDescriptionSet) {
                rtc.addRemoteIceCandidate(candidate)
            } else {
                synchronized(pendingIce) {
                    if (remoteDescriptionSet) rtc.addRemoteIceCandidate(candidate)
                    else pendingIce.add(candidate)
                }
            }
        }

        sig.watchPeerPresence { presence ->
            if (presence == null) {
                runOnUiThread { updateStatus(getString(R.string.status_host_offline)) }
            }
        }

        updateStatus(getString(R.string.status_waiting_offer))
    }

    private fun attachDataChannel(channel: DataChannel) {
        inputChannel = channel
        channel.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) {}
            override fun onStateChange() {
                runOnUiThread {
                    updateStatus(getString(R.string.status_channel_state, channel.state().name))
                }
            }
            override fun onMessage(buffer: DataChannel.Buffer) {
                val bytes = ByteArray(buffer.data.remaining())
                buffer.data.get(bytes)
                val message = String(bytes, StandardCharsets.UTF_8)
                handleIncoming(channel, message)
            }
        })
    }

    private fun handleIncoming(channel: DataChannel, message: String) {
        try {
            val json = org.json.JSONObject(message)
            when (json.optString("type")) {
                "ping" -> {
                    val id = json.optInt("id", -1)
                    if (id >= 0) webRtc?.sendData(channel, InputEventEncoder.pong(id))
                }
            }
        } catch (_: Exception) { /* ignore malformed */ }
    }

    private fun updateStatus(status: String) {
        binding.statusText.text = getString(R.string.label_status, status)
    }

    override fun onDestroy() {
        super.onDestroy()
        signaling?.dispose()
        signaling = null
        inputChannel?.close()
        inputChannel = null
        remoteVideo?.removeSink(binding.remoteVideo)
        remoteVideo = null
        webRtc?.dispose()
        webRtc = null
        binding.remoteVideo.release()
        eglBase.release()
    }
}
