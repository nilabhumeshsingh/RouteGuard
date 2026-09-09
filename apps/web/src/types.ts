import { HazardOverlay, RouteResult, PositionEstimate } from "@routeguard/shared";

export type SnapPoint = "collapsed" | "half" | "expanded";

export type FloorId = "floor-1" | "floor-2" | "floor-3";

export type MapViewMode = "3D" | "2D" | "Google";

export interface MapLayerConfig {
  rooms: boolean;
  labels: boolean;
  pois: boolean;
  emergencyEquipment: boolean;
  hazards: boolean;
}

export interface UserPositionState {
  x: number;
  y: number;
  floorId: FloorId;
  uncertaintyRadius: number;
  nearestPlaceName: string;
  heading?: number;
}

export interface EmergencyState {
  isAlarmActive: boolean;
  alarmLocation: string;
  fireZoneId: string | null;
  smokeForecastMinutes: 0 | 2 | 5 | 10;
  activeHazards: HazardOverlay[];
}

export interface GuardianState {
  isPaired: boolean;
  pairingCode: string;
  childName: string;
  childPosition: {
    x: number;
    y: number;
    floorId: FloorId;
    placeName: string;
  };
  batteryLevel: number;
  lastUpdatedSecondsAgo: number;
  inSafeZone: boolean;
  geofenceWarning: string | null;
}

export interface GeofenceZoneConfig {
  id: string;
  name: string;
  floorId: FloorId;
  center: { x: number; y: number };
  radiusMeters: number;
  svgRadius: number;
}

export interface ParentalModeState {
  isActive: boolean;
  selectedZone: GeofenceZoneConfig;
  alertOnExit: boolean;
  webNotificationsEnabled: boolean;
  soundEnabled: boolean;
  isBreached: boolean;
  lastBreachTimestamp: number | null;
  breachMessage: string | null;
}
