import SwiftUI

@main
struct RemoteDesktopApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear { appState.bootstrap() }
        }
    }
}
