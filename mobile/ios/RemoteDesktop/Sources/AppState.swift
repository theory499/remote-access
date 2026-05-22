import Foundation
import Combine
import FirebaseCore
import FirebaseAuth
import FirebaseDatabase

enum AppRoute: Equatable {
    case scanner
    case main
}

@MainActor
final class AppState: ObservableObject {
    @Published var route: AppRoute = .scanner
    @Published var configError: String?
    @Published var authUid: String?

    private let configStore = ConfigStore()
    private var firebaseInitialised = false

    var activeConfig: FirebaseConfig? { configStore.load() }

    func bootstrap() {
        if let config = configStore.load() {
            do {
                try initialiseFirebase(with: config)
                route = .main
                signInAnonymouslyIfNeeded()
            } catch {
                configError = error.localizedDescription
                route = .scanner
            }
        } else {
            route = .scanner
        }
    }

    func apply(config: FirebaseConfig) throws {
        try initialiseFirebase(with: config)
        configStore.save(config)
        route = .main
        signInAnonymouslyIfNeeded()
    }

    func reset() {
        configStore.clear()
        authUid = nil
        route = .scanner
    }

    private func initialiseFirebase(with config: FirebaseConfig) throws {
        if firebaseInitialised { return }
        let options = FirebaseOptions(
            googleAppID: config.googleAppId,
            gcmSenderID: ""
        )
        options.apiKey = config.apiKey
        options.projectID = config.projectId
        options.databaseURL = config.databaseURL
        options.bundleID = config.bundleId
        FirebaseApp.configure(options: options)
        Database.database().isPersistenceEnabled = false
        firebaseInitialised = true
    }

    private func signInAnonymouslyIfNeeded() {
        if let user = Auth.auth().currentUser {
            authUid = user.uid
            return
        }
        Auth.auth().signInAnonymously { [weak self] result, error in
            DispatchQueue.main.async {
                if let user = result?.user {
                    self?.authUid = user.uid
                } else {
                    self?.configError = error?.localizedDescription
                }
            }
        }
    }
}
