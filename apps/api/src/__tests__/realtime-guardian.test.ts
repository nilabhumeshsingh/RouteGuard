import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import request from "supertest";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import { createApp } from "../app.js";
import {
  initSocketGateway,
  broadcastAlarmTriggered,
  broadcastAlarmCleared,
  broadcastRouteInvalidated,
  broadcastLocationUpdate
} from "../realtime/socket.js";
import { guardianService, isPointInPolygon } from "../guardian/guardian.service.js";

describe("Milestone 11: Real-time Socket.IO Gateway & Guardian Tracking", () => {
  let server: http.Server;
  let serverPort: number;
  let clientSocket: ClientSocketType;
  let adminSocket: ClientSocketType;
  const app = createApp();

  beforeAll(async () => {
    server = http.createServer(app);
    initSocketGateway(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (adminSocket && adminSocket.connected) {
      adminSocket.disconnect();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("Point-in-Polygon Geofencing Engine", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];

    it("correctly identifies point inside polygon", () => {
      expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(true);
      expect(isPointInPolygon({ x: 10, y: 90 }, polygon)).toBe(true);
    });

    it("correctly identifies point outside polygon", () => {
      expect(isPointInPolygon({ x: 150, y: 50 }, polygon)).toBe(false);
      expect(isPointInPolygon({ x: -10, y: 50 }, polygon)).toBe(false);
      expect(isPointInPolygon({ x: 50, y: 110 }, polygon)).toBe(false);
    });
  });

  describe("Guardian Pairing Flow (REST API)", () => {
    let pairingCode: string;
    let pairId: string;

    it("POST /api/guardian/pair/code generates a single-use 6-digit pairing code", async () => {
      const res = await request(app)
        .post("/api/guardian/pair/code")
        .send({
          childId: "child-student-01",
          childName: "Rohan Patel",
          emergencyContact: "+91 141 3999100"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.pairingCode).toMatch(/^\d{6}$/);
      expect(res.body).toHaveProperty("pairId");
      expect(res.body.expiresAt).toBeGreaterThan(Date.now());

      pairingCode = res.body.pairingCode;
      pairId = res.body.pairId;
    });

    it("POST /api/guardian/pair/claim claims the 6-digit code and creates encrypted channel", async () => {
      const res = await request(app)
        .post("/api/guardian/pair/claim")
        .send({
          guardianId: "parent-guard-01",
          pairingCode
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pairId).toBe(pairId);
      expect(res.body.childId).toBe("child-student-01");
      expect(res.body.room).toBe(`guardian:${pairId}`);
      expect(res.body.channelKey).toHaveLength(64); // 256-bit hex
    });

    it("rejects duplicate claim on already claimed code", async () => {
      const res = await request(app)
        .post("/api/guardian/pair/claim")
        .send({
          guardianId: "another-guardian",
          pairingCode
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("POST /api/geofences/check", () => {
    it("returns isInsideSafeZone true when child is inside West Classrooms", async () => {
      const res = await request(app)
        .post("/api/geofences/check")
        .send({
          childId: "child-student-01",
          position: {
            x: 120,
            y: 220, // Room 204
            floorId: "floor-2"
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.isInsideSafeZone).toBe(true);
      expect(res.body.activeGeofenceId).toBe("zone-west-classrooms");
      expect(res.body.alertTriggered).toBe(false);
    });

    it("returns isInsideSafeZone false and triggers alert when child is outside approved zones", async () => {
      const res = await request(app)
        .post("/api/geofences/check")
        .send({
          childId: "child-student-01",
          pairId: "pair-demo-123",
          position: {
            x: 50,
            y: 50, // Far corner outside approved safe perimeter
            floorId: "floor-2"
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.isInsideSafeZone).toBe(false);
      expect(res.body.alertTriggered).toBe(true);
    });
  });

  describe("Socket.IO Real-time Gateway Events & Rooms", () => {
    it("delivers alarm.triggered and alarm.cleared to 'alarms' and 'admin' rooms", async () => {
      const socketUrl = `http://127.0.0.1:${serverPort}`;

      clientSocket = ClientSocket(socketUrl, { reconnection: false, forceNew: true });
      adminSocket = ClientSocket(socketUrl, { reconnection: false, forceNew: true });

      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        const checkDone = () => {
          connectedCount++;
          if (connectedCount === 2) resolve();
        };
        clientSocket.on("connect", checkDone);
        adminSocket.on("connect", checkDone);
      });

      // Join respective rooms
      clientSocket.emit("join:alarms");
      adminSocket.emit("join:admin");

      await new Promise((r) => setTimeout(r, 100));

      // Test alarm.triggered broadcast
      const triggeredPromise = new Promise<any>((resolve) => {
        clientSocket.once("alarm.triggered", (data) => resolve(data));
      });

      broadcastAlarmTriggered({
        eventId: "evt-test-101",
        deviceId: "esp32-fire-node-01",
        zoneId: "ZONE_FLOOR2_B",
        kind: "fire",
        severity: "critical",
        message: "Smoke alarm triggered in Room 208",
        timestamp: Date.now(),
        state: "ALARM_ACTIVE"
      });

      const triggeredData = await triggeredPromise;
      expect(triggeredData.eventId).toBe("evt-test-101");
      expect(triggeredData.zoneId).toBe("ZONE_FLOOR2_B");

      // Test alarm.cleared broadcast
      const clearedPromise = new Promise<any>((resolve) => {
        clientSocket.once("alarm.cleared", (data) => resolve(data));
      });

      broadcastAlarmCleared({
        alarmId: "evt-test-101",
        state: "NORMAL",
        clearedBy: "chief-warden-01",
        timestamp: Date.now()
      });

      const clearedData = await clearedPromise;
      expect(clearedData.alarmId).toBe("evt-test-101");
      expect(clearedData.state).toBe("NORMAL");
    });

    it("delivers route.invalidated event across navigation room", async () => {
      const sessionId = "nav-session-456";
      clientSocket.emit("join:navigation", { sessionId });
      await new Promise((r) => setTimeout(r, 100));

      const invalidatedPromise = new Promise<any>((resolve) => {
        clientSocket.once("route.invalidated", (data) => resolve(data));
      });

      broadcastRouteInvalidated(sessionId, {
        sessionId,
        reason: "smoke_spread_detected",
        blockedNodeIds: ["node-208", "c-208"],
        zoneId: "ZONE_FLOOR2_B",
        timestamp: Date.now(),
        recommendedAction: "recalculate"
      });

      const data = await invalidatedPromise;
      expect(data.reason).toBe("smoke_spread_detected");
      expect(data.blockedNodeIds).toContain("node-208");
      expect(data.recommendedAction).toBe("recalculate");
    });
  });
});
