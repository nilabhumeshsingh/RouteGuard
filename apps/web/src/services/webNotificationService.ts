/**
 * Web Notification & Audio Alert Service for Parental Geofencing
 */

const getNotificationClass = (): typeof Notification | null => {
  if (typeof window !== "undefined" && "Notification" in window) {
    return window.Notification;
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).Notification) {
    return (globalThis as any).Notification;
  }
  return null;
};

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const NotificationClass = getNotificationClass();
  if (!NotificationClass) {
    console.warn("[WebNotification] Notification API not supported in this environment");
    return "denied";
  }

  try {
    const permission = await NotificationClass.requestPermission();
    return permission;
  } catch (error) {
    console.error("[WebNotification] Failed to request permission:", error);
    return "denied";
  }
}

export function isNotificationPermissionGranted(): boolean {
  const NotificationClass = getNotificationClass();
  if (!NotificationClass) {
    return false;
  }
  return NotificationClass.permission === "granted";
}

export function sendGeofenceAlertNotification(
  childName: string,
  zoneName: string,
  currentPlace: string
): Notification | null {
  const NotificationClass = getNotificationClass();
  if (!NotificationClass || NotificationClass.permission !== "granted") {
    return null;
  }

  try {
    const title = `🚨 Parental Alert: Geofence Breached!`;
    const options: NotificationOptions = {
      body: `${childName} has exited the designated safe zone (${zoneName})! Current location: ${currentPlace}. Tap to open RouteGuard.`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "routeguard-parental-geofence",
      requireInteraction: true,
      silent: false
    };

    const notification = new NotificationClass(title, options);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.warn("[WebNotification] Error dispatching notification:", error);
    return null;
  }
}

/**
 * Synthesizes an audible emergency alert chime via browser Web Audio API.
 * Guarantees the parent hears an audible signal regardless of system notification sound settings.
 */
export function playWarningChime(): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Two-tone urgent attention chime (880Hz then 1174Hz)
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1174, now + 0.15);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second chime pulse
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174, now + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.4);

    gain2.gain.setValueAtTime(0.3, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.2);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.warn("[WebNotification] Web Audio playback failed or blocked:", e);
  }
}

/**
 * Triggers hardware vibration pulse pattern on supported mobile / PWA devices.
 */
export function triggerHapticPulse(): void {
  if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // Ignore vibration errors
    }
  }
}

/**
 * Calculates great-circle distance between two geographic points using Haversine formula (in meters).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

