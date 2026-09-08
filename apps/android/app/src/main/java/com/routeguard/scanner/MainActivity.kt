package com.routeguard.scanner

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.routeguard.scanner.bridge.WebAppInterface
import com.routeguard.scanner.databinding.ActivityMainBinding
import com.routeguard.scanner.model.PositionEstimateResponse
import com.routeguard.scanner.model.PreviousPosition
import com.routeguard.scanner.network.PositionApiClient
import com.routeguard.scanner.wifi.WifiScannerService
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var wifiScanner: WifiScannerService
    private lateinit var apiClient: PositionApiClient
    private val gson = Gson()

    private var isScanning = false
    private var scanJob: Job? = null
    private var lastEstimate: PositionEstimateResponse? = null
    private var isControlsExpanded = true

    // Default endpoints
    private var webUrl = "https://muj-wifi-bssid-mapper.vercel.app"
    private var apiUrl = "https://muj-wifi-bssid-mapper.vercel.app"

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        if (fineLocationGranted) {
            Toast.makeText(this, "Location permission granted for WiFi scanning", Toast.LENGTH_SHORT).show()
            startContinuousScanning()
        } else {
            Toast.makeText(this, "Location permission is required for indoor WiFi positioning", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        wifiScanner = WifiScannerService(this)
        apiClient = PositionApiClient(apiUrl)

        setupUI()
        setupWebView()
        observeScanResults()

        checkPermissionsAndStart()
    }

    private fun setupUI() {
        binding.etServerUrl.setText(apiUrl)

        // Preset Vercel Button
        binding.btnPresetVercel.setOnClickListener {
            apiUrl = "https://muj-wifi-bssid-mapper.vercel.app"
            webUrl = "https://muj-wifi-bssid-mapper.vercel.app"
            binding.etServerUrl.setText(apiUrl)
            apiClient.baseUrl = apiUrl
            binding.webView.loadUrl(webUrl)
            Toast.makeText(this, "Switched to Vercel Cloud", Toast.LENGTH_SHORT).show()
        }

        // Preset Localhost Button (Android Emulator 10.0.2.2 or LAN IP)
        binding.btnPresetLocal.setOnClickListener {
            apiUrl = "http://10.0.2.2:4000"
            webUrl = "http://10.0.2.2:3000"
            binding.etServerUrl.setText(apiUrl)
            apiClient.baseUrl = apiUrl
            binding.webView.loadUrl(webUrl)
            Toast.makeText(this, "Switched to Localhost (10.0.2.2)", Toast.LENGTH_SHORT).show()
        }

        // Toggle Expand/Collapse Drawer
        binding.btnToggleExpand.setOnClickListener {
            isControlsExpanded = !isControlsExpanded
            binding.layoutExpandedOptions.visibility = if (isControlsExpanded) View.VISIBLE else View.GONE
            binding.btnToggleExpand.setImageResource(
                if (isControlsExpanded) android.R.drawable.arrow_up_float
                else android.R.drawable.arrow_down_float
            )
        }

        // Start / Stop Continuous Scan Button
        binding.btnStartStopScan.setOnClickListener {
            if (isScanning) {
                stopScanning()
            } else {
                startContinuousScanning()
            }
        }

        // Single Scan Button
        binding.btnSingleScan.setOnClickListener {
            triggerSingleScan()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings: WebSettings = binding.webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        // Bridge interface accessible in JS as 'AndroidBridge'
        val bridge = WebAppInterface(
            context = this,
            onTriggerScan = { triggerSingleScan() },
            getCurrentEstimate = { lastEstimate }
        )
        binding.webView.addJavascriptInterface(bridge, "AndroidBridge")

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.progressBar.progress = newProgress
                } else {
                    binding.progressBar.visibility = View.GONE
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("WebViewConsole", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()}")
                return true
            }
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                Log.i(TAG, "WebView loading: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                Log.i(TAG, "WebView finished: $url")
                // Forward initial position estimate if already available
                lastEstimate?.let { injectPositionToWebView(it) }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                Log.w(TAG, "WebView error: ${error?.description}")
            }
        }

        binding.webView.loadUrl(webUrl)
    }

    private fun checkPermissionsAndStart() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_WIFI_STATE,
            Manifest.permission.CHANGE_WIFI_STATE
        )

        val needsRequest = permissions.any {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needsRequest) {
            permissionLauncher.launch(permissions)
        } else {
            startContinuousScanning()
        }
    }

    private fun observeScanResults() {
        lifecycleScope.launch {
            wifiScanner.scanResultsFlow.collect { readings ->
                if (readings.isEmpty()) return@collect

                binding.tvStatusBadge.text = "Dispatching"
                binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_active)

                val prev = lastEstimate?.let { PreviousPosition(it.x, it.y, it.floorId) }

                // Post to Vercel or localhost API
                val result = apiClient.estimatePosition(readings, prev)

                result.onSuccess { (estimate, latency) ->
                    lastEstimate = estimate
                    binding.tvStatusBadge.text = "Live (${latency}ms)"
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_active)
                    binding.tvTelemetry.text = "APs: ${readings.size} | Near: ${estimate.nearestPlaceName ?: "Corridor"} | (x=${"%.1f".format(estimate.x)}, y=${"%.1f".format(estimate.y)})"

                    // Forward estimated position to the React PWA running inside WebView
                    injectPositionToWebView(estimate)
                }.onFailure { err ->
                    binding.tvStatusBadge.text = "API Err"
                    binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_idle)
                    binding.tvTelemetry.text = "APs: ${readings.size} | POST Failed: ${err.message}"
                }
            }
        }
    }

    private fun injectPositionToWebView(estimate: PositionEstimateResponse) {
        val json = gson.toJson(estimate)
        val script = """
            if (window.onNativePositionUpdate) {
                window.onNativePositionUpdate($json);
            } else {
                window.dispatchEvent(new CustomEvent('nativePositionUpdate', { detail: $json }));
            }
        """.trimIndent()

        binding.webView.post {
            binding.webView.evaluateJavascript(script, null)
        }
    }

    private fun startContinuousScanning() {
        if (isScanning) return
        isScanning = true

        binding.btnStartStopScan.text = "Stop WiFi Scan"
        binding.btnStartStopScan.setBackgroundColor(ContextCompat.getColor(this, R.color.emergency_red))

        wifiScanner.register()

        scanJob = lifecycleScope.launch {
            while (isActive && isScanning) {
                binding.tvStatusBadge.text = "Scanning"
                wifiScanner.triggerScan()
                delay(3000) // Continuous 3-second cycle
            }
        }
    }

    private fun stopScanning() {
        isScanning = false
        scanJob?.cancel()
        scanJob = null

        wifiScanner.unregister()
        binding.btnStartStopScan.text = "Start Live WiFi Scan"
        binding.btnStartStopScan.setBackgroundColor(ContextCompat.getColor(this, R.color.primary))
        binding.tvStatusBadge.text = "Stopped"
        binding.tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_idle)
    }

    private fun triggerSingleScan() {
        lifecycleScope.launch {
            wifiScanner.register()
            wifiScanner.triggerScan()
        }
    }

    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopScanning()
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}
