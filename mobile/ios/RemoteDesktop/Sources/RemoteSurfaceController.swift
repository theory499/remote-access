import CoreGraphics

struct NormalisedPoint: Equatable {
    let x: Double
    let y: Double
}

final class RemoteSurfaceController {
    private var width: CGFloat = 0
    private var height: CGFloat = 0

    func update(size: CGSize) {
        width = max(0, size.width)
        height = max(0, size.height)
    }

    func toNormalised(_ p: CGPoint) -> NormalisedPoint {
        guard width > 0, height > 0 else { return NormalisedPoint(x: 0, y: 0) }
        let x = max(0, min(1, Double(p.x / width)))
        let y = max(0, min(1, Double(p.y / height)))
        return NormalisedPoint(x: x, y: y)
    }
}
