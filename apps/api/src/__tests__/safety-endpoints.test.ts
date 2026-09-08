import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("CampusSafe Milestone 10 Safety & Emergency Endpoints", () => {
  const app = createApp();

  describe("POST /api/devices/events", () => {
    it("ingests authenticated alarm event from ESP32 fire node", async () => {
      const res = await request(app)
        .post("/api/devices/events")
        .set("x-device-id", "esp32-fire-node-01")
        .set("x-api-key", "device-secret-campus-safe-2026")
        .send({
          deviceId: "esp32-fire-node-01",
          zoneId: "ZONE_FLOOR2_B",
          kind: "alarm",
          sensorValue: 620,
          isManualTrigger: false
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.state).toBe("ALARM_ACTIVE");
      expect(res.body.isLatched).toBe(true);
      expect(res.body).toHaveProperty("forecast");
      expect(res.body.forecast).toHaveProperty("2");
      expect(res.body.forecast).toHaveProperty("5");
      expect(res.body.forecast).toHaveProperty("10");
    });

    it("ingests demo button alarm trigger", async () => {
      const res = await request(app)
        .post("/api/devices/events")
        .send({
          deviceId: "demo-button-01",
          zoneId: "ZONE_FLOOR2_B",
          kind: "alarm",
          isDemo: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.state).toBe("ALARM_ACTIVE");
    });
  });

  describe("POST /api/admin/alarms/:id/clear", () => {
    it("rejects unauthorized clearance attempt without token or credentials", async () => {
      const res = await request(app)
        .post("/api/admin/alarms/alarm-01/clear")
        .send({ credentials: { officerId: "x" } }); // officerId too short

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
    });

    it("authorizes and clears active latching alarm with admin token", async () => {
      const res = await request(app)
        .post("/api/admin/alarms/alarm-01/clear")
        .set("x-admin-token", "campus-safe-admin-2026")
        .send({
          credentials: {
            officerId: "chief-warden-01",
            role: "chief_warden"
          },
          reason: "Smoke successfully dissipated; all zones clear"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.state).toBe("NORMAL");
      expect(res.body.isLatched).toBe(false);
    });
  });

  describe("POST /api/sos", () => {
    it("captures high-priority emergency trigger and returns dynamic evacuation route", async () => {
      const res = await request(app)
        .post("/api/sos")
        .send({
          userId: "usr-student-404",
          userName: "Aarav Sharma",
          coordinates: {
            x: 440,
            y: 220, // Room 210
            floorId: "floor-2"
          },
          emergencyType: "fire",
          message: "Smoke filling the hallway, need immediate exit route!"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.alert).toHaveProperty("id");
      expect(res.body.alert.userId).toBe("usr-student-404");
      expect(res.body.alert.priority).toBe("CRITICAL");

      expect(res.body).toHaveProperty("evacuationRoute");
      expect(res.body.evacuationRoute.status).toBe("found");
      expect(res.body.evacuationRoute.isEmergencyExit).toBe(true);
      expect(res.body.evacuationRoute.pathPoints.length).toBeGreaterThan(1);
    });
  });
});
