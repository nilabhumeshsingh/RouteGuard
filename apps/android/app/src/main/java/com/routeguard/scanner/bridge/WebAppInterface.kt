package com.routeguard.scanner.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.google.gson.Gson
import com.routeguard.scanner.model.PositionEstimateResponse

class WebAppInterface(
    private val context: Context,
    private val onTriggerScan: () -> Unit,
    private val getCurrentEstimate: () -> PositionEstimateResponse?
) {
    private val gson = Gson()

    @JavascriptInterface
    fun requestScanNow() {
        onTriggerScan()
    }

    @JavascriptInterface
    fun getLatestPositionJson(): String {
        val current = getCurrentEstimate()
        return if (current != null) gson.toJson(current) else "{}"
    }

    @JavascriptInterface
    fun isNativeScannerActive(): Boolean {
        return true
    }

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
}
