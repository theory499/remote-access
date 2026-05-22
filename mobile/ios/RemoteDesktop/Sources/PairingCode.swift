import Foundation

enum PairingCode {
    static let alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    static let length = 6

    static func normalise(_ raw: String) -> String {
        let allowed = Set(alphabet)
        let upper = raw.uppercased()
        return String(upper.filter { allowed.contains($0) }.prefix(length))
    }

    static func isValid(_ code: String) -> Bool {
        guard code.count == length else { return false }
        let allowed = Set(alphabet)
        return code.allSatisfy { allowed.contains($0) }
    }
}
