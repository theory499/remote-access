package com.remotedesktop.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
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
import com.remotedesktop.signaling.IceCandidatePayload
import com.remotedesktop.signaling.SignalingClient
import com.remotedesktop.webrtc.WebRTCClient
import org.webrtc.DataChannel
import org.webrtc.EglBase
import org.webrtc.PeerConnection
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean

class RemoteControlActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SESSION_CODE = "session_code"

        private const val CURSOR_STEP = 0.012       // 1.2% of remote screen per tap
        private const val REPEAT_INITIAL_DELAY = 90L
        private const val REPEAT_INTERVAL = 35L
        private const val REPEAT_TAG = -0x70010001  // arbitrary unique tag id
    }

    private lateinit var binding: ActivityRemoteControlBinding
    private val eglBase: EglBase = EglBase.create()
    private val handler = Handler(Looper.getMainLooper())

    private var signaling: SignalingClient? = null
    private var webRtc: WebRTCClient? = null
    private var inputChannel: DataChannel? = null
    private var remoteVideo: VideoTrack? = null

    private var sessionCode: String = ""
    private val offerAccepted = AtomicBoolean(false)
    private val pendingIce = mutableListOf<IceCandidatePayload>()
    @Volatile private var remoteDescriptionSet = false

    // Cursor state, normalised to [0, 1] over the remote desktop.
    private var cursorX = 0.5
    private var cursorY = 0.5

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
        configureCursorDial()
        configureClickButtons()
        configureKeyboardInput()
        configureVideoTouch()

        binding.videoContainer.viewTreeObserver.addOnGlobalLayoutListener {
            updateCursorVisualisation()
        }

        startSession()
    }

    private fun configureRenderer(renderer: SurfaceViewRenderer) {
        renderer.init(eglBase.eglBaseContext, null)
        renderer.setEnableHardwareScaler(true)
        renderer.setMirror(false)
        renderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
    }

    private fun configureCursorDial() {
        wireRepeatButton(binding.dialUp)    { moveCursor(0.0, -CURSOR_STEP) }
        wireRepeatButton(binding.dialDown)  { moveCursor(0.0,  CURSOR_STEP) }
        wireRepeatButton(binding.dialLeft)  { moveCursor(-CURSOR_STEP, 0.0) }
        wireRepeatButton(binding.dialRight) { moveCursor( CURSOR_STEP, 0.0) }
    }

    private fun configureClickButtons() {
        binding.leftClickButton.setOnClickListener {
            send(InputEventEncoder.click(cursorX, cursorY, "left"))
        }
        binding.rightClickButton.setOnClickListener {
            send(InputEventEncoder.click(cursorX, cursorY, "right"))
        }
    }

    private fun configureVideoTouch() {
        binding.remoteVideo.setOnTouchListener { v, event ->
            val containerW = binding.videoContainer.width.toFloat()
            val containerH = binding.videoContainer.height.toFloat()
            if (containerW <= 0f || containerH <= 0f) return@setOnTouchListener false
            val xN = (event.x / containerW).toDouble().coerceIn(0.0, 1.0)
            val yN = (event.y / containerH).toDouble().coerceIn(0.0, 1.0)

            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN,
                MotionEvent.ACTION_MOVE -> {
                    setCursorAt(xN, yN)
                    send(InputEventEncoder.mouseMove(xN, yN))
                }
                MotionEvent.ACTION_UP -> v.performClick()
            }
            true
        }
    }

    private fun configureKeyboardInput() {
        binding.keyboardButton.setOnClickListener {
            binding.keyboardInput.requestFocus()
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(binding.keyboardInput, InputMethodManager.SHOW_IMPLICIT)
        }
        binding.keyboardInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (s == null || s.isEmpty()) return
                send(InputEventEncoder.typeText(s.toString()))
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

    private fun moveCursor(dx: Double, dy: Double) {
        cursorX = (cursorX + dx).coerceIn(0.0, 1.0)
        cursorY = (cursorY + dy).coerceIn(0.0, 1.0)
        updateCursorVisualisation()
        send(InputEventEncoder.mouseMove(cursorX, cursorY))
    }

    private fun setCursorAt(xN: Double, yN: Double) {
        cursorX = xN.coerceIn(0.0, 1.0)
        cursorY = yN.coerceIn(0.0, 1.0)
        updateCursorVisualisation()
    }

    private fun updateCursorVisualisation() {
        val container = binding.videoContainer
        val cursorView = binding.cursorIndicator
        val w = container.width.toFloat()
        val h = container.height.toFloat()
        if (w <= 0f || h <= 0f) return
        cursorView.translationX = (cursorX * w).toFloat() - cursorView.width / 2f
        cursorView.translationY = (cursorY * h).toFloat() - cursorView.height / 2f
    }

    private fun wireRepeatButton(button: View, action: () -> Unit) {
        button.setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    action()
                    val runnable = object : Runnable {
                        override fun run() {
                            action()
                            handler.postDelayed(this, REPEAT_INTERVAL)
                        }
                    }
                    v.setTag(REPEAT_TAG, runnable)
                    handler.postDelayed(runnable, REPEAT_INITIAL_DELAY)
                    v.isPressed = true
                    true
                }
                MotionEvent.ACTION_UP,
                MotionEvent.ACTION_CANCEL -> {
                    (v.getTag(REPEAT_TAG) as? Runnable)?.let { handler.removeCallbacks(it) }
                    v.setTag(REPEAT_TAG, null)
                    v.isPressed = false
                    v.performClick()
                    true
                }
                else -> false
            }
        }
        button.setOnClickListener { /* fires through the touch listener */ }
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
            override fun onDataChannel(channel: DataChannel) { attachDataChannel(channel) }
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
                rtc.createAnswer(onSuccess = { answer -> sig.sendAnswer(answer) },
                                 onError = { updateStatus(it) })
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
            if (presence == null) runOnUiThread {
                updateStatus(getString(R.string.status_host_offline))
            }
        }

        updateStatus(getString(R.string.status_waiting_offer))
    }

    private fun attachDataChannel(channel: DataChannel) {
        inputChannel = channel
        channel.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) {}
            override fun onStateChange() {
                runOnUiThread { updateStatus(getString(R.string.status_channel_state, channel.state().name)) }
            }
            override fun onMessage(buffer: DataChannel.Buffer) {
                val bytes = ByteArray(buffer.data.remaining())
                buffer.data.get(bytes)
                handleIncoming(channel, String(bytes, StandardCharsets.UTF_8))
            }
        })
    }

    private fun handleIncoming(channel: DataChannel, message: String) {
        try {
            val json = org.json.JSONObject(message)
            if (json.optString("type") == "ping") {
                val id = json.optInt("id", -1)
                if (id >= 0) webRtc?.sendData(channel, InputEventEncoder.pong(id))
            }
        } catch (_: Exception) { /* ignore malformed */ }
    }

    private fun updateStatus(status: String) {
        binding.statusText.text = getString(R.string.label_status, status)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        signaling?.dispose(); signaling = null
        inputChannel?.close(); inputChannel = null
        remoteVideo?.removeSink(binding.remoteVideo); remoteVideo = null
        webRtc?.dispose(); webRtc = null
        binding.remoteVideo.release()
        eglBase.release()
    }
}
