import Foundation

struct FirebaseConfig: Equatable, Codable {
    let apiKey: String
    let googleAppId: String
    let projectId: String
    let databaseURL: String
    let bundleId: String

    static let payloadVersion = 1

    static func fromQrPayload(_ raw: String) -> FirebaseConfig? {
        guard let data = raw.data(using: .utf8) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let v = json["v"] as? Int, v == payloadVersion else { return nil }
        guard let backend = json["backend"] as? String, backend == "firebase" else { return nil }
        guard let ios = json["ios"] as? [String: Any] else { return nil }
        guard
            let apiKey = (ios["apiKey"] as? String)?.trimmedNonEmpty(),
            let googleAppId = (ios["googleAppId"] as? String)?.trimmedNonEmpty(),
            let projectId = (ios["projectId"] as? String)?.trimmedNonEmpty(),
            let databaseURL = (ios["databaseURL"] as? String)?.trimmedNonEmpty(),
            let bundleId = (ios["bundleId"] as? String)?.trimmedNonEmpty()
        else { return nil }
        return FirebaseConfig(
            apiKey: apiKey,
            googleAppId: googleAppId,
            projectId: projectId,
            databaseURL: databaseURL,
            bundleId: bundleId
        )
    }
}

private extension String {
    func trimmedNonEmpty() -> String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
