import { ActiveHazardState, AlarmEvent } from "@routeguard/shared";
import { LatchingAlarmStateMachine } from "./alarm-state-machine.js";
import { SmokeSimulationEngine } from "./smoke-simulation.js";

function resolveIncident(alarm?: AlarmEvent): { roomId?: string; origin: string } {
  const source = `${alarm?.zoneId || ""} ${alarm?.message || ""}`;
  const roomMatch = source.match(/\b(20[1-9]|21[0-9]|220)\b/);
  const roomId = roomMatch?.[1];

  return {
    roomId,
    origin: roomId ? `node-${roomId}` : "node-208"
  };
}

export function buildActiveHazardState(
  alarmStateMachine: LatchingAlarmStateMachine,
  smokeSimulation: SmokeSimulationEngine
): ActiveHazardState {
  const activeAlarm = alarmStateMachine.getActiveAlarms()[0];

  if (alarmStateMachine.getState() === "NORMAL" || !activeAlarm) {
    return {
      active: false,
      blockedNodeIds: [],
      blockedEdgeIds: [],
      hazardOverlays: [],
      generatedAt: Date.now()
    };
  }

  const incident = resolveIncident(activeAlarm);
  const forecast = smokeSimulation.getForecast(10, incident.origin);
  const exitCandidates = ["exit-west", "exit-east"];
  const recommendedExit = exitCandidates.find((exit) => !forecast.blockedNodeIds.includes(exit));

  return {
    active: true,
    alarmId: activeAlarm.id,
    roomId: incident.roomId,
    label: activeAlarm.message,
    blockedNodeIds: forecast.blockedNodeIds,
    blockedEdgeIds: forecast.blockedEdgeIds,
    hazardOverlays: forecast.hazardOverlays,
    recommendedExit,
    generatedAt: Date.now()
  };
}