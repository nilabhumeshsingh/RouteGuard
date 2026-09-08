import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("CampusSafe Core Express REST Routes", () => {
  const app = createApp();

  describe("GET /api/campus/config", () => {
    it("returns campus boundaries, help contacts, and active floor list", async () => {
      const res = await request(app).get("/api/campus/config");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("campusName");
      expect(res.body).toHaveProperty("building");
      expect(res.body).toHaveProperty("boundaries");
      expect(res.body.boundaries).toHaveProperty("polygon");
      expect(res.body.boundaries.polygon.length).toBeGreaterThanOrEqual(4);

      expect(res.body).toHaveProperty("helpContacts");
      expect(Array.isArray(res.body.helpContacts)).toBe(true);
      expect(res.body.helpContacts.length).toBeGreaterThan(0);
      expect(res.body.helpContacts[0]).toHaveProperty("role");
      expect(res.body.helpContacts[0]).toHaveProperty("phone");

      expect(res.body).toHaveProperty("activeFloors");
      expect(Array.isArray(res.body.activeFloors)).toBe(true);
      expect(res.body.activeFloors.some((f: any) => f.id === "floor-2")).toBe(true);
    });
  });

  describe("GET /api/maps/:floorId", () => {
    it("returns Floor 2 blueprint metadata, nodes, corridors, and POIs", async () => {
      const res = await request(app).get("/api/maps/floor-2");
      expect(res.status).toBe(200);
      expect(res.body.floorId).toBe("floor-2");
      expect(res.body.dimensions).toEqual({ width: 850, height: 650 });
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(res.body.nodes.length).toBeGreaterThan(10);
      expect(Array.isArray(res.body.corridors)).toBe(true);
      expect(Array.isArray(res.body.pois)).toBe(true);
      expect(res.body.pois.length).toBeGreaterThan(5);
    });

    it("returns 404 for non-existent floor ID", async () => {
      const res = await request(app).get("/api/maps/floor-999");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/places?q=", () => {
    it("returns full list of places when query is empty or wildcard", async () => {
      const res = await request(app).get("/api/places");
      expect(res.status).toBe(200);
      expect(res.body.places.length).toBeGreaterThan(15);
    });

    it("performs fast fuzzy search by room number", async () => {
      const res = await request(app).get("/api/places?q=204");
      expect(res.status).toBe(200);
      expect(res.body.places.length).toBeGreaterThan(0);
      expect(res.body.places[0].name).toContain("204");
    });

    it("performs fuzzy search by alias (e.g. 'ai lab' -> Room 219)", async () => {
      const res = await request(app).get("/api/places?q=ai+lab");
      expect(res.status).toBe(200);
      expect(res.body.places.length).toBeGreaterThan(0);
      expect(res.body.places[0].id).toBe("poi-219");
    });

    it("performs fuzzy search by category (e.g. 'restroom')", async () => {
      const res = await request(app).get("/api/places?q=restroom");
      expect(res.status).toBe(200);
      expect(res.body.places.length).toBeGreaterThan(0);
      expect(res.body.places.every((p: any) => p.category === "Restroom" || p.aliases.some((a: string) => a.includes("restroom")))).toBe(true);
    });
  });

  describe("POST /api/position/estimate", () => {
    it("ingests live WiFi scan payload, runs k-NN estimator, and returns map-matched coordinates with uncertainty circle", async () => {
      // WiFi scan sample matching Room 204
      const scanPayload = {
        items: [
          { bssid: "90:14:AF:5F:9B:C0", signal: 88 },
          { bssid: "90:14:AF:5F:6D:30", signal: 87 },
          { bssid: "90:14:AF:5F:97:00", signal: 85 },
          { bssid: "90:14:AF:5F:6C:00", signal: 83 }
        ]
      };

      const res = await request(app)
        .post("/api/position/estimate")
        .send(scanPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("x");
      expect(res.body).toHaveProperty("y");
      expect(res.body).toHaveProperty("confidence");
      expect(res.body).toHaveProperty("uncertaintyRadius");
      expect(res.body.uncertaintyRadius).toBeGreaterThan(0);
      expect(res.body).toHaveProperty("quality");
      expect(res.body.floorId).toBe("floor-2");
      expect(res.body.source).toBe("wifi");
    });

    it("rejects empty WiFi scan payload with 400", async () => {
      const res = await request(app)
        .post("/api/position/estimate")
        .send({ items: [] });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/routes", () => {
    it("computes shortest route between two nodes", async () => {
      const res = await request(app)
        .post("/api/routes")
        .send({
          origin: { nodeId: "node-204" },
          destination: { nodeId: "exit-west" },
          profile: "shortest"
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("found");
      expect(res.body.totalDistanceMeters).toBeGreaterThan(0);
      expect(res.body.pathPoints.length).toBeGreaterThan(1);
      expect(res.body.segments.length).toBeGreaterThan(0);
    });

    it("computes step-free accessible route", async () => {
      const res = await request(app)
        .post("/api/routes")
        .send({
          origin: { nodeId: "node-208" },
          destination: { nodeId: "exit-west" },
          profile: "step-free"
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("found");
      expect(res.body.profile).toBe("step-free");
      expect(res.body.segments.every((s: any) => s.isStepFree)).toBe(true);
    });

    it("resolves route using coordinates and POI IDs", async () => {
      const res = await request(app)
        .post("/api/routes")
        .send({
          origin: { x: 120, y: 220, floorId: "floor-2" }, // Room 204 coordinates
          destination: { poiId: "poi-exit-west" },
          profile: "recommended"
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("found");
      expect(res.body.pathPoints[0].x).toBe(120);
      expect(res.body.pathPoints[0].y).toBe(220);
    });
  });

  describe("Safety & Emergency Management Routes", () => {
    it("returns initial safety alarm state", async () => {
      const res = await request(app).get("/api/safety/alarm/state");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("state");
      expect(res.body).toHaveProperty("isLatched");
      expect(res.body).toHaveProperty("activeAlarms");
    });

    it("triggers alarm, enforces latching, and executes authorized clear cycle", async () => {
      // 1. Trigger alarm
      const triggerRes = await request(app)
        .post("/api/safety/alarm/trigger")
        .send({
          zoneId: "zone-208",
          message: "Optical smoke detector alarm in Room 208",
          severity: "critical"
        });
      expect(triggerRes.status).toBe(201);
      expect(triggerRes.body.alarmState).toBe("ALARM_ACTIVE");
      expect(triggerRes.body.isLatched).toBe(true);

      // 2. Direct confirm-clear without credentials fails (locked)
      const directClearRes = await request(app)
        .post("/api/safety/alarm/confirm-clear")
        .send({ notes: "Attempted unverified reset" });
      expect(directClearRes.status).toBe(423);

      // 3. Authorize clear with officer credentials
      const authRes = await request(app)
        .post("/api/safety/alarm/authorize-clear")
        .send({
          credentials: {
            officerId: "officer-jones-88",
            role: "security_officer",
            badgeNumber: "SEC-88"
          },
          reason: "Smoke purged from corridor, area secure"
        });
      expect(authRes.status).toBe(200);
      expect(authRes.body.alarmState).toBe("AUTHORIZED_CLEAR_PENDING");

      // 4. Confirm clear and return to NORMAL
      const confirmRes = await request(app)
        .post("/api/safety/alarm/confirm-clear")
        .send({ officerId: "officer-jones-88", notes: "Final all-clear" });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.alarmState).toBe("NORMAL");
      expect(confirmRes.body.isLatched).toBe(false);
    });

    it("returns 2, 5, and 10 minute smoke forecasts with polygon overlays and blocked nodes", async () => {
      const res2 = await request(app).get("/api/safety/smoke/forecast?minutes=2");
      expect(res2.status).toBe(200);
      expect(res2.body.horizonMinutes).toBe(2);
      expect(res2.body.blockedNodeIds).toContain("node-208");
      expect(res2.body.hazardOverlays.length).toBeGreaterThanOrEqual(2);

      const res10 = await request(app).get("/api/safety/smoke/forecast?minutes=10");
      expect(res10.status).toBe(200);
      expect(res10.body.horizonMinutes).toBe(10);
      expect(res10.body.blockedNodeIds).toContain("c-lift");
    });

    it("dispatches high priority SOS alert and transitions through lifecycle", async () => {
      const sosRes = await request(app)
        .post("/api/safety/sos/dispatch")
        .send({
          userId: "user-test-777",
          userName: "Taylor Smith",
          coordinates: { x: 260, y: 220, floorId: "floor-2", accuracyMeters: 2.0 },
          emergencyType: "panic",
          message: "Immediate security assistance requested"
        });

      expect(sosRes.status).toBe(201);
      expect(sosRes.body.alert.priority).toBe("CRITICAL");
      expect(sosRes.body.alert.status).toBe("DISPATCHED");
      const alertId = sosRes.body.alert.id;

      // Check active list
      const activeRes = await request(app).get("/api/safety/sos/active");
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.alerts.some((a: any) => a.id === alertId)).toBe(true);

      // Acknowledge
      const ackRes = await request(app)
        .post(`/api/safety/sos/${alertId}/acknowledge`)
        .send({ responderId: "patrol-car-3" });
      expect(ackRes.status).toBe(200);
      expect(ackRes.body.alert.status).toBe("ACKNOWLEDGED");

      // Resolve
      const resolveRes = await request(app)
        .post(`/api/safety/sos/${alertId}/resolve`)
        .send({ responderId: "patrol-car-3", resolutionNotes: "User safely escorted" });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.alert.status).toBe("RESOLVED");
    });
  });
});
