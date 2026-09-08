package com.routeguard.scanner.model

import com.google.gson.annotations.SerializedName

/**
 * WiFi Access Point observation matching RouteGuard API schema
 */
data class WifiReading(
    @SerializedName("bssid") val bssid: String,
    @SerializedName("signal") val signal: Int,
    @SerializedName("rssi") val rssi: Int = signal,
    @SerializedName("frequency") val frequency: Int = 2412,
    @SerializedName("channel") val channel: Int = 1,
    @SerializedName("ssid") val ssid: String = ""
)

/**
 * Ingestion request payload dispatched to /api/position/estimate
 */
data class PositionEstimateRequest(
    @SerializedName("items") val items: List<WifiReading>,
    @SerializedName("fingerprints") val fingerprints: List<WifiReading> = items,
    @SerializedName("previousPosition") val previousPosition: PreviousPosition? = null
)

data class PreviousPosition(
    @SerializedName("x") val x: Double,
    @SerializedName("y") val y: Double,
    @SerializedName("floorId") val floorId: String = "floor-2"
)

/**
 * Response payload returned from /api/position/estimate
 */
data class PositionEstimateResponse(
    @SerializedName("x") val x: Double,
    @SerializedName("y") val y: Double,
    @SerializedName("floorId") val floorId: String,
    @SerializedName("uncertaintyRadius") val uncertaintyRadius: Double,
    @SerializedName("nearestPlaceName") val nearestPlaceName: String? = null,
    @SerializedName("confidence") val confidence: Double? = null,
    @SerializedName("calculationMethod") val calculationMethod: String? = null,
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis()
)
