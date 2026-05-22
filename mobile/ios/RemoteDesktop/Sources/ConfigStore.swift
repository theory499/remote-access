import Foundation

final class ConfigStore {
    static let key = "backend_config_firebase_v1"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> FirebaseConfig? {
        guard let data = defaults.data(forKey: Self.key) else { return nil }
        return try? JSONDecoder().decode(FirebaseConfig.self, from: data)
    }

    func save(_ config: FirebaseConfig) {
        guard let data = try? JSONEncoder().encode(config) else { return }
        defaults.set(data, forKey: Self.key)
    }

    func clear() {
        defaults.removeObject(forKey: Self.key)
    }

    func exists() -> Bool {
        defaults.data(forKey: Self.key) != nil
    }
}
