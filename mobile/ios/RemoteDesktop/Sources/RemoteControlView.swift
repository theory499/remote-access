import SwiftUI
import WebRTC
import FirebaseAuth
import FirebaseDatabase

struct RemoteControlView: View {
    let sessionCode: String

    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @StateObject private var controller = RemoteControlViewModel()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                RemoteVideoView(track: controller.remoteTrack, sizeChanged: controller.onSurfaceSizeChange)
                    .background(Color.black)
                    .gesture(controller.dragGesture)
                    .simultaneousGesture(controller.tapGesture)
                    .simultaneousGesture(controller.longPressGesture)

                HStack {
                    Text("Session \(sessionCode)")
                        .font(.caption.monospaced())
                        .foregroundColor(.white.opacity(0.7))
                    Spacer()
                    Text(controller.status)
                        .font(.caption.monospaced())
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(1)
                    Spacer()
                    Button("Close") { dismiss() }
                        .foregroundColor(.white)
                        .font(.caption)
                }
                .padding(.horizontal, 16)
                .frame(height: 48)
                .background(Color(white: 0.13))
            }
        }
        .onAppear { controller.start(sessionCode: sessionCode) }
        .onDisappear { controller.stop() }
    }
}

private struct RemoteVideoView: UIViewRepresentable {
    let track: RTCVideoTrack?
    let sizeChanged: (CGSize) -> Void

    func makeUIView(context: Context) -> RTCMTLVideoView {
        let view = RTCMTLVideoView()
        view.videoContentMode = .scaleAspectFit
        return view
    }

    func updateUIView(_ uiView: RTCMTLVideoView, context: Context) {
        track?.add(uiView)
        DispatchQueue.main.async { sizeChanged(uiView.bounds.size) }
    }
}

@MainActor
final class RemoteControlViewModel: NSObject, ObservableObject, WebRTCClientDelegate {
    @Published var status: String = "Connecting"
    @Published var remoteTrack: RTCVideoTrack?

    private let surface = RemoteSurfaceController()
    private var signaling: SignalingClient?
    private var webrtc: WebRTCClient?
    private var offerAccepted = false
    private var remoteDescriptionSet = false
    private var pendingIce: [IceCandidatePayload] = []

    var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let p = self.surface.toNormalised(value.location)
                self.send(InputEventEncoder.mouseMove(x: p.x, y: p.y))
            }
    }

    var tapGesture: some Gesture {
        SpatialTapGesture()
            .onEnded { event in
                let p = self.surface.toNormalised(event.location)
                if let msg = try? InputEventEncoder.click(x: p.x, y: p.y, button: "left") {
                    self.send(msg)
                }
            }
    }

    var longPressGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.6)
            .onEnded { _ in
                // Approximation: use current centre as the long-press target.
                if let msg = try? InputEventEncoder.click(x: 0.5, y: 0.5, button: "right") {
                    self.send(msg)
                }
            }
    }

    func onSurfaceSizeChange(_ size: CGSize) {
        surface.update(size: size)
    }

    func start(sessionCode: String) {
        guard let uid = Auth.auth().currentUser?.uid else {
            status = "Not signed in"
            return
        }
        let database = Database.database()
        let sig = SignalingClient(database: database, uid: uid, sessionCode: sessionCode, role: .client)
        signaling = sig

        let rtc = WebRTCClient()
        rtc.delegate = self
        webrtc = rtc
        rtc.createConnection()

        sig.registerPresence { [weak self] error in
            if let error = error { self?.status = "Signalling failed: \(error.localizedDescription)" }
        }

        sig.watchOffer { [weak self] offer in
            guard let self = self, !self.offerAccepted else { return }
            self.offerAccepted = true
            rtc.setRemoteOffer(offer) { error in
                if let error = error { self.status = error.localizedDescription; return }
                self.remoteDescriptionSet = true
                for ice in self.pendingIce { rtc.addRemoteIceCandidate(ice) }
                self.pendingIce.removeAll()
                rtc.createAnswer { result in
                    switch result {
                    case .success(let answer): sig.sendAnswer(answer)
                    case .failure(let err): self.status = err.localizedDescription
                    }
                }
            }
        }

        sig.watchIceCandidates { [weak self] ice in
            guard let self = self else { return }
            if self.remoteDescriptionSet {
                rtc.addRemoteIceCandidate(ice)
            } else {
                self.pendingIce.append(ice)
            }
        }

        sig.watchPeerPresence { [weak self] presence in
            if presence == nil { self?.status = "Desktop is offline" }
        }
    }

    func stop() {
        signaling?.dispose()
        signaling = nil
        webrtc?.dispose()
        webrtc = nil
        remoteTrack = nil
    }

    private func send(_ message: String) {
        webrtc?.sendData(message)
    }

    // MARK: WebRTCClientDelegate

    nonisolated func webRTC(_ client: WebRTCClient, didDiscoverLocalCandidate candidate: IceCandidatePayload) {
        Task { @MainActor in self.signaling?.sendIceCandidate(candidate) }
    }

    nonisolated func webRTC(_ client: WebRTCClient, didReceiveRemoteTrack track: RTCVideoTrack) {
        Task { @MainActor in self.remoteTrack = track }
    }

    nonisolated func webRTC(_ client: WebRTCClient, didOpenDataChannel channel: RTCDataChannel) {
        Task { @MainActor in self.status = "Data channel \(channel.readyState.rawValue)" }
    }

    nonisolated func webRTC(_ client: WebRTCClient, didChangeConnectionState state: RTCPeerConnectionState) {
        let label: String
        switch state {
        case .new: label = "new"
        case .connecting: label = "connecting"
        case .connected: label = "connected"
        case .disconnected: label = "disconnected"
        case .failed: label = "failed"
        case .closed: label = "closed"
        @unknown default: label = "unknown"
        }
        Task { @MainActor in self.status = label }
    }

    nonisolated func webRTC(_ client: WebRTCClient, didReceiveMessage message: String) {
        if let data = message.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let type = obj["type"] as? String,
           type == "ping",
           let id = obj["id"] as? Int {
            Task { @MainActor in self.webrtc?.sendData(InputEventEncoder.pong(id: id)) }
        }
    }
}
