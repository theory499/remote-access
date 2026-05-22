package com.remotedesktop.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.remotedesktop.R
import com.remotedesktop.RemoteDesktopApp
import com.remotedesktop.config.FirebaseConfig
import com.remotedesktop.databinding.ActivityQrScannerBinding
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class QrScannerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityQrScannerBinding
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val scanner = BarcodeScanning.getClient()
    private val handled = AtomicBoolean(false)

    private val requestCamera = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera()
        else {
            Toast.makeText(this, R.string.qr_camera_denied, Toast.LENGTH_LONG).show()
            // Even without the camera, the gallery picker is still usable,
            // so keep the activity open rather than finishing.
        }
    }

    private val pickImage = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) scanImage(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQrScannerBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.statusText.setText(R.string.qr_status_aim)

        binding.galleryButton.setOnClickListener {
            pickImage.launch(PickVisualMediaRequest(
                ActivityResultContracts.PickVisualMedia.ImageOnly
            ))
        }

        if (hasCameraPermission()) startCamera()
        else requestCamera.launch(Manifest.permission.CAMERA)
    }

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.previewView.surfaceProvider)
            }
            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(cameraExecutor) { proxy -> analyseFrame(proxy) }
            try {
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            } catch (err: Exception) {
                Log.e(TAG, "Camera bind failed", err)
                Toast.makeText(this, err.localizedMessage, Toast.LENGTH_LONG).show()
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun analyseFrame(proxy: ImageProxy) {
        val mediaImage = proxy.image
        if (mediaImage == null) { proxy.close(); return }
        val image = InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    if (barcode.format != Barcode.FORMAT_QR_CODE) continue
                    val raw = barcode.rawValue ?: continue
                    handleScan(raw)
                    return@addOnSuccessListener
                }
            }
            .addOnCompleteListener { proxy.close() }
    }

    private fun scanImage(uri: Uri) {
        binding.statusText.setText(R.string.qr_status_saving)
        val image = try {
            InputImage.fromFilePath(this, uri)
        } catch (err: Exception) {
            Toast.makeText(
                this,
                getString(R.string.qr_image_read_failed, err.localizedMessage ?: "unknown"),
                Toast.LENGTH_LONG
            ).show()
            binding.statusText.setText(R.string.qr_status_aim)
            return
        }
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val raw = barcodes.firstOrNull {
                    it.format == Barcode.FORMAT_QR_CODE && it.rawValue != null
                }?.rawValue
                if (raw != null) {
                    handleScan(raw)
                } else {
                    Toast.makeText(this, R.string.qr_no_code_in_image, Toast.LENGTH_LONG).show()
                    binding.statusText.setText(R.string.qr_status_aim)
                }
            }
            .addOnFailureListener { err ->
                Toast.makeText(
                    this,
                    getString(R.string.qr_image_read_failed, err.localizedMessage ?: "unknown"),
                    Toast.LENGTH_LONG
                ).show()
                binding.statusText.setText(R.string.qr_status_aim)
            }
    }

    private fun handleScan(raw: String) {
        if (!handled.compareAndSet(false, true)) return
        val config = FirebaseConfig.fromQrPayload(raw)
        if (config == null) {
            runOnUiThread {
                binding.statusText.setText(R.string.qr_status_invalid)
                Toast.makeText(this, R.string.qr_status_invalid, Toast.LENGTH_SHORT).show()
                handled.set(false)
            }
            return
        }
        runOnUiThread {
            binding.statusText.setText(R.string.qr_status_saving)
            try {
                val app = application as RemoteDesktopApp
                app.configStore.save(config)
                app.initialiseFirebase(config)
                Toast.makeText(this, R.string.qr_status_ok, Toast.LENGTH_SHORT).show()
                setResult(RESULT_OK, Intent().putExtra(EXTRA_DATABASE_URL, config.databaseURL))
                finish()
            } catch (err: Exception) {
                Toast.makeText(this, err.localizedMessage, Toast.LENGTH_LONG).show()
                handled.set(false)
                binding.statusText.setText(R.string.qr_status_aim)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        scanner.close()
    }

    companion object {
        private const val TAG = "QrScannerActivity"
        const val EXTRA_DATABASE_URL = "database_url"
    }
}
