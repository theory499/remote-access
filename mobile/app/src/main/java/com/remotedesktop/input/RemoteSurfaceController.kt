package com.remotedesktop.input

data class NormalisedPoint(val x: Double, val y: Double)

class RemoteSurfaceController(
    private var surfaceWidth: Int = 0,
    private var surfaceHeight: Int = 0
) {

    fun updateSurfaceSize(width: Int, height: Int) {
        require(width >= 0 && height >= 0) { "surface dimensions must be non-negative" }
        surfaceWidth = width
        surfaceHeight = height
    }

    fun toNormalised(touchX: Float, touchY: Float): NormalisedPoint {
        if (surfaceWidth == 0 || surfaceHeight == 0) return NormalisedPoint(0.0, 0.0)
        val x = (touchX.toDouble() / surfaceWidth).coerceIn(0.0, 1.0)
        val y = (touchY.toDouble() / surfaceHeight).coerceIn(0.0, 1.0)
        return NormalisedPoint(x, y)
    }
}
