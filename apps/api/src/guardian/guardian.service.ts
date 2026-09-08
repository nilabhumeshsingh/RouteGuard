import crypto from "node:crypto";
import { Geofence, GuardianLink } from "@routeguard/shared";
import { broadcastGeofenceAlert } from "../realtime/socket.js";

export interface PairingCodeRecord {
  pairingCode: string;
  pairId: string;
  childId: string;
  childName: string;
  emergencyContact: string;
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
}

export interface PairedChannel {
  pairId: string;
  guardianId: string;
  childId: string;
  childName: string;
  channelKey: string; // 256-bit symmetric encryption key for channel
  pairedAt: number;
  status: "paired" | "revoked";
}

// Ray-casting point-in-polygon algorithm
export function isPointInPolygon(
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const { x, y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00000001) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// Pre-configured Floor 2 approved safe zones
export const DEFAULT_SAFE_ZONES: Geofence[] = [
  {
    id: "zone-west-classrooms",
    name: "West Classroom Wing (Rooms 201-204)",
    floorId: "floor-2",
    polygon: [
      { x: 50, y: 150 },
      { x: 180, y: 150 },
      { x: 180, y: 450 },
      { x: 50, y: 450 }
    ],
    minDwellSeconds: 0
  },
  {
    id: "zone-iot-lab",
    name: "Room 208 IoT Lab & Learning Annex",
    floorId: "floor-2",
    polygon: [
      { x: 180, y: 160 },
      { x: 260, y: 160 },
      { x: 260, y: 260 },
      { x: 180, y: 260 }
    ],
    minDwellSeconds: 0
  },
  {
    id: "zone-central-corridor",
    name: "Main Central Concourse & Hall",
    floorId: "floor-2",
    polygon: [
      { x: 80, y: 250 },
      { x: 750, y: 250 },
      { x: 750, y: 310 },
      { x: 80, y: 310 }
    ],
    minDwellSeconds: 0
  },
  {
    id: "zone-east-classrooms",
    name: "East Academic Wing (Rooms 211-220)",
    floorId: "floor-2",
    polygon: [
      { x: 450, y: 160 },
      { x: 760, y: 160 },
      { x: 760, y: 270 },
      { x: 450, y: 270 }
    ],
    minDwellSeconds: 0
  }
];

class GuardianManager {
  private codes: Map<string, PairingCodeRecord> = new Map();
  private pairs: Map<string, PairedChannel> = new Map();
  private safeZones: Geofence[] = [...DEFAULT_SAFE_ZONES];

  /**
   * Child device generates a single-use 6-digit pairing code with 15-minute expiration
   */
  public generatePairingCode(
    childId: string,
    childName = "Campus Student",
    emergencyContact = "+91 141 3999100"
  ): { pairingCode: string; pairId: string; expiresAt: number } {
    // Generate secure 6-digit numeric code
    const codeNum = Math.floor(100000 + Math.random() * 900000);
    const pairingCode = codeNum.toString();
    const pairId = `pair-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    const record: PairingCodeRecord = {
      pairingCode,
      pairId,
      childId,
      childName,
      emergencyContact,
      createdAt: Date.now(),
      expiresAt,
      claimed: false
    };

    this.codes.set(pairingCode, record);
    return { pairingCode, pairId, expiresAt };
  }

  /**
   * Guardian device claims the code, establishing a secure encrypted tracking channel
   */
  public claimPairingCode(
    guardianId: string,
    pairingCode: string
  ): {
    success: boolean;
    pairId?: string;
    childId?: string;
    childName?: string;
    channelKey?: string;
    room?: string;
    error?: string;
  } {
    const record = this.codes.get(pairingCode.trim());

    if (!record) {
      return { success: false, error: "Invalid pairing code. Please verify and retry." };
    }

    if (record.claimed) {
      return { success: false, error: "This pairing code has already been claimed." };
    }

    if (Date.now() > record.expiresAt) {
      this.codes.delete(pairingCode);
      return { success: false, error: "Pairing code has expired. Please request a new code." };
    }

    // Mark code as claimed
    record.claimed = true;

    // Generate cryptographic shared channel secret key (256-bit)
    const channelKey = crypto.randomBytes(32).toString("hex");

    const channel: PairedChannel = {
      pairId: record.pairId,
      guardianId,
      childId: record.childId,
      childName: record.childName,
      channelKey,
      pairedAt: Date.now(),
      status: "paired"
    };

    this.pairs.set(record.pairId, channel);

    return {
      success: true,
      pairId: record.pairId,
      childId: record.childId,
      childName: record.childName,
      channelKey,
      room: `guardian:${record.pairId}`
    };
  }

  public getPair(pairId: string): PairedChannel | undefined {
    return this.pairs.get(pairId);
  }

  public getAllSafeZones(): Geofence[] {
    return this.safeZones;
  }

  public addSafeZone(zone: Geofence): void {
    this.safeZones.push(zone);
  }

  /**
   * Evaluates child coordinates against approved safe zones using ray-casting point-in-polygon
   */
  public evaluateGeofence(
    point: { x: number; y: number; floorId?: string },
    childId: string,
    pairId?: string
  ): {
    isInsideSafeZone: boolean;
    activeGeofenceId?: string;
    activeGeofenceName?: string;
    alertTriggered: boolean;
    position: { x: number; y: number; floorId: string };
    checkedAt: number;
  } {
    const floorId = point.floorId || "floor-2";
    let matchedZone: Geofence | undefined;

    for (const zone of this.safeZones) {
      if (zone.floorId === floorId && isPointInPolygon({ x: point.x, y: point.y }, zone.polygon)) {
        matchedZone = zone;
        break;
      }
    }

    const isInside = matchedZone !== undefined;
    let alertTriggered = false;

    // If outside approved perimeter, trigger real-time alert to guardian and security
    if (!isInside) {
      alertTriggered = true;
      broadcastGeofenceAlert(pairId, {
        childId,
        pairId,
        position: { x: point.x, y: point.y, floorId },
        isInsideSafeZone: false,
        message: `Geofence perimeter breach: Child ${childId} is outside approved campus zones at (${point.x}, ${point.y})`,
        severity: "warning",
        timestamp: Date.now()
      });
    }

    return {
      isInsideSafeZone: isInside,
      activeGeofenceId: matchedZone?.id,
      activeGeofenceName: matchedZone?.name,
      alertTriggered,
      position: { x: point.x, y: point.y, floorId },
      checkedAt: Date.now()
    };
  }
}

export const guardianService = new GuardianManager();
