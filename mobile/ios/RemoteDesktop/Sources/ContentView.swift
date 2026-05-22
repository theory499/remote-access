import SwiftUI
import PhotosUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        switch appState.route {
        case .scanner:
            ScannerScreen()
        case .main:
            MainScreen()
        }
    }
}

private struct ScannerScreen: View {
    @EnvironmentObject var appState: AppState
    @State private var status: String = "Aim at the pairing QR code"
    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        ZStack {
            QRScannerView { raw in handle(raw: raw) }
                .ignoresSafeArea()

            VStack {
                VStack(spacing: 8) {
                    Text("Scan the QR code shown on your desktop")
                        .font(.headline)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                    Text(status)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                    if let err = appState.configError {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                    }
                }
                .padding(.top, 48)
                .padding(.horizontal, 24)

                Spacer()

                PhotosPicker(
                    selection: $pickerItem,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Label("Choose image from gallery", systemImage: "photo.on.rectangle")
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(Color.white, lineWidth: 1)
                        )
                }
                .padding(.bottom, 48)
            }
        }
        .background(Color.black.ignoresSafeArea())
        .onChange(of: pickerItem) { newItem in
            guard let newItem = newItem else { return }
            Task { await ingestPickedImage(newItem) }
        }
    }

    private func ingestPickedImage(_ item: PhotosPickerItem) async {
        status = "Reading image…"
        do {
            guard
                let data = try await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data)
            else {
                status = "Could not read that image."
                return
            }
            guard let raw = QRImageDecoder.decode(image) else {
                status = "No QR code found in that image."
                return
            }
            handle(raw: raw)
        } catch {
            status = "Could not read that image: \(error.localizedDescription)"
        }
    }

    private func handle(raw: String) {
        guard let config = FirebaseConfig.fromQrPayload(raw) else {
            status = "That QR is not a Remote Desktop config. Try again."
            return
        }
        status = "Applying configuration..."
        do {
            try appState.apply(config: config)
        } catch {
            status = "Failed: \(error.localizedDescription)"
        }
    }
}

private struct MainScreen: View {
    @EnvironmentObject var appState: AppState
    @State private var code: String = ""
    @State private var showSession = false

    var body: some View {
        VStack(spacing: 20) {
            Text("Remote Desktop")
                .font(.title2.bold())
            Text("Enter the pairing code shown on your desktop.")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)

            TextField("Pairing code", text: $code)
                .textInputAutocapitalization(.characters)
                .disableAutocorrection(true)
                .font(.system(.title, design: .monospaced))
                .multilineTextAlignment(.center)
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(8)
                .onChange(of: code) { newValue in
                    let normalised = PairingCode.normalise(newValue)
                    if normalised != newValue { code = normalised }
                }

            Button(action: { showSession = true }) {
                Text("Connect")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!PairingCode.isValid(code) || appState.authUid == nil)

            if let uid = appState.authUid {
                Text("Signed in (\(uid.prefix(8))…)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                ProgressView("Signing in")
                    .font(.caption)
            }

            Spacer()

            Button("Change backend configuration", action: appState.reset)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle("Remote Desktop")
        .fullScreenCover(isPresented: $showSession) {
            RemoteControlView(sessionCode: code)
                .environmentObject(appState)
        }
    }
}
