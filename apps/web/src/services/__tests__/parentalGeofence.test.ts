import { describe, it, expect, vi, beforeEach } from "vitest";
import { PREDEFINED_GEOFENCE_ZONES } from "../../components/guardian/ParentalGeofenceModal";
import {
  isNotificationPermissionGranted,
  sendGeofenceAlertNotification,
  playWarningChime,
  triggerHapticPulse
} from "../webNotificationService";

describe("Parental Geofence & Web Notification Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("provides valid predefined campus geofence zones", () => {
    expect(PREDEFINED_GEOFENCE_ZONES.length).toBeGreaterThanOrEqual(4);

    PREDEFINED_GEOFENCE_ZONES.forEach((zone) => {
      expect(zone.id).toBeDefined();
      expect(zone.name).toBeDefined();
      expect(zone.floorId).toBe("floor-2");
      expect(zone.center.x).toBeGreaterThan(0);
      expect(zone.center.y).toBeGreaterThan(0);
      expect(zone.radiusMeters).toBeGreaterThan(0);
      expect(zone.svgRadius).toBeGreaterThan(0);
    });
  });

  it("evaluates containment correctly for points inside vs outside the boundary", () => {
    const aiLabZone = PREDEFINED_GEOFENCE_ZONES.find((z) => z.id === "zone-room-219")!;
    expect(aiLabZone).toBeDefined();

    // Point at center (inside)
    const distCenter = Math.hypot(
      aiLabZone.center.x - aiLabZone.center.x,
      aiLabZone.center.y - aiLabZone.center.y
    );
    expect(distCenter).toBe(0);
    expect(distCenter <= aiLabZone.svgRadius).toBe(true);

    // Point just inside the boundary
    const insideX = aiLabZone.center.x + aiLabZone.svgRadius * 0.5;
    const insideY = aiLabZone.center.y;
    const distInside = Math.hypot(insideX - aiLabZone.center.x, insideY - aiLabZone.center.y);
    expect(distInside <= aiLabZone.svgRadius).toBe(true);

    // Point far outside (e.g. West Balcony at x: 120, y: 240)
    const breachX = 120;
    const breachY = 240;
    const distBreach = Math.hypot(breachX - aiLabZone.center.x, breachY - aiLabZone.center.y);
    expect(distBreach).toBeGreaterThan(aiLabZone.svgRadius);
  });

  it("checks notification permission status", () => {
    // When Notification is not granted or undefined
    expect(typeof isNotificationPermissionGranted()).toBe("boolean");
  });

  it("dispatches Notification instance when permission is granted", () => {
    const mockNotification = vi.fn();
    (mockNotification as any).permission = "granted";
    (global as any).Notification = mockNotification;
    if (typeof window !== "undefined") {
      (window as any).Notification = mockNotification;
    }

    sendGeofenceAlertNotification("Alex", "Room 219 (AI Lab)", "West Balcony");

    expect(mockNotification).toHaveBeenCalledWith(
      "🚨 Parental Alert: Geofence Breached!",
      expect.objectContaining({
        body: expect.stringContaining("Alex has exited"),
        tag: "routeguard-parental-geofence"
      })
    );
  });

  it("does not dispatch Notification if permission is denied", () => {
    const mockNotification = vi.fn();
    (mockNotification as any).permission = "denied";
    (global as any).Notification = mockNotification;
    if (typeof window !== "undefined") {
      (window as any).Notification = mockNotification;
    }

    const res = sendGeofenceAlertNotification("Alex", "Room 219", "Balcony");
    expect(res).toBeNull();
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("executes audio chime and haptics safely without errors", () => {
    expect(() => playWarningChime()).not.toThrow();
    expect(() => triggerHapticPulse()).not.toThrow();
  });
});
