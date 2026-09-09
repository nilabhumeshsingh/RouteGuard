import { Router, Request, Response } from "express";
import {
  LatchingAlarmStateMachine,
  InvalidStateTransitionError,
  UnauthorizedClearanceError,
  LatchingAlarmError
} from "../safety/alarm-state-machine.js";
import {
  SmokeSimulationEngine,
  ForecastHorizonMinutes
} from "../safety/smoke-simulation.js";
import {
  SOSDispatcherService,
  SOSValidationError,
  SOSNotFoundError
} from "../safety/sos-service.js";
import { buildActiveHazardState } from "../safety/hazard.service.js";
import { getActiveAlarm } from "./alarms.routes.js";

const router = Router();

// Shared runtime instances
export const sharedAlarmStateMachine = new LatchingAlarmStateMachine({ floorId: "floor-2" });
export const sharedSmokeSimulation = new SmokeSimulationEngine("floor-2");
export const sharedSOSDispatcher = new SOSDispatcherService({
  alarmStateMachine: sharedAlarmStateMachine,
  defaultFloorId: "floor-2"
});

// GET /api/safety/hazards/active — shared hazard state for navigation clients
router.get("/hazards/active", (_req: Request, res: Response) => {
  res.json(buildActiveHazardState(sharedAlarmStateMachine, sharedSmokeSimulation, getActiveAlarm()));
});

// GET /api/safety/alarm/state
router.get("/alarm/state", (_req: Request, res: Response) => {
  res.json({
    state: sharedAlarmStateMachine.getState(),
    isLatched: sharedAlarmStateMachine.isLatched(),
    activeAlarms: sharedAlarmStateMachine.getActiveAlarms(),
    pendingClearanceOfficer: sharedAlarmStateMachine.getPendingClearanceOfficer(),
    auditTrail: sharedAlarmStateMachine.getAuditLog()
  });
});

// POST /api/safety/alarm/trigger
router.post("/alarm/trigger", (req: Request, res: Response) => {
  try {
    const { zoneId, message, kind, severity, floorId, deviceId } = req.body;
    if (!zoneId || !message) {
      res.status(400).json({ error: "zoneId and message are required to trigger an alarm" });
      return;
    }

    const event = sharedAlarmStateMachine.triggerAlarm({
      zoneId,
      message,
      kind,
      severity,
      floorId,
      deviceId
    });

    res.status(201).json({
      success: true,
      alarmState: sharedAlarmStateMachine.getState(),
      isLatched: sharedAlarmStateMachine.isLatched(),
      event
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/safety/alarm/authorize-clear
router.post("/alarm/authorize-clear", (req: Request, res: Response) => {
  try {
    const { credentials, reason } = req.body;
    if (!credentials || !credentials.officerId) {
      res.status(400).json({ error: "Officer credentials with officerId are required." });
      return;
    }

    const audit = sharedAlarmStateMachine.authorizeClear(credentials, reason);
    res.json({
      success: true,
      alarmState: sharedAlarmStateMachine.getState(),
      isLatched: sharedAlarmStateMachine.isLatched(),
      audit
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedClearanceError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof InvalidStateTransitionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/safety/alarm/confirm-clear
router.post("/alarm/confirm-clear", (req: Request, res: Response) => {
  try {
    const { officerId, notes } = req.body;
    const audit = sharedAlarmStateMachine.confirmClear(officerId, notes);
    res.json({
      success: true,
      alarmState: sharedAlarmStateMachine.getState(),
      isLatched: sharedAlarmStateMachine.isLatched(),
      audit
    });
  } catch (err: any) {
    if (err instanceof LatchingAlarmError) {
      res.status(423).json({ error: err.message });
      return;
    }
    if (err instanceof InvalidStateTransitionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/safety/smoke/forecast
router.get("/smoke/forecast", (req: Request, res: Response) => {
  try {
    const minutes = Number(req.query.minutes ?? 2) as ForecastHorizonMinutes;
    if (![2, 5, 10].includes(minutes)) {
      res.status(400).json({ error: "Invalid forecast horizon. Supported horizons: 2, 5, 10 minutes." });
      return;
    }
    const origin = (req.query.origin as string) || "node-208";
    const forecast = sharedSmokeSimulation.getForecast(minutes, origin);
    res.json(forecast);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/safety/smoke/simulation
router.get("/smoke/simulation", (req: Request, res: Response) => {
  try {
    const origin = (req.query.origin as string) || "node-208";
    const simulation = sharedSmokeSimulation.runSimulation(origin);
    res.json(simulation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/safety/sos/dispatch
router.post("/sos/dispatch", (req: Request, res: Response) => {
  try {
    const alert = sharedSOSDispatcher.dispatchSOS(req.body);
    res.status(201).json({ success: true, alert });
  } catch (err: any) {
    if (err instanceof SOSValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/safety/sos/active
router.get("/sos/active", (_req: Request, res: Response) => {
  res.json({ alerts: sharedSOSDispatcher.getActiveAlerts() });
});

// POST /api/safety/sos/:id/acknowledge
router.post("/sos/:id/acknowledge", (req: Request, res: Response) => {
  try {
    const { responderId, notes } = req.body;
    if (!responderId) {
      res.status(400).json({ error: "responderId is required to acknowledge SOS alert." });
      return;
    }
    const alert = sharedSOSDispatcher.acknowledgeSOS(req.params.id, responderId, notes);
    res.json({ success: true, alert });
  } catch (err: any) {
    if (err instanceof SOSNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/safety/sos/:id/resolve
router.post("/sos/:id/resolve", (req: Request, res: Response) => {
  try {
    const { responderId, resolutionNotes } = req.body;
    if (!responderId || !resolutionNotes) {
      res.status(400).json({ error: "responderId and resolutionNotes are required." });
      return;
    }
    const alert = sharedSOSDispatcher.resolveSOS(req.params.id, responderId, resolutionNotes);
    res.json({ success: true, alert });
  } catch (err: any) {
    if (err instanceof SOSNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
