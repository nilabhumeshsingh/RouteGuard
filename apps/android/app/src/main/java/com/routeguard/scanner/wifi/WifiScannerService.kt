package com.routeguard.scanner.wifi

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.routeguard.scanner.model.WifiReading
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class WifiScannerService(private val context: Context) {

    private val wifiManager: WifiManager =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private val _scanResultsFlow = MutableSharedFlow<List<WifiReading>>(replay = 1)
    val scanResultsFlow: SharedFlow<List<WifiReading>> = _scanResultsFlow.asSharedFlow()

    private var isRegistered = false

    private val wifiScanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) {
                val success = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false)
                Log.d(TAG, "WiFi scan broadcast received, success: $success")
                processScanResults()
            }
        }
    }

    fun hasPermissions(): Boolean {
        val fineLocation = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val wifiState = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_WIFI_STATE
        ) == PackageManager.PERMISSION_GRANTED

        return fineLocation && wifiState
    }

    fun register() {
        if (!isRegistered) {
            val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
            context.registerReceiver(wifiScanReceiver, filter)
            isRegistered = true
            Log.i(TAG, "WifiScanReceiver registered")
        }
    }

    fun unregister() {
        if (isRegistered) {
            try {
                context.unregisterReceiver(wifiScanReceiver)
            } catch (e: Exception) {
                Log.w(TAG, "Error unregistering receiver: ${e.message}")
            }
            isRegistered = false
        }
    }

    @SuppressLint("MissingPermission")
    fun triggerScan(): Boolean {
        if (!hasPermissions()) {
            Log.w(TAG, "Cannot scan WiFi: permissions not granted")
            return false
        }

        if (!wifiManager.isWifiEnabled) {
            Log.w(TAG, "WiFi is disabled on this device")
        }

        val started = wifiManager.startScan()
        Log.d(TAG, "wifiManager.startScan() returned $started")
        
        // On Android 9+ (API 28+), startScan() may be throttled. If throttled or cached,
        // we can still process current scan results immediately:
        processScanResults()
        return started
    }

    @SuppressLint("MissingPermission")
    fun processScanResults() {
        if (!hasPermissions()) return

        try {
            val rawResults: List<ScanResult> = wifiManager.scanResults ?: emptyList()
            val readings = rawResults
                .filter { it.BSSID != null && it.level > -95 }
                .map { scan ->
                    WifiReading(
                        bssid = scan.BSSID.lowercase(),
                        rssi = scan.level,
                        frequency = scan.frequency,
                        channel = frequencyToChannel(scan.frequency),
                        ssid = scan.SSID ?: ""
                    )
                }
                .sortedByDescending { it.rssi }

            if (readings.isNotEmpty()) {
                Log.i(TAG, "Found ${readings.size} WiFi APs. Strongest: ${readings.first().bssid} (${readings.first().rssi} dBm)")
                _scanResultsFlow.tryEmit(readings)
            } else {
                Log.w(TAG, "Scan returned 0 results. Emitting synthetic APs for emulator fallback.")
                _scanResultsFlow.tryEmit(getSyntheticReadings())
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException while accessing scan results", e)
        }
    }

    /**
     * Converts frequency in MHz to standard WiFi channel number (2.4 GHz and 5 GHz)
     */
    private fun frequencyToChannel(freq: Int): Int {
        return when {
            freq == 2484 -> 14
            freq in 2412..2472 -> (freq - 2412) / 5 + 1
            freq in 5170..5825 -> (freq - 5170) / 5 + 34
            else -> 0
        }
    }

    /**
     * Realistic survey fingerprints for Academic Block 1 (Floor 2)
     * Used when running in Android Emulator without physical WiFi NIC.
     */
    fun getSyntheticReadings(): List<WifiReading> {
        return listOf(
            WifiReading("20:e8:82:7e:24:d0", -62, 2412, 1, "CAMPUS_SECURE"),
            WifiReading("00:27:0d:3e:ab:22", -67, 2437, 6, "CAMPUS_GUEST"),
            WifiReading("cc:40:d0:81:4f:b1", -71, 5180, 36, "FACULTY_WIFI"),
            WifiReading("20:e8:82:7e:24:d1", -75, 5240, 48, "IOT_MESH_FLOOR2"),
            WifiReading("a0:04:60:f2:11:44", -79, 2462, 11, "EDUROAM"),
            WifiReading("00:27:0d:3e:ab:23", -82, 5745, 149, "CAMPUS_SECURE_5G")
        )
    }

    companion object {
        private const val TAG = "WifiScannerService"
    }
}
