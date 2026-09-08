import dotenv from "dotenv";
import path from "node:path";

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  host: process.env.HOST || "0.0.0.0",
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/routeguard",
  mongodbDbName: process.env.MONGODB_DB_NAME || "routeguard",
  apiKey: process.env.DEVICE_API_KEY || "device-secret-campus-safe-2026",
  adminToken: process.env.ADMIN_TOKEN || "campus-safe-admin-2026",
  dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), "data/sample"),

  campus: {
    campusName: "Manipal University Jaipur",
    building: "Academic Block 1 (AB1)",
    description: "Main academic complex housing engineering laboratories, lecture halls, and faculty departments.",
    boundaries: {
      minX: 0,
      maxX: 850,
      minY: 0,
      maxY: 650,
      latitude: 26.8438,
      longitude: 75.5659,
      polygon: [
        { x: 0, y: 0 },
        { x: 850, y: 0 },
        { x: 850, y: 650 },
        { x: 0, y: 650 }
      ],
      geoCoordinates: [
        { lat: 26.8439, lng: 75.5652 },
        { lat: 26.8439, lng: 75.5665 },
        { lat: 26.8428, lng: 75.5665 },
        { lat: 26.8428, lng: 75.5652 }
      ]
    },
    helpContacts: [
      {
        role: "Campus Emergency Security",
        phone: "+91 141 3999100",
        extension: "100",
        location: "AB1 Central Security Desk",
        priority: 1
      },
      {
        role: "Medical Centre / Campus Ambulance",
        phone: "+91 141 3999102",
        extension: "102",
        location: "Student Activity Center (SAC)",
        priority: 1
      },
      {
        role: "Fire Hazard Quick Response",
        phone: "+91 141 3999101",
        extension: "101",
        location: "Fire Station Post West",
        priority: 1
      },
      {
        role: "Floor Safety Warden (Floor 2)",
        phone: "+91 141 3999208",
        extension: "208",
        location: "Room 208 Corridor Desk",
        priority: 2
      }
    ],
    activeFloors: [
      {
        id: "floor-2",
        floorNumber: 2,
        label: "Academic Block 1 - Second Floor",
        isSurveyed: true,
        active: true,
        dimensions: { width: 850, height: 650 }
      }
    ]
  }
};
