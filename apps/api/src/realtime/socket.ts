import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";

let ioInstance: SocketIOServer | null = null;

export interface AlarmTriggeredEvent {
  eventId: string;
  deviceId?: string;
  zoneId: string;
  kind: string;
  severity: string;
  message: string;
  timestamp: number;
  state: string;
  forecast?: any;
}

export interface AlarmClearedEvent {
  alarmId: string;
  state: string;
  clearedBy?: string;
  timestamp: number;
  message?: string;
}

export interface RouteInvalidatedEvent {
  sessionId?: string;
  reason: string;
  blockedNodeIds: string[];
  zoneId?: string;
  timestamp: number;
  recommendedAction: "recalculate" | "evacuate" | "hold";
}

export interface LocationUpdateEvent {
  childId: string;
  pairId?: string;
  x: number;
  y: number;
  floorId: string;
  accuracyMeters?: number;
  batteryLevel?: number;
  isInsideSafeZone: boolean;
  activeGeofenceId?: string;
  timestamp: number;
}

export interface GeofenceAlertEvent {
  childId: string;
  pairId?: string;
  childName?: string;
  position: { x: number; y: number; floorId: string };
  isInsideSafeZone: boolean;
  message: string;
  severity: "warning" | "critical";
  timestamp: number;
}

export interface ScannerUpdateEvent {
  deviceId: string;
  timestamp: number;
  receivedAt: number;
  apCount: number;
  aps: any[];
}

export function initSocketGateway(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket: Socket) => {
    // Room subscriptions
    socket.on("join:alarms", () => {
      socket.join("alarms");
    });

    socket.on("join:navigation", (data: { sessionId: string }) => {
      if (data?.sessionId) {
        socket.join(`navigation:${data.sessionId}`);
      }
    });

    socket.on("join:guardian", (data: { pairId: string }) => {
      if (data?.pairId) {
        socket.join(`guardian:${data.pairId}`);
      }
    });

    socket.on("join:admin", () => {
      socket.join("admin");
    });

    // Generic subscribe
    socket.on("subscribe", (data: { room: string }) => {
      if (data?.room) {
        socket.join(data.room);
      }
    });

    // Real-time location stream from client/child device
    socket.on("client:location", (data: LocationUpdateEvent) => {
      if (data?.pairId) {
        io.to(`guardian:${data.pairId}`).emit("location.update", data);
      }
      io.to("admin").emit("location.update", data);
    });
  });

  ioInstance = io;
  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

export function broadcastAlarmTriggered(event: AlarmTriggeredEvent): void {
  if (!ioInstance) return;
  ioInstance.to("alarms").emit("alarm.triggered", event);
  ioInstance.to("admin").emit("alarm.triggered", event);
}

export function broadcastAlarmCleared(event: AlarmClearedEvent): void {
  if (!ioInstance) return;
  ioInstance.to("alarms").emit("alarm.cleared", event);
  ioInstance.to("admin").emit("alarm.cleared", event);
}

export function broadcastRouteInvalidated(
  sessionId: string | undefined,
  event: RouteInvalidatedEvent
): void {
  if (!ioInstance) return;
  if (sessionId) {
    ioInstance.to(`navigation:${sessionId}`).emit("route.invalidated", event);
  } else {
    // Broadcast to all active navigation sessions
    ioInstance.emit("route.invalidated", event);
  }
}

export function broadcastLocationUpdate(
  pairId: string,
  event: LocationUpdateEvent
): void {
  if (!ioInstance) return;
  ioInstance.to(`guardian:${pairId}`).emit("location.update", event);
  ioInstance.to("admin").emit("location.update", event);
}

export function broadcastGeofenceAlert(
  pairId: string | undefined,
  event: GeofenceAlertEvent
): void {
  if (!ioInstance) return;
  if (pairId) {
    ioInstance.to(`guardian:${pairId}`).emit("geofence.alert", event);
  }
  ioInstance.to("admin").emit("geofence.alert", event);
}

export function broadcastScannerUpdate(event: ScannerUpdateEvent): void {
  if (!ioInstance) return;
  ioInstance.to("admin").emit("scanner.update", event);
}

