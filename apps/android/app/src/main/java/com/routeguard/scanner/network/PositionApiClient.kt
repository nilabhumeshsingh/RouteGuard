package com.routeguard.scanner.network

import android.util.Log
import com.google.gson.Gson
import com.routeguard.scanner.model.PositionEstimateRequest
import com.routeguard.scanner.model.PositionEstimateResponse
import com.routeguard.scanner.model.WifiReading
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class PositionApiClient(var baseUrl: String = "https://muj-wifi-bssid-mapper.vercel.app") {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    suspend fun estimatePosition(
        fingerprints: List<WifiReading>,
        previousPosition: com.routeguard.scanner.model.PreviousPosition? = null
    ): Result<Pair<PositionEstimateResponse, Long>> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        try {
            val normalizedBaseUrl = baseUrl.trimEnd('/')
            val endpoint = "$normalizedBaseUrl/api/position/estimate"

            val requestData = PositionEstimateRequest(
                items = fingerprints,
                fingerprints = fingerprints,
                previousPosition = previousPosition
            )
            val jsonPayload = gson.toJson(requestData)

            Log.d(TAG, "Dispatching ${fingerprints.size} WiFi APs to $endpoint")

            val request = Request.Builder()
                .url(endpoint)
                .post(jsonPayload.toRequestBody(jsonMediaType))
                .addHeader("Accept", "application/json")
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "RouteGuardScanner-Android/1.0")
                .build()

            val response = client.newCall(request).execute()
            val latency = System.currentTimeMillis() - startTime

            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Empty body"
                Log.e(TAG, "HTTP ${response.code} from $endpoint: $errorBody")
                return@withContext Result.failure(Exception("HTTP ${response.code}: $errorBody"))
            }

            val bodyString = response.body?.string()
                ?: return@withContext Result.failure(Exception("Response body was null"))

            val estimate = gson.fromJson(bodyString, PositionEstimateResponse::class.java)
            Log.i(TAG, "Position estimate received in ${latency}ms: (${estimate.x}, ${estimate.y}) nearest=${estimate.nearestPlaceName}")

            Result.success(Pair(estimate, latency))
        } catch (e: Exception) {
            val latency = System.currentTimeMillis() - startTime
            Log.e(TAG, "Failed to post WiFi scan to $baseUrl in ${latency}ms: ${e.message}", e)
            Result.failure(e)
        }
    }

    companion object {
        private const val TAG = "PositionApiClient"
    }
}
