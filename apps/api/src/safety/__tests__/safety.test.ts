import { describe, it, expect, beforeEach } from "vitest";
import {
  LatchingAlarmStateMachine,
  InvalidStateTransitionError,
  UnauthorizedClearanceError,
  LatchingAlarmError,
  SmokeSimulationEngine,
  defaultSmokeSimulation,
  calculateGaussianPuffConcentration,
  SOSDispatcherService,
  SOSValidationError
} from "../index.js";
import { CampusGraph, findEmergencyEvacuationRoute, findPath } from "@routeguard/graph";
import { loadFloor2Graph } from "../../data/loader.js";

const floor2Data = loadFloor2Graph();

describe("Latching Alarm State Machine", () => {
  let sm: LatchingAlarmStateMachine;

  beforeEach(() => {
    sm = new LatchingAlarmStateMachine({ floorId: "floor-2" });
  });

  it("initializes in NORMAL resting state with unlatched status", () => {
    expect(sm.getState()).toBe("NORMAL");
    expect(sm.isLatched()).toBe(false);
    expect(sm.getActiveAlarms()).toHaveLength(0);
    expect(sm.getPendingClearanceOfficer()).toBeNull();
  });

  it("transitions strictly from NORMAL to ALARM_ACTIVE and engages latching", () => {
    const event = sm.triggerAlarm({
      deviceId: "smoke-sensor-208",
      zoneId: "zone-208",
      floorId: "floor-2",
      kind: "fire",
      severity: "critical",
      message: "Heavy smoke detected in Room 208"
    });

    expect(sm.getState()).toBe("ALARM_ACTIVE");
    expect(sm.isLatched()).toBe(true);
    expect(sm.getActiveAlarms()).toHaveLength(1);
    expect(event.zoneId).toBe("zone-208");
    expect(event.state).toBe("ALARM_ACTIVE");
  });

  it("prohibits direct transition from NORMAL to AUTHORIZED_CLEAR_PENDING", () => {
    expect(() => {
      sm.authorizeClear({
        officerId: "sec-officer-01",
        role: "security_officer"
      });
    }).toThrow(InvalidStateTransitionError);
  });

  it("enforces latching: direct reset from ALARM_ACTIVE without credentials is strictly prohibited", () => {
    sm.triggerAlarm({
      zoneId: "zone-208",
      message: "Fire alarm triggered"
    });

    expect(sm.getState()).toBe("ALARM_ACTIVE");
    expect(sm.isLatched()).toBe(true);

    // Attempt direct reset without credentials
    expect(() => {
      sm.reset();
    }).toThrow(LatchingAlarmError);

    // System must remain latched in ALARM_ACTIVE
    expect(sm.getState()).toBe("ALARM_ACTIVE");
    expect(sm.isLatched()).toBe(true);
  });

  it("rejects unauthorized clearance attempts with empty or invalid officer credentials", () => {
    sm.triggerAlarm({
      zoneId: "zone-208",
      message: "Smoke alarm"
    });

    // Empty officerId
    expect(() => {
      sm.authorizeClear({ officerId: "   " });
    }).toThrow(UnauthorizedClearanceError);

    // Invalid role
    expect(() => {
      sm.authorizeClear({
        officerId: "student-10",
        // @ts-expect-error testing invalid role
        role: "unauthorized_guest"
      });
    }).toThrow(UnauthorizedClearanceError);

    // State remains ALARM_ACTIVE
    expect(sm.getState()).toBe("ALARM_ACTIVE");
  });

  it("executes strict transition cycle: NORMAL -> ALARM_ACTIVE -> AUTHORIZED_CLEAR_PENDING -> NORMAL", () => {
    // 1. NORMAL -> ALARM_ACTIVE
    sm.triggerAlarm({
      deviceId: "pull-box-208",
      zoneId: "zone-208",
      kind: "fire",
      message: "Manual fire pull station activated"
    });
    expect(sm.getState()).toBe("ALARM_ACTIVE");

    // 2. ALARM_ACTIVE -> AUTHORIZED_CLEAR_PENDING (with security officer credentials)
    const officerCreds = {
      officerId: "officer-alex-44",
      badgeNumber: "BADGE-4481",
      role: "security_officer" as const,
      notes: "Physical sweep complete, extinguisher discharged, safe to inspect"
    };

    const clearPendingAudit = sm.authorizeClear(officerCreds, "Corridor 208 inspection completed");
    expect(sm.getState()).toBe("AUTHORIZED_CLEAR_PENDING");
    expect(sm.isLatched()).toBe(true);
    expect(clearPendingAudit.fromState).toBe("ALARM_ACTIVE");
    expect(clearPendingAudit.toState).toBe("AUTHORIZED_CLEAR_PENDING");
    expect(sm.getPendingClearanceOfficer()?.officerId).toBe("officer-alex-44");

    // 3. AUTHORIZED_CLEAR_PENDING -> NORMAL (confirm clear)
    const finalAudit = sm.confirmClear("officer-alex-44", "HVAC purged, all clear");
    expect(sm.getState()).toBe("NORMAL");
    expect(sm.isLatched()).toBe(false);
    expect(sm.getActiveAlarms()).toHaveLength(0);
    expect(finalAudit.toState).toBe("NORMAL");
  });

  it("re-arms to ALARM_ACTIVE if hazard persists while clear is pending", () => {
    sm.triggerAlarm({ zoneId: "zone-208", message: "Initial fire" });
    sm.authorizeClear({ officerId: "officer-01", role: "chief_warden" });
    expect(sm.getState()).toBe("AUTHORIZED_CLEAR_PENDING");

    // Re-trigger occurs before final confirmation
    sm.triggerAlarm({ zoneId: "zone-206", message: "Flare up detected in adjacent corridor" });
    expect(sm.getState()).toBe("ALARM_ACTIVE");
    expect(sm.isLatched()).toBe(true);
  });

  it("maintains a full audit trail and notifies subscribers on state transitions", () => {
    const events: string[] = [];
    sm.subscribe((entry) => {
      events.push(`${entry.fromState}->${entry.toState}`);
    });

    sm.triggerAlarm({ zoneId: "zone-208", message: "Smoke alert" });
    sm.authorizeClear({ officerId: "sec-99", role: "security_officer" });
    sm.confirmClear("sec-99");

    expect(events).toEqual([
      "NORMAL->ALARM_ACTIVE",
      "ALARM_ACTIVE->AUTHORIZED_CLEAR_PENDING",
      "AUTHORIZED_CLEAR_PENDING->NORMAL"
    ]);

    const auditLog = sm.getAuditLog();
    expect(auditLog.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Physical Compartment Smoke Spread Simulation Engine", () => {
  const engine = new SmokeSimulationEngine("floor-2");
  let graph: CampusGraph;

  beforeEach(() => {
    graph = CampusGraph.fromJson(floor2Data);
  });

  it("calculates 2-minute forecast horizon (incident room 208 and corridor 208)", () => {
    const horizon = engine.getForecast(2, "node-208");

    expect(horizon.horizonMinutes).toBe(2);
    expect(horizon.horizonSeconds).toBe(120);

    // Incident room and corridor blocked
    expect(horizon.blockedNodeIds).toContain("node-208");
    expect(horizon.blockedNodeIds).toContain("c-208");
    expect(horizon.blockedNodeIds).not.toContain("node-stairs-north");
    expect(horizon.blockedNodeIds).not.toContain("c-lift");

    // Blocked edge IDs include bidirectional corridor connections
    expect(horizon.blockedEdgeIds).toContain("c-208->node-208");
    expect(horizon.blockedEdgeIds).toContain("node-208->c-208");
    expect(horizon.blockedEdgeIds).toContain("c-west->c-208");

    // Polygon hazard overlays
    expect(horizon.hazardOverlays.length).toBeGreaterThanOrEqual(2);
    const fireOverlay = horizon.hazardOverlays.find((h) => h.severity === "fire");
    expect(fireOverlay).toBeDefined();
    expect(fireOverlay?.polygon.length).toBeGreaterThanOrEqual(3);
    expect(fireOverlay?.smokeIntensity).toBeGreaterThanOrEqual(0.9);

    const corridorOverlay = horizon.hazardOverlays.find((h) => h.severity === "smoke");
    expect(corridorOverlay).toBeDefined();
    expect(corridorOverlay?.zoneId).toContain("corridor");
  });

  it("calculates 5-minute forecast horizon (adjacent compartment: Corridor 206, 207, Room 206)", () => {
    const horizon = engine.getForecast(5, "node-208");

    expect(horizon.horizonMinutes).toBe(5);
    expect(horizon.horizonSeconds).toBe(300);

    // Contains all 2-min blocked nodes plus adjacent compartment
    expect(horizon.blockedNodeIds).toContain("node-208");
    expect(horizon.blockedNodeIds).toContain("c-208");
    expect(horizon.blockedNodeIds).toContain("c-206");
    expect(horizon.blockedNodeIds).toContain("node-207");
    expect(horizon.blockedNodeIds).toContain("node-206");

    // Blocked edges include Corridor 206 and room connections
    expect(horizon.blockedEdgeIds).toContain("c-206->node-206");
    expect(horizon.blockedEdgeIds).toContain("c-208->c-206");

    // Contains hazard overlays for adjacent zones
    const zone206 = horizon.hazardOverlays.find((h) => h.zoneId.includes("206"));
    const zone207 = horizon.hazardOverlays.find((h) => h.zoneId.includes("207"));
    expect(zone206).toBeDefined();
    expect(zone207).toBeDefined();
  });

  it("calculates 10-minute forecast horizon (expanding towards central stairwell: Corridor 212-209, Lift Lobby)", () => {
    const horizon = engine.getForecast(10, "node-208");

    expect(horizon.horizonMinutes).toBe(10);
    expect(horizon.horizonSeconds).toBe(600);

    // Spreads to mid-west corridor and central vertical circulation
    expect(horizon.blockedNodeIds).toContain("c-mid-west");
    expect(horizon.blockedNodeIds).toContain("c-lift");
    expect(horizon.blockedNodeIds).toContain("node-stairs-north");
    expect(horizon.blockedNodeIds).toContain("c-210");

    // Central stairwell and elevator lobby edges blocked
    expect(horizon.blockedEdgeIds).toContain("c-211->c-lift");
    expect(horizon.blockedEdgeIds).toContain("c-lift->node-stairs-north");

    // Hazard overlays include central lobby
    const stairLiftHazard = horizon.hazardOverlays.find((h) => h.zoneId.includes("central-stair-lift"));
    expect(stairLiftHazard).toBeDefined();
    expect(stairLiftHazard?.severity).toBe("blocked");
  });

  it("runs full simulation returning all 3 horizons", () => {
    const result = engine.runSimulation("node-208");
    expect(result.incidentOrigin).toBe("node-208");
    expect(result.floorId).toBe("floor-2");
    expect(result.horizons[2]).toBeDefined();
    expect(result.horizons[5]).toBeDefined();
    expect(result.horizons[10]).toBeDefined();

    expect(result.isNodeBlocked("node-208", 2)).toBe(true);
    expect(result.isNodeBlocked("c-lift", 2)).toBe(false);
    expect(result.isNodeBlocked("c-lift", 10)).toBe(true);
  });

  it("integrates with CampusGraph: dynamically routes evacuation paths safely around smoke-blocked corridors", () => {
    const forecast10 = engine.getForecast(10, "node-208");

    // When 10-min smoke blocks central corridor and stairwell, person at Room 204
    // should safely evacuate via Fire Exit West, completely avoiding the smoke plume
    const route = findEmergencyEvacuationRoute(graph, "node-204", {
      blockedNodes: new Set(forecast10.blockedNodeIds),
      blockedEdges: new Set(forecast10.blockedEdgeIds)
    });

    expect(route.status).toBe("found");
    expect(route.pathPoints.length).toBeGreaterThan(0);

    // Destination should be safe fire exit (Fire Exit West)
    const lastPoint = route.pathPoints[route.pathPoints.length - 1];
    expect(lastPoint.x).toBe(80); // exit-west is at (80, 280)
    expect(lastPoint.y).toBe(280);

    // None of the route segments should pass through blocked smoke nodes
    for (const segment of route.segments) {
      expect(forecast10.blockedNodeIds).not.toContain(segment.fromNodeId);
      expect(forecast10.blockedNodeIds).not.toContain(segment.toNodeId);
    }
  });
});

describe("High Priority SOS Alert Dispatcher Service", () => {
  let dispatcher: SOSDispatcherService;
  let alarmSM: LatchingAlarmStateMachine;

  beforeEach(() => {
    alarmSM = new LatchingAlarmStateMachine({ floorId: "floor-2" });
    dispatcher = new SOSDispatcherService({
      alarmStateMachine: alarmSM,
      defaultFloorId: "floor-2"
    });
  });

  it("dispatches high-priority SOS with captured user coordinates and precise timestamp", () => {
    const beforeDispatch = Date.now();
    const alert = dispatcher.dispatchSOS({
      userId: "usr-student-512",
      userName: "Sam Carter",
      coordinates: {
        x: 220,
        y: 220,
        floorId: "floor-2",
        accuracyMeters: 1.8,
        buildingId: "AB1"
      },
      emergencyType: "medical",
      message: "Student collapsed near Room 208, immediate assistance required",
      batteryLevel: 68
    });

    const afterDispatch = Date.now();

    expect(alert.id).toMatch(/^sos-\d+-[a-z0-9]+$/);
    expect(alert.priority).toBe("CRITICAL");
    expect(alert.status).toBe("DISPATCHED");
    expect(alert.userId).toBe("usr-student-512");
    expect(alert.userName).toBe("Sam Carter");
    expect(alert.coordinates).toEqual({
      x: 220,
      y: 220,
      floorId: "floor-2",
      accuracyMeters: 1.8,
      buildingId: "AB1"
    });
    expect(alert.dispatchedAt).toBeGreaterThanOrEqual(beforeDispatch);
    expect(alert.dispatchedAt).toBeLessThanOrEqual(afterDispatch);
    expect(alert.dispatchChannels).toContain("campus_security_console");
    expect(alert.timeline).toHaveLength(1);
    expect(alert.timeline[0].action).toBe("DISPATCH");
  });

  it("rejects SOS request when user coordinates or user ID are invalid", () => {
    expect(() => {
      dispatcher.dispatchSOS({
        userId: "",
        coordinates: { x: 100, y: 100, floorId: "floor-2" }
      });
    }).toThrow(SOSValidationError);

    expect(() => {
      dispatcher.dispatchSOS({
        userId: "valid-user",
        coordinates: { x: NaN, y: 100, floorId: "floor-2" }
      });
    }).toThrow(SOSValidationError);

    expect(() => {
      dispatcher.dispatchSOS({
        userId: "valid-user",
        coordinates: { x: "invalid" as any, y: 100, floorId: "floor-2" }
      });
    }).toThrow(SOSValidationError);
  });

  it("handles SOS lifecycle: DISPATCHED -> ACKNOWLEDGED -> RESOLVED", () => {
    const alert = dispatcher.dispatchSOS({
      userId: "usr-prof-202",
      coordinates: { x: 300, y: 280, floorId: "floor-2" },
      emergencyType: "panic"
    });

    expect(alert.status).toBe("DISPATCHED");

    // Responder acknowledges
    const ack = dispatcher.acknowledgeSOS(alert.id, "officer-john-12", "Security unit in transit");
    expect(ack.status).toBe("ACKNOWLEDGED");
    expect(ack.assignedResponder).toBe("officer-john-12");
    expect(ack.acknowledgedAt).toBeDefined();

    // Incident resolved
    const resolved = dispatcher.resolveSOS(alert.id, "officer-john-12", "User assisted and escorted to safety");
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.resolutionNotes).toBe("User assisted and escorted to safety");
    expect(dispatcher.getActiveAlerts()).toHaveLength(0);
  });

  it("triggers campus alarm latching when triggerCampusAlarm flag is set", () => {
    expect(alarmSM.getState()).toBe("NORMAL");

    dispatcher.dispatchSOS({
      userId: "usr-evac-99",
      coordinates: { x: 220, y: 280, floorId: "floor-2" },
      emergencyType: "fire",
      triggerCampusAlarm: true
    });

    expect(alarmSM.getState()).toBe("ALARM_ACTIVE");
    expect(alarmSM.isLatched()).toBe(true);
    expect(alarmSM.getActiveAlarms()[0].severity).toBe("critical");
  });
});

describe("Analytical Gaussian Puff Smoke Dispersion Model", () => {
  const source = { x: 220, y: 180, z: 12.25 }; // Room 208 fire source

  it("calculates puff advection and monotonic Gaussian dispersion expansion (σ)", () => {
    const early = calculateGaussianPuffConcentration(source, source, 2.0);
    const late = calculateGaussianPuffConcentration(source, source, 10.0);

    // Puff center must advect forward over time
    expect(late.puffCenter.x).toBeGreaterThan(early.puffCenter.x);
    expect(late.puffCenter.z).toBeGreaterThan(early.puffCenter.z);

    // Standard deviation σ must expand with diffusion (σ_late > σ_early)
    expect(late.sigma.x).toBeGreaterThan(early.sigma.x);
    expect(late.sigma.z).toBeGreaterThan(early.sigma.z);
  });

  it("demonstrates Gaussian spatial decay: concentration is maximal at puff center and decays exponentially with distance", () => {
    const t = 5.0;
    const centerRes = calculateGaussianPuffConcentration(
      { x: source.x + 0.25 * t, y: source.y, z: source.z + 0.45 * t },
      source,
      t
    );

    const nearRes = calculateGaussianPuffConcentration(
      { x: source.x + 0.25 * t + 1.0, y: source.y, z: source.z + 0.45 * t },
      source,
      t
    );

    const farRes = calculateGaussianPuffConcentration(
      { x: source.x + 0.25 * t + 4.0, y: source.y, z: source.z + 0.45 * t },
      source,
      t
    );

    expect(centerRes.concentrationMgM3).toBeGreaterThan(nearRes.concentrationMgM3);
    expect(nearRes.concentrationMgM3).toBeGreaterThan(farRes.concentrationMgM3);
    expect(centerRes.isHazardous).toBe(true);
    expect(centerRes.visibilityMeters).toBeLessThan(nearRes.visibilityMeters);
  });

  it("models concentration dilution over time due to volumetric Gaussian puff expansion", () => {
    // Evaluating at puff center at 1s vs 10s: peak concentration dilutes as 1/σ³
    const peak1s = calculateGaussianPuffConcentration(
      { x: source.x + 0.25 * 1.0, y: source.y, z: source.z + 0.45 * 1.0 },
      source,
      1.0
    );

    const peak10s = calculateGaussianPuffConcentration(
      { x: source.x + 0.25 * 10.0, y: source.y, z: source.z + 0.45 * 10.0 },
      source,
      10.0
    );

    expect(peak1s.concentrationMgM3).toBeGreaterThan(peak10s.concentrationMgM3);
  });
});
