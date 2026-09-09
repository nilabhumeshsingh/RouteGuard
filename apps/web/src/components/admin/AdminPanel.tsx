import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { CampusMapContainer } from "../map/CampusMapContainer";
import { ARCHITECTURAL_ROOMS } from "../../data/floor2Data";
import { FloorId, MapLayerConfig, MapViewMode, UserPositionState } from "../../types";
import { HazardOverlay } from "@routeguard/shared";

interface SOSAdminEvent {
  id: string;
  userId: string;
  userName?: string;
  coordinates: { x: number; y: number; floorId: string; accuracyMeters?: number };
  bssidReadings: Array<{ bssid: string; rssi: number; ssid?: string }>;
  strongestRssi?: number;
  timestamp: number;
  message: string;
}

const layers: MapLayerConfig = { rooms: true, labels: true, pois: true, emergencyEquipment: true, hazards: true };

function roomForEvent(event: SOSAdminEvent) {
  return ARCHITECTURAL_ROOMS.reduce((closest, room) => {
    const center = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 };
    const distance = Math.hypot(center.x - event.coordinates.x, center.y - event.coordinates.y);
    if (!closest || distance < closest.distance) return { room, distance };
    return closest;
  }, null as { room: (typeof ARCHITECTURAL_ROOMS)[number]; distance: number } | null)?.room;
}

export const AdminPanel: React.FC = () => {
  const [event, setEvent] = useState<SOSAdminEvent | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>("2D");
  const [socketStatus, setSocketStatus] = useState("Connecting");
  const audioContextRef = useRef<AudioContext | null>(null);
  const eventIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket: Socket = io(window.location.origin, { transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      setSocketStatus("Connected");
      socket.emit("join:admin");
    });
    socket.on("disconnect", () => setSocketStatus("Disconnected"));
    const handleSOS = (nextEvent: SOSAdminEvent) => {
      if (eventIdRef.current === nextEvent.id) return;
      eventIdRef.current = nextEvent.id;
      setEvent(nextEvent);
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.12;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
    };
    socket.on("sos.triggered", handleSOS);
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch("/api/sos");
        if (!response.ok) return;
        const data = await response.json();
        if (data.alerts?.[0]) handleSOS(data.alerts[0]);
      } catch {
        // Socket.IO remains the primary local realtime channel.
      }
    }, 2000);
    return () => {
      socket.disconnect();
      window.clearInterval(poll);
    };
  }, []);

  const userPosition: UserPositionState = useMemo(() => ({
    x: event?.coordinates.x || 472.5,
    y: event?.coordinates.y || 193.75,
    floorId: (event?.coordinates.floorId || "floor-2") as FloorId,
    uncertaintyRadius: event?.coordinates.accuracyMeters || 2,
    nearestPlaceName: event ? roomForEvent(event)?.name || "SOS location" : "Awaiting SOS"
  }), [event]);

  const hazardOverlays: HazardOverlay[] = useMemo(() => {
    if (!event) return [];
    const room = roomForEvent(event);
    if (!room) return [];
    const { x, y, width, height } = room.bounds;
    return [{
      zoneId: `sos-${room.code}`,
      floorId: "floor-2",
      severity: "fire",
      polygon: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }],
      pulsed: true,
      smokeIntensity: 0.25
    }];
  }, [event]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#081018] text-white">
      <CampusMapContainer
        currentFloor="floor-2"
        layers={layers}
        userPosition={userPosition}
        viewMode={viewMode}
        onSwitchViewMode={setViewMode}
        hazardOverlays={hazardOverlays}
        theme="emergency"
        isEmergencyRoute={Boolean(event)}
      />
      <div className="absolute left-4 top-4 z-40 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#101c2b]/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]">Admin SOS Console</div>
            <div className="mt-1 text-xs text-slate-300">Realtime: {socketStatus}</div>
          </div>
          <div className={`h-3 w-3 rounded-full ${event ? "bg-red-500 animate-pulse" : "bg-slate-500"}`} />
        </div>
        {event ? (
          <div className="mt-4 space-y-2 text-sm">
            <div className="text-lg font-bold text-red-300">SOS: {event.userName || event.userId}</div>
            <div className="text-slate-300">Nearby room: <strong className="text-white">{roomForEvent(event)?.name || "Unknown"}</strong></div>
            <div className="text-slate-300">Strongest RSSI: <strong className="text-white">{event.strongestRssi ?? "n/a"} dBm</strong></div>
            <div className="max-h-24 overflow-auto text-xs text-slate-400">
              {event.bssidReadings.map((reading) => <div key={reading.bssid}>{reading.bssid} · {reading.rssi} dBm</div>)}
            </div>
          </div>
        ) : <div className="mt-4 text-sm text-slate-300">Waiting for an SOS signal.</div>}
      </div>
    </div>
  );
};