# RouteGuard — Indoor Emergency Navigation & Life-Safety System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://muj-wifi-bssid-mapper.vercel.app)
[![Website](https://img.shields.io/badge/Website-muj--wifi--bssid--mapper.vercel.app-blue?style=for-the-badge)](https://muj-wifi-bssid-mapper.vercel.app)
[![Test Suite](https://img.shields.io/badge/Tests-74%20Passing-success?style=for-the-badge)](https://github.com/nilabhumeshsingh/RouteGuard)

> 🚀 **Live Production Application:** [https://muj-wifi-bssid-mapper.vercel.app](https://muj-wifi-bssid-mapper.vercel.app)

In a fire, every second counts—but indoor GPS doesn't work, smoke blocks exit signs, and panic sets in. Our app, **RouteGuard**, solves this by turning your building's existing Wi-Fi into a life-saving navigation system. It pinpoints your location indoors, avoids fire and smoke in real-time, and guides you—with voice and vibration—to the safest exit. It even tells rescue teams exactly where you are. We're making buildings smarter and emergencies safer for everyone, especially the most vulnerable.

---

## ⚡ How It Works

- **Sense:** Wi-Fi BSSID signals and phone sensors identify your exact room and floor without relying on satellite GPS.
- **Detect:** Smoke, thermal sensors, and dedicated IoT fire nodes (ESP32) flag active hazards across building compartments.
- **Route:** The graph engine runs real-time Dijkstra and A* pathfinding to compute the safest, shortest, and step-free egress paths avoiding fire compartments and expanding smoke plumes.
- **Guide:** Turn-by-turn spoken guidance (Web Speech API) and tactile vibration pulses navigate occupants directly to clear stairs—even in total darkness or heavy smoke.
- **Rescue:** First responders and guardians view a real-time live map of occupants, room locations, evacuation status, and emergency SOS distress beacons.

---

## 🌟 Key Capabilities

### 1. Real-Time Dynamic Evacuation to Nearest Stairs
- Real-time egress route calculation from the occupant's current room to the nearest safe emergency stairwell (`Stairs & Fire Exit Ramp SW` or `Stairs & Fire Exit NE`).
- Dynamic rerouting when corridors or compartments are compromised by fire or smoke spread.
- Interactive turn-by-turn navigation card displaying distance, step-by-step corridor directions, and estimated walking arrival time.

### 2. Dual 2D Architectural & 3D WebGL Dollhouse Maps
- **2D Architectural Blueprint:** Vectorized SVG floor plan with smooth pan/zoom, room highlighting, live user location dot with uncertainty halo, and animated green evacuation paths with runner exit beacons (`🏃 SAFE STAIRS`).
- **3D Dollhouse View:** Interactive Three.js WebGL model with glowing green emergency route tubes, pulsating red fire hazard boxes, and stairwell beacon light cylinders.

### 3. Wi-Fi BSSID Fingerprinting & Indoor Positioning
- Weighted k-NN estimator ($k=3, 5, 7$) and cosine similarity algorithms comparing live Wi-Fi scans against surveyed radio signal fingerprints for room-level accuracy.
- Corridor polyline map-matching snapping algorithm.

### 4. Dedicated Hardware IoT Fire Node (ESP32)
- Physical ESP32 microcontroller node equipped with an MQ-2 smoke/gas sensor, status LEDs, and physical reset/boot trigger buttons.
- Real-time Wi-Fi BSSID capture and authenticated HTTP dispatch to the cloud safety engine.

### 5. Accessibility & Universal Design
- Step-free mobility profiles strictly prioritizing accessible ramps and lifts during normal transit, and directing users to designated safe refuge zones during emergencies.

---

## 🏗️ Monorepo Architecture

```
RouteGuard/
├── apps/
│   ├── web/             # React 19 + TypeScript + Vite PWA (Apple-inspired UI, 2D/3D map adapters)
│   ├── api/             # Express + Node.js backend (Socket.IO gateway, spatial positioning, MongoDB)
│   └── android/         # Native Android scanner client interfacing with WifiManager
├── packages/
│   ├── shared/          # TypeScript schemas, Zod validation, shared data models
│   ├── graph/           # CampusGraph topology, Dijkstra/A* pathfinding, accessibility policies
│   └── positioning/     # k-NN fingerprint matcher, signal weighting, map-matching
├── firmware/
│   └── esp32_fire_node/ # ESP32 C++ firmware with MQ-2 sensor and Wi-Fi dispatch
├── data/
│   └── sample/          # Academic Block 1 surveyed blueprints, fingerprints, and graph datasets
└── run.sh               # Root launcher running concurrent API and Web dev servers
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI

### 1. Clone & Install
```bash
git clone https://github.com/nilabhumeshsingh/RouteGuard.git
cd RouteGuard
pnpm install
```

### 2. Configure Environment
Create a `.env` file in the root:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/routeguard
JWT_SECRET=your-secret-key
```

### 3. Launch the Application
Run both the Express API (`:4000`) and the Vite Web PWA (`:3000`):
```bash
./run.sh
```

Or run services individually:
```bash
# Terminal 1: Backend API
pnpm --filter @routeguard/api dev

# Terminal 2: Web Frontend PWA
pnpm --filter @routeguard/web dev
```

### 4. Run Test Suite
```bash
pnpm test
```
All 74 unit and integration tests across 10 test suites pass cleanly.

### 5. Build for Production
```bash
pnpm build
```

---

## 🌐 Production Deployment

- **Vercel Web Application:** [https://muj-wifi-bssid-mapper.vercel.app](https://muj-wifi-bssid-mapper.vercel.app)
- **GitHub Repository:** [https://github.com/nilabhumeshsingh/RouteGuard](https://github.com/nilabhumeshsingh/RouteGuard)