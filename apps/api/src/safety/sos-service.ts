import { LatchingAlarmStateMachine } from "./alarm-state-machine.js";

export type SOSPriority = "CRITICAL" | "HIGH";
export type SOSStatus = "DISPATCHED" | "ACKNOWLEDGED" | "RESPONDING" | "RESOLVED" | "CANCELLED";
export type SOSEmergencyType = "panic" | "medical" | "fire" | "entrapment" | "assault" | "hazard" | "general";
export type SOSActionType = "DISPATCH" | "ACKNOWLEDGE" | "UPDATE_LOCATION" | "RESPOND" | "RESOLVE" | "CANCEL";

export interface SOSCoordinates {
  x: number;
  y: number;
  floorId: string;
  accuracyMeters?: number;
  buildingId?: string;
}

export interface SOSRequest {
  userId: string;
  userName?: string;
  coordinates: SOSCoordinates;
  emergencyType?: SOSEmergencyType;
  message?: string;
  batteryLevel?: number;
  medicalNotes?: string;
  triggerCampusAlarm?: boolean;
}

export interface SOSAlert {
  id: string;
  userId: string;
  userName?: string;
  priority: SOSPriority;
  status: SOSStatus;
  coordinates: SOSCoordinates;
  emergencyType: SOSEmergencyType;
  message: string;
  batteryLevel?: number;
  dispatchedAt: number; // Unix timestamp in ms
  acknowledgedAt?: number;
  resolvedAt?: number;
  assignedResponder?: string;
  resolutionNotes?: string;
  dispatchChannels: string[];
  timeline: Array<{
    action: SOSActionType;
    timestamp: number;
    actor?: string;
    details?: string;
  }>;
}

export interface SOSServiceOptions {
  alarmStateMachine?: LatchingAlarmStateMachine;
  defaultFloorId?: string;
  dispatchChannels?: string[];
}

export class SOSValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SOSValidationError";
  }
}

export class SOSNotFoundError extends Error {
  constructor(sosId: string) {
    super(`SOS Alert with ID '${sosId}' was not found.`);
    this.name = "SOSNotFoundError";
  }
}

export class SOSDispatcherService {
  private alerts: Map<string, SOSAlert> = new Map();
  private alarmStateMachine?: LatchingAlarmStateMachine;
  private defaultFloorId: string;
  private defaultChannels: string[];
  private listeners: Set<(alert: SOSAlert, action: SOSActionType) => void> = new Set();

  constructor(options: SOSServiceOptions = {}) {
    this.alarmStateMachine = options.alarmStateMachine;
    this.defaultFloorId = options.defaultFloorId || "floor-2";
    this.defaultChannels = options.dispatchChannels || [
      "campus_security_console",
      "emergency_response_radio",
      "mobile_push_dispatcher",
      "safety_audit_trail"
    ];
  }

  public subscribe(listener: (alert: SOSAlert, action: SOSActionType) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Dispatches a high-priority SOS emergency alert.
   * Captures precise user coordinates and dispatch timestamp.
   */
  public dispatchSOS(request: SOSRequest): SOSAlert {
    if (!request.userId || request.userId.trim().length === 0) {
      throw new SOSValidationError("User ID is required for emergency SOS dispatch.");
    }

    if (
      !request.coordinates ||
      typeof request.coordinates.x !== "number" ||
      isNaN(request.coordinates.x) ||
      typeof request.coordinates.y !== "number" ||
      isNaN(request.coordinates.y)
    ) {
      throw new SOSValidationError("Valid numeric user coordinates (x, y) must be captured for emergency dispatch.");
    }

    const dispatchedAt = Date.now();
    const sosId = `sos-${dispatchedAt}-${Math.random().toString(36).slice(2, 7)}`;
    const floorId = request.coordinates.floorId || this.defaultFloorId;

    const alert: SOSAlert = {
      id: sosId,
      userId: request.userId,
      userName: request.userName,
      priority: "CRITICAL",
      status: "DISPATCHED",
      coordinates: {
        x: request.coordinates.x,
        y: request.coordinates.y,
        floorId,
        accuracyMeters: request.coordinates.accuracyMeters ?? 2.5,
        buildingId: request.coordinates.buildingId ?? "Academic Block 1"
      },
      emergencyType: request.emergencyType ?? "panic",
      message: request.message ?? "URGENT: Emergency SOS triggered by campus user.",
      batteryLevel: request.batteryLevel,
      dispatchedAt,
      dispatchChannels: [...this.defaultChannels],
      timeline: [
        {
          action: "DISPATCH",
          timestamp: dispatchedAt,
          actor: request.userId,
          details: `SOS alert dispatched at coordinates (${request.coordinates.x}, ${request.coordinates.y}) on floor ${floorId}`
        }
      ]
    };

    this.alerts.set(alert.id, alert);

    // If requested or alarm machine configured, trigger latched campus alarm
    if (request.triggerCampusAlarm && this.alarmStateMachine) {
      this.alarmStateMachine.triggerAlarm({
        deviceId: `sos-user-${request.userId}`,
        zoneId: `zone-sos-user-pos`,
        floorId,
        kind: "hazard",
        severity: "critical",
        message: `High-priority SOS from user ${request.userName || request.userId} at (${request.coordinates.x}, ${request.coordinates.y})`,
        timestamp: dispatchedAt
      });
    }

    this.notify(alert, "DISPATCH");
    return alert;
  }

  /**
   * First responder or dispatcher acknowledges the emergency.
   */
  public acknowledgeSOS(sosId: string, responderId: string, notes?: string): SOSAlert {
    const alert = this.alerts.get(sosId);
    if (!alert) {
      throw new SOSNotFoundError(sosId);
    }

    const timestamp = Date.now();
    alert.status = "ACKNOWLEDGED";
    alert.assignedResponder = responderId;
    alert.acknowledgedAt = timestamp;
    alert.timeline.push({
      action: "ACKNOWLEDGE",
      timestamp,
      actor: responderId,
      details: notes || `Alert acknowledged by emergency responder ${responderId}`
    });

    this.notify(alert, "ACKNOWLEDGE");
    return alert;
  }

  /**
   * Update moving user coordinates in real-time.
   */
  public updateLocation(sosId: string, coords: SOSCoordinates): SOSAlert {
    const alert = this.alerts.get(sosId);
    if (!alert) {
      throw new SOSNotFoundError(sosId);
    }

    alert.coordinates = {
      ...alert.coordinates,
      ...coords
    };

    alert.timeline.push({
      action: "UPDATE_LOCATION",
      timestamp: Date.now(),
      details: `User location updated to (${coords.x}, ${coords.y})`
    });

    this.notify(alert, "UPDATE_LOCATION");
    return alert;
  }

  /**
   * Resolve an emergency once responder arrives and safety is restored.
   */
  public resolveSOS(sosId: string, responderId: string, resolutionNotes: string): SOSAlert {
    const alert = this.alerts.get(sosId);
    if (!alert) {
      throw new SOSNotFoundError(sosId);
    }

    const timestamp = Date.now();
    alert.status = "RESOLVED";
    alert.resolvedAt = timestamp;
    alert.resolutionNotes = resolutionNotes;
    alert.timeline.push({
      action: "RESOLVE",
      timestamp,
      actor: responderId,
      details: resolutionNotes
    });

    this.notify(alert, "RESOLVE");
    return alert;
  }

  /**
   * Cancel false alarm or user-initiated cancellation.
   */
  public cancelSOS(sosId: string, cancelledBy: string, reason = "Cancelled by user"): SOSAlert {
    const alert = this.alerts.get(sosId);
    if (!alert) {
      throw new SOSNotFoundError(sosId);
    }

    const timestamp = Date.now();
    alert.status = "CANCELLED";
    alert.timeline.push({
      action: "CANCEL",
      timestamp,
      actor: cancelledBy,
      details: reason
    });

    this.notify(alert, "CANCEL");
    return alert;
  }

  public getAlert(sosId: string): SOSAlert | undefined {
    const alert = this.alerts.get(sosId);
    return alert ? JSON.parse(JSON.stringify(alert)) : undefined;
  }

  public getActiveAlerts(): SOSAlert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.status === "DISPATCHED" || a.status === "ACKNOWLEDGED" || a.status === "RESPONDING")
      .map((a) => JSON.parse(JSON.stringify(a)));
  }

  public getAllAlerts(): SOSAlert[] {
    return Array.from(this.alerts.values()).map((a) => JSON.parse(JSON.stringify(a)));
  }

  private notify(alert: SOSAlert, action: SOSActionType): void {
    for (const listener of this.listeners) {
      try {
        listener(alert, action);
      } catch {
        // Ignore listener exceptions
      }
    }
  }
}

export const defaultSOSDispatcher = new SOSDispatcherService();
