import { HazardOverlay } from "@routeguard/shared";

export type ForecastHorizonMinutes = 2 | 5 | 10;

export interface PhysicalCompartment {
  id: string;
  name: string;
  floorId: string;
  nodes: string[];
  polygon: Array<{ x: number; y: number }>;
  fireRatingMinutes: number; // e.g., 30 or 60 min fire-rated door/wall
  connectedCompartmentIds: string[];
}

export interface SmokeForecastHorizon {
  horizonMinutes: ForecastHorizonMinutes;
  horizonSeconds: number;
  description: string;
  hazardOverlays: HazardOverlay[];
  blockedNodeIds: string[];
  blockedEdgeIds: string[];
  envelopePolygon: Array<{ x: number; y: number }>;
  averageToxicityIndex: number; // 0 to 1
  visibilityMeters: number;
}

export interface SmokeSimulationResult {
  incidentOrigin: string;
  floorId: string;
  simulatedAt: number;
  horizons: Record<ForecastHorizonMinutes, SmokeForecastHorizon>;
  getForecast(minutes: ForecastHorizonMinutes): SmokeForecastHorizon;
  isNodeBlocked(nodeId: string, minutes: ForecastHorizonMinutes): boolean;
  isEdgeBlocked(from: string, to: string, minutes: ForecastHorizonMinutes): boolean;
}

/**
 * Standardized Floor 2 Physical Compartment Definitions
 */
export const FLOOR2_COMPARTMENTS: Record<string, PhysicalCompartment> = {
  "comp-208-room": {
    id: "comp-208-room",
    name: "Room 208 Incident Room",
    floorId: "floor-2",
    nodes: ["node-208", "node-wash-girls-208"],
    polygon: [
      { x: 190, y: 180 },
      { x: 245, y: 180 },
      { x: 245, y: 250 },
      { x: 190, y: 250 }
    ],
    fireRatingMinutes: 30,
    connectedCompartmentIds: ["comp-208-corridor"]
  },
  "comp-208-corridor": {
    id: "comp-208-corridor",
    name: "Corridor Hall 208",
    floorId: "floor-2",
    nodes: ["c-208"],
    polygon: [
      { x: 160, y: 255 },
      { x: 250, y: 255 },
      { x: 250, y: 305 },
      { x: 160, y: 305 }
    ],
    fireRatingMinutes: 15,
    connectedCompartmentIds: ["comp-208-room", "comp-206-corridor", "comp-207-room"]
  },
  "comp-206-corridor": {
    id: "comp-206-corridor",
    name: "Corridor 206 Compartment",
    floorId: "floor-2",
    nodes: ["c-206"],
    polygon: [
      { x: 250, y: 255 },
      { x: 335, y: 255 },
      { x: 335, y: 305 },
      { x: 250, y: 305 }
    ],
    fireRatingMinutes: 15,
    connectedCompartmentIds: ["comp-208-corridor", "comp-206-room", "comp-midwest-corridor"]
  },
  "comp-207-room": {
    id: "comp-207-room",
    name: "Room 207 Adjacent Compartment",
    floorId: "floor-2",
    nodes: ["node-207"],
    polygon: [
      { x: 245, y: 180 },
      { x: 285, y: 180 },
      { x: 285, y: 250 },
      { x: 245, y: 250 }
    ],
    fireRatingMinutes: 30,
    connectedCompartmentIds: ["comp-208-corridor"]
  },
  "comp-206-room": {
    id: "comp-206-room",
    name: "Room 206 Adjacent Compartment",
    floorId: "floor-2",
    nodes: ["node-206"],
    polygon: [
      { x: 285, y: 180 },
      { x: 335, y: 180 },
      { x: 335, y: 250 },
      { x: 285, y: 250 }
    ],
    fireRatingMinutes: 30,
    connectedCompartmentIds: ["comp-206-corridor"]
  },
  "comp-midwest-corridor": {
    id: "comp-midwest-corridor",
    name: "Corridor 212-209 Sector",
    floorId: "floor-2",
    nodes: ["c-mid-west", "node-209"],
    polygon: [
      { x: 335, y: 255 },
      { x: 420, y: 255 },
      { x: 420, y: 305 },
      { x: 335, y: 305 }
    ],
    fireRatingMinutes: 15,
    connectedCompartmentIds: ["comp-206-corridor", "comp-mid-corridor"]
  },
  "comp-mid-corridor": {
    id: "comp-mid-corridor",
    name: "Corridor 210-212 Sector",
    floorId: "floor-2",
    nodes: ["c-210", "node-210", "node-212", "c-mid-east", "node-215"],
    polygon: [
      { x: 420, y: 255 },
      { x: 490, y: 255 },
      { x: 490, y: 305 },
      { x: 420, y: 305 }
    ],
    fireRatingMinutes: 15,
    connectedCompartmentIds: ["comp-midwest-corridor", "comp-central-stair-lift"]
  },
  "comp-central-stair-lift": {
    id: "comp-central-stair-lift",
    name: "Central Stairwell & Lift Lobby",
    floorId: "floor-2",
    nodes: ["c-lift", "node-stairs-north", "c-211", "node-211"],
    polygon: [
      { x: 470, y: 150 },
      { x: 535, y: 150 },
      { x: 535, y: 270 },
      { x: 470, y: 270 }
    ],
    fireRatingMinutes: 60,
    connectedCompartmentIds: ["comp-mid-corridor"]
  }
};

/**
 * Predefined bidirectional edges in the Floor 2 topology for affected zones
 */
const EDGE_PAIRS = {
  // 2-minute horizon edges
  HORIZON_2MIN: [
    ["c-208", "node-208"],
    ["c-208", "node-wash-girls-208"],
    ["c-west", "c-208"],
    ["c-208", "c-206"],
    ["c-208", "node-207"]
  ],
  // 5-minute horizon added edges
  HORIZON_5MIN_ADDED: [
    ["c-206", "node-206"],
    ["c-206", "c-balcony"],
    ["c-206", "c-mid-west"]
  ],
  // 10-minute horizon added edges
  HORIZON_10MIN_ADDED: [
    ["c-mid-west", "node-209"],
    ["c-mid-west", "c-210"],
    ["c-210", "node-210"],
    ["c-210", "node-212"],
    ["c-210", "node-214"],
    ["c-210", "c-mid-east"],
    ["c-mid-east", "node-215"],
    ["c-mid-east", "c-211"],
    ["c-211", "node-211"],
    ["c-211", "c-lift"],
    ["c-lift", "node-stairs-north"],
    ["c-211", "c-217"]
  ]
};

function expandBidirectionalEdgeIds(pairs: string[][]): string[] {
  const edgeSet = new Set<string>();
  for (const [from, to] of pairs) {
    edgeSet.add(`${from}->${to}`);
    edgeSet.add(`${to}->${from}`);
  }
  return Array.from(edgeSet);
}

export class SmokeSimulationEngine {
  private floorId: string;

  constructor(floorId = "floor-2") {
    this.floorId = floorId;
  }

  /**
   * Forecast for 2-minute horizon:
   * Incident room/corridor (Room 208, Corridor 208).
   */
  private generate2MinForecast(incidentNode = "node-208"): SmokeForecastHorizon {
    const blockedNodes = ["node-208", "c-208", "node-wash-girls-208"];
    const blockedEdges = expandBidirectionalEdgeIds(EDGE_PAIRS.HORIZON_2MIN);

    const hazardOverlays: HazardOverlay[] = [
      {
        zoneId: "zone-208-room-fire",
        floorId: this.floorId,
        severity: "fire",
        polygon: [
          { x: 190, y: 180 },
          { x: 245, y: 180 },
          { x: 245, y: 250 },
          { x: 190, y: 250 }
        ],
        pulsed: true,
        smokeIntensity: 1.0
      },
      {
        zoneId: "zone-208-corridor-smoke",
        floorId: this.floorId,
        severity: "smoke",
        polygon: [
          { x: 160, y: 255 },
          { x: 250, y: 255 },
          { x: 250, y: 305 },
          { x: 160, y: 305 }
        ],
        pulsed: true,
        smokeIntensity: 0.85
      }
    ];

    const envelopePolygon = [
      { x: 160, y: 180 },
      { x: 250, y: 180 },
      { x: 250, y: 305 },
      { x: 160, y: 305 }
    ];

    return {
      horizonMinutes: 2,
      horizonSeconds: 120,
      description: "Initial ignition stage: heavy smoke and combustion confined to incident Room 208 and Corridor 208 hall.",
      hazardOverlays,
      blockedNodeIds: blockedNodes,
      blockedEdgeIds: blockedEdges,
      envelopePolygon,
      averageToxicityIndex: 0.88,
      visibilityMeters: 1.5
    };
  }

  /**
   * Forecast for 5-minute horizon:
   * Adjacent compartment (Corridor 206, 207, Room 206).
   */
  private generate5MinForecast(base2Min: SmokeForecastHorizon): SmokeForecastHorizon {
    const additionalNodes = ["node-207", "c-206", "node-206"];
    const blockedNodes = Array.from(new Set([...base2Min.blockedNodeIds, ...additionalNodes]));

    const combinedEdgePairs = [...EDGE_PAIRS.HORIZON_2MIN, ...EDGE_PAIRS.HORIZON_5MIN_ADDED];
    const blockedEdges = expandBidirectionalEdgeIds(combinedEdgePairs);

    const additionalOverlays: HazardOverlay[] = [
      {
        zoneId: "zone-206-corridor-smoke",
        floorId: this.floorId,
        severity: "smoke",
        polygon: [
          { x: 250, y: 255 },
          { x: 335, y: 255 },
          { x: 335, y: 305 },
          { x: 250, y: 305 }
        ],
        pulsed: true,
        smokeIntensity: 0.8
      },
      {
        zoneId: "zone-207-room-smoke",
        floorId: this.floorId,
        severity: "smoke",
        polygon: [
          { x: 245, y: 180 },
          { x: 285, y: 180 },
          { x: 285, y: 250 },
          { x: 245, y: 250 }
        ],
        pulsed: true,
        smokeIntensity: 0.75
      },
      {
        zoneId: "zone-206-room-smoke",
        floorId: this.floorId,
        severity: "smoke",
        polygon: [
          { x: 285, y: 180 },
          { x: 335, y: 180 },
          { x: 335, y: 250 },
          { x: 285, y: 250 }
        ],
        pulsed: true,
        smokeIntensity: 0.75
      }
    ];

    const envelopePolygon = [
      { x: 160, y: 180 },
      { x: 335, y: 180 },
      { x: 335, y: 305 },
      { x: 160, y: 305 }
    ];

    return {
      horizonMinutes: 5,
      horizonSeconds: 300,
      description: "Adjacent compartment breach: smoke plume spreads east through Corridor 206, penetrating Room 207 and Room 206.",
      hazardOverlays: [...base2Min.hazardOverlays, ...additionalOverlays],
      blockedNodeIds: blockedNodes,
      blockedEdgeIds: blockedEdges,
      envelopePolygon,
      averageToxicityIndex: 0.78,
      visibilityMeters: 2.8
    };
  }

  /**
   * Forecast for 10-minute horizon:
   * Expanding towards central stairwell (Corridor 212-209, Lift Lobby).
   */
  private generate10MinForecast(base5Min: SmokeForecastHorizon): SmokeForecastHorizon {
    const additionalNodes = [
      "c-mid-west",
      "node-209",
      "c-210",
      "node-210",
      "node-212",
      "c-mid-east",
      "c-lift",
      "node-stairs-north",
      "c-211"
    ];
    const blockedNodes = Array.from(new Set([...base5Min.blockedNodeIds, ...additionalNodes]));

    const combinedEdgePairs = [
      ...EDGE_PAIRS.HORIZON_2MIN,
      ...EDGE_PAIRS.HORIZON_5MIN_ADDED,
      ...EDGE_PAIRS.HORIZON_10MIN_ADDED
    ];
    const blockedEdges = expandBidirectionalEdgeIds(combinedEdgePairs);

    const additionalOverlays: HazardOverlay[] = [
      {
        zoneId: "zone-corridor-212-209-smoke",
        floorId: this.floorId,
        severity: "smoke",
        polygon: [
          { x: 335, y: 255 },
          { x: 420, y: 255 },
          { x: 420, y: 305 },
          { x: 335, y: 305 }
        ],
        pulsed: true,
        smokeIntensity: 0.8
      },
      {
        zoneId: "zone-corridor-210-212-smoke",
        floorId: this.floorId,
        severity: "smoke",
        polygon: [
          { x: 420, y: 255 },
          { x: 490, y: 255 },
          { x: 490, y: 305 },
          { x: 420, y: 305 }
        ],
        pulsed: true,
        smokeIntensity: 0.8
      },
      {
        zoneId: "zone-central-stair-lift-smoke",
        floorId: this.floorId,
        severity: "blocked",
        polygon: [
          { x: 470, y: 150 },
          { x: 535, y: 150 },
          { x: 535, y: 270 },
          { x: 470, y: 270 }
        ],
        pulsed: true,
        smokeIntensity: 0.9
      }
    ];

    const envelopePolygon = [
      { x: 160, y: 150 },
      { x: 535, y: 150 },
      { x: 535, y: 305 },
      { x: 160, y: 305 }
    ];

    return {
      horizonMinutes: 10,
      horizonSeconds: 600,
      description: "Severe expansion: smoke compromises mid-corridor 212-209 and engulfs Elevator Lobby and Central Staircase North.",
      hazardOverlays: [...base5Min.hazardOverlays, ...additionalOverlays],
      blockedNodeIds: blockedNodes,
      blockedEdgeIds: blockedEdges,
      envelopePolygon,
      averageToxicityIndex: 0.85,
      visibilityMeters: 0.8
    };
  }

  /**
   * Run simulation and generate all 3 forecast horizons.
   */
  public runSimulation(incidentOrigin = "node-208"): SmokeSimulationResult {
    const h2 = this.generate2MinForecast(incidentOrigin);
    const h5 = this.generate5MinForecast(h2);
    const h10 = this.generate10MinForecast(h5);

    const horizons: Record<ForecastHorizonMinutes, SmokeForecastHorizon> = {
      2: h2,
      5: h5,
      10: h10
    };

    const simulatedAt = Date.now();
    const floorId = this.floorId;

    return {
      incidentOrigin,
      floorId,
      simulatedAt,
      horizons,
      getForecast: (m: ForecastHorizonMinutes) => horizons[m],
      isNodeBlocked: (nodeId: string, m: ForecastHorizonMinutes) => horizons[m].blockedNodeIds.includes(nodeId),
      isEdgeBlocked: (from: string, to: string, m: ForecastHorizonMinutes) => {
        const key = `${from}->${to}`;
        return horizons[m].blockedEdgeIds.includes(key);
      }
    };
  }

  /**
   * Direct accessor for a single forecast horizon.
   */
  public getForecast(horizonMinutes: ForecastHorizonMinutes, incidentOrigin = "node-208"): SmokeForecastHorizon {
    const simulation = this.runSimulation(incidentOrigin);
    return simulation.getForecast(horizonMinutes);
  }
}

/**
 * Singleton helper for quick forecast queries
 */
export const defaultSmokeSimulation = new SmokeSimulationEngine();

/**
 * Analytical Gaussian Puff Model for Fire Smoke & Effluent Dispersion
 *
 * Models an atmospheric/indoor smoke puff released at source (x0, y0, z0) at t=0,
 * calculating the physical smoke concentration C(x, y, z, t) at any observer position:
 *
 * C(x,y,z,t) = [ Q / ((2π)^(3/2) * σx * σy * σz) ] * exp( -((x - xp)^2 / (2σx^2) + (y - yp)^2 / (2σy^2) + (z - zp)^2 / (2σz^2)) )
 *
 * Where:
 * - xp, yp, zp is the advected puff center (x0 + ux*t, y0 + uy*t, z0 + uz*t)
 * - σx, σy, σz are Gaussian standard deviation dispersion parameters expanding with diffusion: σ = σ0 * (1 + 2*D*t)^0.5
 * - Q is total combustion particulate mass release (mg)
 */
export interface GaussianPuffParams {
  emissionMassQ?: number; // Total smoke mass in milligrams (default: 50,000 mg = 50g)
  initialSigma0?: number; // Initial puff radius in meters (default: 0.8m)
  diffusivityD?: number;  // Atmospheric / eddy diffusion coefficient (default: 0.35 m²/s)
  advectionVelocityX?: number; // Corridor draught velocity X (m/s)
  advectionVelocityY?: number; // Corridor draught velocity Y (m/s)
  thermalBuoyancyZ?: number;   // Thermal plume rising velocity (m/s)
}

export interface GaussianPuffResult {
  concentrationMgM3: number; // Particulate concentration in mg/m³
  toxicityIndex: number;     // Normalized toxicity score (0 to 1)
  visibilityMeters: number;  // Optical visibility according to Jin's formula: V = K / C
  sigma: { x: number; y: number; z: number };
  puffCenter: { x: number; y: number; z: number };
  isHazardous: boolean;
}

export function calculateGaussianPuffConcentration(
  observer: { x: number; y: number; z?: number },
  source: { x: number; y: number; z?: number },
  elapsedSeconds: number,
  params: GaussianPuffParams = {}
): GaussianPuffResult {
  const t = Math.max(0.1, elapsedSeconds);
  const Q = params.emissionMassQ ?? 50000; // mg
  const sigma0 = params.initialSigma0 ?? 0.8; // meters
  const D = params.diffusivityD ?? 0.35; // m²/s
  const ux = params.advectionVelocityX ?? 0.25; // m/s
  const uy = params.advectionVelocityY ?? 0.0;
  const uz = params.thermalBuoyancyZ ?? 0.45; // m/s thermal buoyancy

  // 1. Puff center advection
  const puffX = source.x + ux * t;
  const puffY = source.y + uy * t;
  const puffZ = (source.z ?? 12.25) + uz * t;

  // 2. Gaussian dispersion standard deviation: σ(t) = σ0 * sqrt(1 + 2*D*t / σ0^2)
  const sigmaX = sigma0 * Math.sqrt(1 + (2 * D * t) / (sigma0 * sigma0));
  const sigmaY = sigmaX; // Isotropic horizontal dispersion
  const sigmaZ = sigma0 * Math.sqrt(1 + (D * t) / (sigma0 * sigma0)); // Anisotropic vertical dispersion

  // 3. Gaussian 3D exponential density
  const obsZ = observer.z ?? (source.z ?? 12.25);
  const dx = observer.x - puffX;
  const dy = observer.y - puffY;
  const dz = obsZ - puffZ;

  const exponent = -0.5 * (
    (dx * dx) / (sigmaX * sigmaX) +
    (dy * dy) / (sigmaY * sigmaY) +
    (dz * dz) / (sigmaZ * sigmaZ)
  );

  const normalization = (2 * Math.PI) ** 1.5 * sigmaX * sigmaY * sigmaZ;
  const concentration = (Q / normalization) * Math.exp(Math.max(-20, exponent));

  // 4. Optical visibility & toxicity (Jin's law for irritating fire smoke: V ≈ 2.5 / ExtinctionCoeff)
  // Extinction coefficient K_ext ≈ 0.008 * C_smoke
  const extinctionCoeff = Math.max(0.01, concentration * 0.008);
  const visibilityMeters = Math.min(30.0, Math.max(0.3, 2.5 / extinctionCoeff));
  const toxicityIndex = Math.min(1.0, concentration / 250.0);
  const isHazardous = concentration > 25.0 || visibilityMeters < 3.0;

  return {
    concentrationMgM3: Math.round(concentration * 100) / 100,
    toxicityIndex: Math.round(toxicityIndex * 100) / 100,
    visibilityMeters: Math.round(visibilityMeters * 10) / 10,
    sigma: {
      x: Math.round(sigmaX * 100) / 100,
      y: Math.round(sigmaY * 100) / 100,
      z: Math.round(sigmaZ * 100) / 100
    },
    puffCenter: {
      x: Math.round(puffX * 100) / 100,
      y: Math.round(puffY * 100) / 100,
      z: Math.round(puffZ * 100) / 100
    },
    isHazardous
  };
}
