import CoreImage
import UIKit

enum QRImageDecoder {
    /// Returns the first QR-code message embedded in `image`, or `nil`
    /// if no QR feature was found. Used to support picking a QR
    /// screenshot from the photo library in addition to live scanning.
    static func decode(_ image: UIImage) -> String? {
        guard let ciImage = CIImage(image: image) else { return nil }
        let context = CIContext(options: nil)
        let detector = CIDetector(
            ofType: CIDetectorTypeQRCode,
            context: context,
            options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]
        )
        let features = detector?.features(in: ciImage) ?? []
        for case let qr as CIQRCodeFeature in features {
            if let message = qr.messageString, !message.isEmpty {
                return message
            }
        }
        return nil
    }
}
