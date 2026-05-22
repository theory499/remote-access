import Foundation
import FirebaseDatabase
import FirebaseCore

struct SdpPayload: Equatable {
    let type: String
    let sdp: String

    static func from(map: [String: Any]) -> SdpPayload? {
        guard let type = map["type"] as? String, let sdp = map["sdp"] as? String else { return nil }
        return SdpPayload(type: type, sdp: sdp)
    }
    func toMap() -> [String: Any] { ["type": type, "sdp": sdp] }
}

struct IceCandidatePayload: Equatable {
    let candidate: String
    let sdpMid: String?
    let sdpMLineIndex: Int?

    static func from(map: [String: Any]) -> IceCandidatePayload? {
        guard let candidate = map["candidate"] as? String else { return nil }
        return IceCandidatePayload(
            candidate: candidate,
            sdpMid: map["sdpMid"] as? String,
            sdpMLineIndex: (map["sdpMLineIndex"] as? Int)
        )
    }
    func toMap() -> [String: Any] {
        var out: [String: Any] = ["candidate": candidate]
        if let mid = sdpMid { out["sdpMid"] = mid }
        if let idx = sdpMLineIndex { out["sdpMLineIndex"] = idx }
        return out
    }
}

final class SignalingClient {
    enum Role: String { case host, client }

    let sessionCode: String
    private let database: Database
    private let uid: String
    private let role: Role
    private let peerRole: Role
    private let sessionRef: DatabaseReference

    private var handles: [(DatabaseReference, DatabaseHandle)] = []

    init(database: Database, uid: String, sessionCode: String, role: Role = .client) {
        self.database = database
        self.uid = uid
        self.sessionCode = sessionCode
        self.role = role
        self.peerRole = (role == .host) ? .client : .host
        self.sessionRef = database.reference().child("sessions").child(sessionCode)
    }

    func registerPresence(completion: @escaping (Error?) -> Void = { _ in }) {
        let ref = sessionRef.child(role.rawValue)
        ref.setValue([
            "uid": uid,
            "createdAt": ServerValue.timestamp()
        ]) { error, _ in completion(error) }
        ref.onDisconnectRemoveValue()
    }

    func watchPeerPresence(callback: @escaping ([String: Any]?) -> Void) {
        let ref = sessionRef.child(peerRole.rawValue)
        let handle = ref.observe(.value) { snap in
            callback(snap.value as? [String: Any])
        }
        handles.append((ref, handle))
    }

    func sendOffer(_ payload: SdpPayload, completion: @escaping (Error?) -> Void = { _ in }) {
        sessionRef.child("offer").setValue(payload.toMap()) { error, _ in completion(error) }
    }

    func watchOffer(callback: @escaping (SdpPayload) -> Void) {
        let ref = sessionRef.child("offer")
        let handle = ref.observe(.value) { snap in
            if let map = snap.value as? [String: Any], let p = SdpPayload.from(map: map) {
                callback(p)
            }
        }
        handles.append((ref, handle))
    }

    func sendAnswer(_ payload: SdpPayload, completion: @escaping (Error?) -> Void = { _ in }) {
        sessionRef.child("answer").setValue(payload.toMap()) { error, _ in completion(error) }
    }

    func watchAnswer(callback: @escaping (SdpPayload) -> Void) {
        let ref = sessionRef.child("answer")
        let handle = ref.observe(.value) { snap in
            if let map = snap.value as? [String: Any], let p = SdpPayload.from(map: map) {
                callback(p)
            }
        }
        handles.append((ref, handle))
    }

    func sendIceCandidate(_ payload: IceCandidatePayload, completion: @escaping (Error?) -> Void = { _ in }) {
        let ref = sessionRef.child("iceCandidates").child(role.rawValue).childByAutoId()
        ref.setValue(payload.toMap()) { error, _ in completion(error) }
    }

    func watchIceCandidates(callback: @escaping (IceCandidatePayload) -> Void) {
        let ref = sessionRef.child("iceCandidates").child(peerRole.rawValue)
        let handle = ref.observe(.childAdded) { snap in
            if let map = snap.value as? [String: Any], let p = IceCandidatePayload.from(map: map) {
                callback(p)
            }
        }
        handles.append((ref, handle))
    }

    func dispose() {
        for (ref, handle) in handles { ref.removeObserver(withHandle: handle) }
        handles.removeAll()
    }
}
