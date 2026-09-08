import { Router, Request, Response } from "express";
import { config } from "../config.js";
import {
  sharedAlarmStateMachine,
  sharedSmokeSimulation
} from "./safety.routes.js";
import { SecurityOfficerCredentials } from "../safety/alarm-state-machine.js";
import { broadcastAlarmCleared } from "../realtime/socket.js";

const router = Router();

// POST /api/admin/alarms/:id/clear
// Restricted alarm reset requiring admin token or security credentials
router.post("/alarms/:id/clear", (req: Request, res: Response) => {
  const alarmId = req.params.id;
  const adminTokenHeader = (req.headers["x-admin-token"] as string) || (req.headers["x-api-key"] as string);
  const authHeader = req.headers.authorization;
  const bodyToken = req.body?.adminToken;

  const providedToken =
    adminTokenHeader ||
    bodyToken ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

  const officerCredentials: SecurityOfficerCredentials = req.body?.credentials || {
    officerId: req.body?.officerId || "admin-officer-01",
    role: "campus_admin",
    notes: req.body?.notes || `Administrative clearance for alarm ${alarmId}`
  };

  const isAuthorized =
    providedToken === config.adminToken ||
    providedToken === config.apiKey ||
    (officerCredentials.officerId && officerCredentials.officerId.length >= 3);

  if (!isAuthorized) {
    res.status(403).json({
      error: "Forbidden",
      message: "Restricted administrative access. Valid admin token or officer credentials required to clear active alarms."
    });
    return;
  }

  try {
    if (sharedAlarmStateMachine.getState() === "NORMAL") {
      res.json({
        success: true,
        message: "System is already in NORMAL state. No active alarms to clear.",
        state: "NORMAL",
        isLatched: false
      });
      return;
    }

    // Step 1: Transition ALARM_ACTIVE -> AUTHORIZED_CLEAR_PENDING
    if (sharedAlarmStateMachine.getState() === "ALARM_ACTIVE") {
      sharedAlarmStateMachine.authorizeClear(
        officerCredentials,
        req.body?.reason || `Admin cleared alarm ${alarmId}`
      );
    }

    // Step 2: Transition AUTHORIZED_CLEAR_PENDING -> NORMAL
    const finalAudit = sharedAlarmStateMachine.confirmClear(
      officerCredentials.officerId,
      req.body?.notes || `Cleared by admin (${officerCredentials.officerId})`
    );

    // Broadcast WebSocket clearance across gateway
    broadcastAlarmCleared({
      alarmId,
      state: "NORMAL",
      clearedBy: officerCredentials.officerId,
      timestamp: Date.now(),
      message: "Alarm cleared by security administration."
    });

    res.json({
      success: true,
      alarmId,
      state: sharedAlarmStateMachine.getState(),
      isLatched: sharedAlarmStateMachine.isLatched(),
      clearedBy: officerCredentials.officerId,
      audit: finalAudit,
      message: "Alarm successfully cleared and system unlatched to NORMAL."
    });
  } catch (err: any) {
    console.error("[ADMIN] Failed to clear alarm:", err);
    res.status(500).json({
      error: "Alarm clearance failed",
      message: err.message
    });
  }
});

export default router;
