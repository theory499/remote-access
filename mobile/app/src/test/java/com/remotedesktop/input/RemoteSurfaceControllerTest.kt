package com.remotedesktop.input

import org.junit.Assert.assertEquals
import org.junit.Test

class RemoteSurfaceControllerTest {

    @Test fun returnsZeroBeforeSurfaceIsSized() {
        val c = RemoteSurfaceController()
        val p = c.toNormalised(100f, 100f)
        assertEquals(0.0, p.x, 0.0)
        assertEquals(0.0, p.y, 0.0)
    }

    @Test fun mapsTouchToNormalisedCoordinates() {
        val c = RemoteSurfaceController()
        c.updateSurfaceSize(1000, 500)
        val centre = c.toNormalised(500f, 250f)
        assertEquals(0.5, centre.x, 0.001)
        assertEquals(0.5, centre.y, 0.001)
    }

    @Test fun clampsOutOfBoundsTouches() {
        val c = RemoteSurfaceController()
        c.updateSurfaceSize(1000, 500)
        val tl = c.toNormalised(-50f, -100f)
        assertEquals(0.0, tl.x, 0.0)
        assertEquals(0.0, tl.y, 0.0)
        val br = c.toNormalised(5000f, 5000f)
        assertEquals(1.0, br.x, 0.0)
        assertEquals(1.0, br.y, 0.0)
    }

    @Test fun mapsCornersExactly() {
        val c = RemoteSurfaceController()
        c.updateSurfaceSize(800, 600)
        assertEquals(0.0, c.toNormalised(0f, 0f).x, 0.0)
        assertEquals(0.0, c.toNormalised(0f, 0f).y, 0.0)
        assertEquals(1.0, c.toNormalised(800f, 600f).x, 0.0)
        assertEquals(1.0, c.toNormalised(800f, 600f).y, 0.0)
    }
}
