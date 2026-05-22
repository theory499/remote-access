import Foundation
import WebRTC

protocol WebRTCClientDelegate: AnyObject {
    func webRTC(_ client: WebRTCClient, didDiscoverLocalCandidate candidate: IceCandidatePayload)
    func webRTC(_ client: WebRTCClient, didReceiveRemoteTrack track: RTCVideoTrack)
    func webRTC(_ client: WebRTCClient, didOpenDataChannel channel: RTCDataChannel)
    func webRTC(_ client: WebRTCClient, didChangeConnectionState state: RTCPeerConnectionState)
    func webRTC(_ client: WebRTCClient, didReceiveMessage message: String)
}

final class WebRTCClient: NSObject, RTCPeerConnectionDelegate, RTCDataChannelDelegate {
    weak var delegate: WebRTCClientDelegate?

    static let defaultIceServers = [
        RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"])
    ]

    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        let encoder = RTCDefaultVideoEncoderFactory()
        let decoder = RTCDefaultVideoDecoderFactory()
        return RTCPeerConnectionFactory(encoderFactory: encoder, decoderFactory: decoder)
    }()

    private var connection: RTCPeerConnection?
    private var inputChannel: RTCDataChannel?

    func createConnection(iceServers: [RTCIceServer] = defaultIceServers) {
        let config = RTCConfiguration()
        config.iceServers = iceServers
        config.sdpSemantics = .unifiedPlan
        config.tcpCandidatePolicy = .disabled

        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        connection = Self.factory.peerConnection(with: config, constraints: constraints, delegate: self)
    }

    func setRemoteOffer(_ payload: SdpPayload, completion: @escaping (Error?) -> Void) {
        let description = RTCSessionDescription(type: .offer, sdp: payload.sdp)
        connection?.setRemoteDescription(description, completionHandler: completion)
    }

    func createAnswer(completion: @escaping (Result<SdpPayload, Error>) -> Void) {
        guard let pc = connection else {
            completion(.failure(NSError(domain: "WebRTC", code: -1)))
            return
        }
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        pc.answer(for: constraints) { description, error in
            if let error = error { return completion(.failure(error)) }
            guard let description = description else {
                return completion(.failure(NSError(domain: "WebRTC", code: -2)))
            }
            pc.setLocalDescription(description) { error in
                if let error = error { return completion(.failure(error)) }
                completion(.success(SdpPayload(type: "answer", sdp: description.sdp)))
            }
        }
    }

    func addRemoteIceCandidate(_ payload: IceCandidatePayload) {
        let candidate = RTCIceCandidate(
            sdp: payload.candidate,
            sdpMLineIndex: Int32(payload.sdpMLineIndex ?? 0),
            sdpMid: payload.sdpMid
        )
        connection?.add(candidate, completionHandler: { _ in })
    }

    func sendData(_ message: String) {
        guard let channel = inputChannel, channel.readyState == .open else { return }
        let buffer = RTCDataBuffer(data: Data(message.utf8), isBinary: false)
        channel.sendData(buffer)
    }

    func dispose() {
        inputChannel?.close()
        inputChannel = nil
        connection?.close()
        connection = nil
    }

    // MARK: - RTCPeerConnectionDelegate

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        delegate?.webRTC(self, didDiscoverLocalCandidate: IceCandidatePayload(
            candidate: candidate.sdp,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: Int(candidate.sdpMLineIndex)
        ))
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        inputChannel = dataChannel
        dataChannel.delegate = self
        delegate?.webRTC(self, didOpenDataChannel: dataChannel)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd rtpReceiver: RTCRtpReceiver, streams mediaStreams: [RTCMediaStream]) {
        if let track = rtpReceiver.track as? RTCVideoTrack {
            delegate?.webRTC(self, didReceiveRemoteTrack: track)
        }
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState) {
        delegate?.webRTC(self, didChangeConnectionState: newState)
    }

    // MARK: - RTCDataChannelDelegate

    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {}

    func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
        let message = String(data: buffer.data, encoding: .utf8) ?? ""
        delegate?.webRTC(self, didReceiveMessage: message)
    }
}
