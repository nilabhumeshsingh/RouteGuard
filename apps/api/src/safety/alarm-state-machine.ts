import { AlarmEvent, AlarmState, AlarmStateSchema } from "@routeguard/shared";

export interface SecurityOfficerCredentials {
  officerId: string;
  badgeNumber?: string;
  role?: "security_officer" | "chief_warden" | "campus_admin" | "first_responder";
  pin?: string;
  notes?: string;
}

export interface AlarmTriggerPayload {
  deviceId?: string;
  zoneId: string;
  floorId?: string;
  kind?: "fire" | "smoke" | "hazard" | "drill" | "clear";
  severity?: "info" | "warning" | "critical";
  message: string;
  timestamp?: number;
}

export interface AlarmTransitionAuditEntry {
  id: string;
  fromState: AlarmState;
  toState: AlarmState;
  timestamp: number;
  reason: string;
  triggerEvent?: AlarmEvent;
  officer?: SecurityOfficerCredentials;
  notes?: string;
}

export class InvalidStateTransitionError extends Error {
  constructor(public readonly from: AlarmState, public readonly to: AlarmState, message?: string) {
    super(
      message ||
        `Invalid alarm state transition from '${from}' to '${to}'. Allowed cycle: NORMAL -> ALARM_ACTIVE -> AUTHORIZED_CLEAR_PENDING -> NORMAL.`
    );
    this.name = "InvalidStateTransitionError";
  }
}

export class UnauthorizedClearanceError extends Error {
  constructor(message = "Operation rejected: valid security officer credentials are strictly required to unlatch or clear an active alarm.") {
    super(message);
    this.name = "UnauthorizedClearanceError";
  }
}

export class LatchingAlarmError extends Error {
  constructor(message = "Alarm is latched in ALARM_ACTIVE. Direct reset to NORMAL is prohibited; clearance credentials must be provided.") {
    super(message);
    this.name = "LatchingAlarmError";
  }
}

export type CredentialValidator = (credentials: SecurityOfficerCredentials) => boolean;

export interface AlarmStateMachineOptions {
  floorId?: string;
  credentialValidator?: CredentialValidator;
  initialState?: AlarmState;
}

export class LatchingAlarmStateMachine {
  private state: AlarmState = "NORMAL";
  private latched = false;
  private readonly defaultFloorId: string;
  private readonly credentialValidator: CredentialValidator;
  private activeAlarms: Map<string, AlarmEvent> = new Map();
  private auditLog: AlarmTransitionAuditEntry[] = [];
  private listeners: Set<(entry: AlarmTransitionAuditEntry) => void> = new Set();
  private pendingClearanceOfficer: SecurityOfficerCredentials | null = null;

  constructor(options: AlarmStateMachineOptions = {}) {
    this.defaultFloorId = options.floorId || "floor-2";
    this.state = options.initialState || "NORMAL";
    this.latched = this.state !== "NORMAL";
    this.credentialValidator =
      options.credentialValidator ||
      ((creds: SecurityOfficerCredentials) => {
        if (!creds || typeof creds.officerId !== "string" || creds.officerId.trim().length === 0) {
          return false;
        }
        if (creds.role && !["security_officer", "chief_warden", "campus_admin", "first_responder"].includes(creds.role)) {
          return false;
        }
        return true;
      });
  }

  public getState(): AlarmState {
    return this.state;
  }

  public isLatched(): boolean {
    return this.latched;
  }

  public getActiveAlarms(): AlarmEvent[] {
    return Array.from(this.activeAlarms.values());
  }

  public getAuditLog(): AlarmTransitionAuditEntry[] {
    return [...this.auditLog];
  }

  public getPendingClearanceOfficer(): SecurityOfficerCredentials | null {
    return this.pendingClearanceOfficer ? { ...this.pendingClearanceOfficer } : null;
  }

  public subscribe(listener: (entry: AlarmTransitionAuditEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Trigger an alarm event.
   * Strict transition: NORMAL -> ALARM_ACTIVE
   * Latches the system into ALARM_ACTIVE.
   */
  public triggerAlarm(payload: AlarmTriggerPayload): AlarmEvent {
    const timestamp = payload.timestamp ?? Date.now();
    const eventId = `alarm-evt-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

    const event: AlarmEvent = {
      id: eventId,
      deviceId: payload.deviceId ?? `dev-${payload.zoneId}`,
      zoneId: payload.zoneId,
      floorId: payload.floorId ?? this.defaultFloorId,
      kind: payload.kind ?? "fire",
      state: "ALARM_ACTIVE",
      severity: payload.severity ?? "critical",
      message: payload.message,
      timestamp
    };

    const previousState = this.state;

    if (this.state === "NORMAL" || this.state === "AUTHORIZED_CLEAR_PENDING") {
      this.state = "ALARM_ACTIVE";
      this.latched = true;
      this.pendingClearanceOfficer = null;
      this.activeAlarms.set(event.id, event);

      const audit = this.recordAudit({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromState: previousState,
        toState: "ALARM_ACTIVE",
        timestamp,
        reason: `Alarm triggered: ${payload.message} in zone ${payload.zoneId}`,
        triggerEvent: event
      });

      this.notify(audit);
      return event;
    }

    if (this.state === "ALARM_ACTIVE") {
      // System is already latched ALARM_ACTIVE. Register the new alarm source.
      this.activeAlarms.set(event.id, event);
      const audit = this.recordAudit({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromState: "ALARM_ACTIVE",
        toState: "ALARM_ACTIVE",
        timestamp,
        reason: `Additional alarm incident registered: ${payload.message}`,
        triggerEvent: event
      });
      this.notify(audit);
      return event;
    }

    throw new InvalidStateTransitionError(this.state, "ALARM_ACTIVE");
  }

  /**
   * Request / Authorize clear:
   * Strict transition: ALARM_ACTIVE -> AUTHORIZED_CLEAR_PENDING
   * Requires verified security officer credentials to begin unlatching.
   */
  public authorizeClear(credentials: SecurityOfficerCredentials, reason = "Security officer acknowledged site and initiated clearance"): AlarmTransitionAuditEntry {
    if (this.state !== "ALARM_ACTIVE") {
      if (this.state === "NORMAL") {
        throw new InvalidStateTransitionError("NORMAL", "AUTHORIZED_CLEAR_PENDING", "Cannot authorize clear when system is in NORMAL state.");
      }
      if (this.state === "AUTHORIZED_CLEAR_PENDING") {
        // Already in pending state; update clearance credentials
        if (!this.credentialValidator(credentials)) {
          throw new UnauthorizedClearanceError("Invalid officer credentials supplied for updating clearance.");
        }
        this.pendingClearanceOfficer = credentials;
        const audit = this.recordAudit({
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromState: "AUTHORIZED_CLEAR_PENDING",
          toState: "AUTHORIZED_CLEAR_PENDING",
          timestamp: Date.now(),
          reason: `Clearance credentials updated: ${reason}`,
          officer: credentials,
          notes: credentials.notes
        });
        this.notify(audit);
        return audit;
      }
    }

    if (!this.credentialValidator(credentials)) {
      throw new UnauthorizedClearanceError(`Security officer credentials rejected for officerId: '${credentials?.officerId}'. Latching remains in ALARM_ACTIVE.`);
    }

    const previousState = this.state;
    this.state = "AUTHORIZED_CLEAR_PENDING";
    this.pendingClearanceOfficer = credentials;

    const audit = this.recordAudit({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromState: previousState,
      toState: "AUTHORIZED_CLEAR_PENDING",
      timestamp: Date.now(),
      reason,
      officer: credentials,
      notes: credentials.notes
    });

    this.notify(audit);
    return audit;
  }

  /**
   * Confirm clear and return to safe state:
   * Strict transition: AUTHORIZED_CLEAR_PENDING -> NORMAL
   * Fully unlatches the system once all active hazards are resolved and verified.
   */
  public confirmClear(officerId?: string, notes = "Compartment clear confirmed by security operations"): AlarmTransitionAuditEntry {
    if (this.state === "ALARM_ACTIVE") {
      throw new LatchingAlarmError("Cannot reset directly from ALARM_ACTIVE to NORMAL. Security officer authorization is strictly required.");
    }

    if (this.state === "NORMAL") {
      throw new InvalidStateTransitionError("NORMAL", "NORMAL", "Alarm system is already in NORMAL state.");
    }

    if (this.state !== "AUTHORIZED_CLEAR_PENDING") {
      throw new InvalidStateTransitionError(this.state, "NORMAL");
    }

    const previousState = this.state;
    this.state = "NORMAL";
    this.latched = false;
    const finalOfficer = this.pendingClearanceOfficer;
    this.pendingClearanceOfficer = null;
    this.activeAlarms.clear();

    const audit = this.recordAudit({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromState: previousState,
      toState: "NORMAL",
      timestamp: Date.now(),
      reason: notes,
      officer: finalOfficer ?? (officerId ? { officerId } : undefined),
      notes
    });

    this.notify(audit);
    return audit;
  }

  /**
   * Attempt direct reset.
   * If credentials provided while in ALARM_ACTIVE, progresses through authorized clear and resets.
   * If latched in ALARM_ACTIVE without credentials, strictly rejects.
   */
  public reset(credentials?: SecurityOfficerCredentials): AlarmTransitionAuditEntry {
    if (this.state === "NORMAL") {
      throw new InvalidStateTransitionError("NORMAL", "NORMAL", "Alarm system is already in NORMAL state.");
    }

    if (this.state === "ALARM_ACTIVE") {
      if (!credentials || !this.credentialValidator(credentials)) {
        throw new LatchingAlarmError("Direct reset to NORMAL blocked. Alarm is latched; security officer credentials must be supplied.");
      }
      // Authorized flow: transition through AUTHORIZED_CLEAR_PENDING then NORMAL
      this.authorizeClear(credentials, "Immediate verified security clearance reset");
      return this.confirmClear(credentials.officerId, "Verified emergency reset complete");
    }

    if (this.state === "AUTHORIZED_CLEAR_PENDING") {
      return this.confirmClear(credentials?.officerId, "Authorized clearance confirmed");
    }

    throw new InvalidStateTransitionError(this.state, "NORMAL");
  }

  private recordAudit(entry: AlarmTransitionAuditEntry): AlarmTransitionAuditEntry {
    this.auditLog.push(entry);
    return entry;
  }

  private notify(entry: AlarmTransitionAuditEntry): void {
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Avoid listener errors breaking state machine execution
      }
    }
  }
}
