import React, { useRef, useState, useCallback, useMemo } from "react";
import { CampusMapAdapter, CameraState, HazardOverlay, MapScene, RoutePoint } from "@routeguard/shared";
import {
  ARCHITECTURAL_ROOMS,
  EMERGENCY_EQUIPMENT,
  FLOOR2_DIMENSIONS,
  ArchitecturalRoom,
  getRoomFootfall,
  FootfallRating
} from "../../data/floor2Data";
import { MapLayerConfig, UserPositionState, FloorId, GuardianState } from "../../types";

export interface Indoor2DMapProps {
  currentFloor: FloorId;
  layers: MapLayerConfig;
  userPosition: UserPositionState;
  routePoints?: RoutePoint[] | null;
  routeIsStepFree?: boolean;
  isEmergencyRoute?: boolean;
  isNightSafety?: boolean;
  hazardOverlays?: HazardOverlay[];
  smokeMinutes?: number;
  guardianState?: GuardianState | null;
  onSelectNode?: (nodeId: string, label: string) => void;
  onSelectRoom?: (room: ArchitecturalRoom) => void;
}

/**
 * Headless CampusMapAdapter implementation conforming to @routeguard/shared
 * for future 3D or headless engine interoperability.
 */
export class Indoor2DAdapter implements CampusMapAdapter {
  public id = "indoor-2d-svg";
  public name = "Vectorized 2D Architectural SVG Adapter";
  private container: HTMLElement | null = null;
  private camera: CameraState = { zoom: 1, targetX: 480, targetY: 260, rotation: 0 };
  private route: Array<{ x: number; y: number }> = [];
  private hazards: HazardOverlay[] = [];
  private userPos = { x: 472, y: 190, uncertaintyRadius: 2.5 };

  public render(container: HTMLElement, scene: MapScene): void {
    this.container = container;
  }

  public setCamera(camera: CameraState): void {
    this.camera = camera;
  }

  public highlightRoute(points: Array<{ x: number; y: number }>, color?: string): void {
    this.route = points;
  }

  public clearRoute(): void {
    this.route = [];
  }

  public setUserPosition(pos: { x: number; y: number; uncertaintyRadius: number }): void {
    this.userPos = pos;
  }

  public setHazards(hazards: HazardOverlay[]): void {
    this.hazards = hazards;
  }

  public destroy(): void {
    this.container = null;
    this.route = [];
    this.hazards = [];
  }
}

/**
 * Interactive React 2D SVG Architectural Map Component with smooth Pan/Zoom,
 * Dynamic Layers, Location Halo, Route Pathing, and Hazard Overlays.
 * Exactly matched to 3D Dollhouse Model geometry (North Wing, South Wing, Central Island, Balcony).
 */
export const Indoor2DMap: React.FC<Indoor2DMapProps> = ({
  currentFloor,
  layers,
  userPosition,
  routePoints,
  routeIsStepFree = false,
  isEmergencyRoute = false,
  isNightSafety = false,
  hazardOverlays = [],
  smokeMinutes = 0,
  guardianState,
  onSelectNode,
  onSelectRoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom Transformation State
  const [zoom, setZoom] = useState(1.05);
  const [pan, setPan] = useState({ x: -20, y: -10 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Resolve effective SVG coordinates for user position
  const resolvedCoords = useMemo(() => {
    // 1. Room label match
    if (userPosition.nearestPlaceName) {
      const cand = userPosition.nearestPlaceName.toLowerCase().replace(/^(ab1\s*|room\s*)/i, '').trim();
      const numMatch = cand.match(/\b(20[1-9]|21[0-9]|220)\b/);
      const code = numMatch ? numMatch[1] : cand;
      const room = ARCHITECTURAL_ROOMS.find(r => r.code === code || r.id === `room-${code}` || r.name.toLowerCase().includes(cand));
      if (room) {
        return {
          x: room.bounds.x + room.bounds.width / 2,
          y: room.bounds.y + room.bounds.height / 2
        };
      }
    }
    // 2. If 3D coordinates were passed (< 50)
    if (Math.abs(userPosition.x) < 50 && Math.abs(userPosition.y) < 50) {
      return {
        x: userPosition.x * 15 + 480,
        y: 242.5 - userPosition.y * 15
      };
    }
    return { x: userPosition.x, y: userPosition.y };
  }, [userPosition.x, userPosition.y, userPosition.nearestPlaceName]);

  // Reset / Recenter smoothly
  const recenter = useCallback(() => {
    setZoom(1.1);
    setPan({
      x: -(resolvedCoords.x - 480) * 1.1,
      y: -(resolvedCoords.y - 260) * 1.1
    });
  }, [resolvedCoords.x, resolvedCoords.y]);

  // Handle Pan interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    setPan({
      x: panOrigin.current.x + dx,
      y: panOrigin.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Wheel Zoom with focal point stabilization
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.6), 3.5));
  };

  // SVG Room Styles based on category
  const getRoomStyle = (category: string) => {
    switch (category) {
      case "lab":
        return {
          fill: "#f0f6ff",
          stroke: "#54a0ff",
          strokeOpacity: 0.8,
          badgeBg: "#54a0ff",
          badgeText: "#ffffff"
        };
      case "classroom":
        return {
          fill: "#ffffff",
          stroke: "#d2d2d7",
          strokeOpacity: 0.9,
          badgeBg: "#f0a24a",
          badgeText: "#ffffff"
        };
      case "office":
        return {
          fill: "#fffbf5",
          stroke: "#f0a24a",
          strokeOpacity: 0.8,
          badgeBg: "#f0a24a",
          badgeText: "#ffffff"
        };
      case "restroom":
        return {
          fill: "#f2fcfb",
          stroke: "#4fd1c2",
          strokeOpacity: 0.8,
          badgeBg: "#4fd1c2",
          badgeText: "#ffffff"
        };
      case "service":
        return {
          fill: "#f8f8fa",
          stroke: "#ef6f6f",
          strokeOpacity: 0.7,
          badgeBg: "#ef6f6f",
          badgeText: "#ffffff"
        };
      case "terrace":
        return {
          fill: "#edf7ee",
          stroke: "#79d189",
          strokeOpacity: 0.8,
          badgeBg: "#79d189",
          badgeText: "#ffffff"
        };
      default:
        return {
          fill: "#ffffff",
          stroke: "#d2d2d7",
          strokeOpacity: 0.6,
          badgeBg: "#8e8e93",
          badgeText: "#ffffff"
        };
    }
  };

  // Coordinate normalization for 3D vs SVG coordinates
  const normalizePt = useCallback((pt: RoutePoint): { x: number; y: number } => {
    if (!pt) return { x: 0, y: 0 };
    if (Math.abs(pt.x) < 50 && Math.abs(pt.y) < 50) {
      return {
        x: pt.x * 15 + 480,
        y: 242.5 - pt.y * 15
      };
    }
    return { x: pt.x, y: pt.y };
  }, []);

  // Turn coordinate route list into SVG path data
  const getPathData = useCallback((points: RoutePoint[]): string => {
    if (!points || points.length === 0) return "";
    return points.reduce((acc, rawPt, idx) => {
      const pt = normalizePt(rawPt);
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, "");
  }, [normalizePt]);

  // Smoke plume expansion parameters for Room 208 (x: 757.5, y: 205)
  const getSmokeProps = (minutes: number) => {
    switch (minutes) {
      case 2:
        return { r: 50, opacity: 0.45 };
      case 5:
        return { r: 90, opacity: 0.65 };
      case 10:
        return { r: 150, opacity: 0.82 };
      default:
        return { r: 0, opacity: 0 };
    }
  };

  const smokeProps = getSmokeProps(smokeMinutes);

  // Active fire hazard detection & coordinate computation
  const activeFireHazard = hazardOverlays.find((h) => h.severity === "fire");
  const rawFireCode = (activeFireHazard?.zoneId || (activeFireHazard as any)?.roomId || "219")
    .replace(/^(room-|ZONE_FLOOR2_)/i, "")
    .trim();
  const matchedFireRoom = ARCHITECTURAL_ROOMS.find(
    (r) =>
      r.code.toLowerCase() === rawFireCode.toLowerCase() ||
      r.id.toLowerCase() === `room-${rawFireCode.toLowerCase()}` ||
      r.id.toLowerCase() === rawFireCode.toLowerCase() ||
      r.name.toLowerCase().includes(rawFireCode.toLowerCase())
  );
  const fireBounds = matchedFireRoom
    ? matchedFireRoom.bounds
    : activeFireHazard?.polygon && activeFireHazard.polygon.length > 0
    ? {
        x: Math.min(...activeFireHazard.polygon.map((p) => p.x)),
        y: Math.min(...activeFireHazard.polygon.map((p) => p.y)),
        width: Math.max(...activeFireHazard.polygon.map((p) => p.x)) - Math.min(...activeFireHazard.polygon.map((p) => p.x)) || 60,
        height: Math.max(...activeFireHazard.polygon.map((p) => p.y)) - Math.min(...activeFireHazard.polygon.map((p) => p.y)) || 75
      }
    : { x: 337.5, y: 302.5, width: 67.5, height: 97.5 };

  const fireCx = fireBounds.x + fireBounds.width / 2;
  const fireCy = fireBounds.y + fireBounds.height / 2;
  const fireLabel = matchedFireRoom ? `FIRE ${matchedFireRoom.name.toUpperCase()}` : `FIRE ROOM ${rawFireCode}`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#081018] touch-none select-none cursor-grab active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Zoom / Reset Recenter HUD */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.2, 3.5))}
          className="w-9 h-9 rounded-full bg-[#162638]/90 text-[#eaf2f8] border border-[#40627e]/40 shadow-lg flex items-center justify-center font-bold text-base hover:bg-[#20344d] transition-all"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.8, 0.5))}
          className="w-9 h-9 rounded-full bg-[#162638]/90 text-[#eaf2f8] border border-[#40627e]/40 shadow-lg flex items-center justify-center font-bold text-base hover:bg-[#20344d] transition-all"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={recenter}
          className="w-9 h-9 rounded-full bg-[#162638]/90 text-[#4fd1c2] border border-[#40627e]/40 shadow-lg flex items-center justify-center text-xs font-semibold hover:bg-[#20344d] transition-all"
          title="Recenter Map"
        >
          ◎
        </button>
      </div>

      <svg
        viewBox={`0 0 ${FLOOR2_DIMENSIONS.width} ${FLOOR2_DIMENSIONS.height}`}
        className="w-full h-full origin-center transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        <defs>
          {/* Floor grid pattern */}
          <pattern id="floorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1c2f42" strokeWidth="0.5" />
          </pattern>

          {/* Void hatch pattern for triple-height lightwells */}
          <pattern id="voidHatch" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="12" stroke="#8f8ff0" strokeWidth="1.2" strokeOpacity="0.4" />
          </pattern>

          {/* Fire compartment gradient */}
          <radialGradient id="fireCompartmentGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff3b30" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#ff453a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#d70015" stopOpacity="0.1" />
          </radialGradient>

          {/* Smoke diffusion gradient */}
          <radialGradient id="smokePlumeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#151b22" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#30363d" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#484f58" stopOpacity="0" />
          </radialGradient>

          {/* Turn chevron marker */}
          <marker
            id="chevronMarker"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 2 2 L 7 5 L 2 8" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </marker>

          {/* Radiant Neon Green Emergency Glow Filter */}
          <filter id="emergencyPathGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Intense Radiant Red Fire Room Glow Filter */}
          <filter id="fireRoomGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="14" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Analytical Gaussian Puff Smoke Dispersion Gradient */}
          <radialGradient id="gaussianPuffGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#151b22" stopOpacity="0.92" />
            <stop offset="38%" stopColor="#252c34" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#3d444d" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#555d68" stopOpacity="0.0" />
          </radialGradient>

          {/* Intense Dark Blue Light Glow Filter */}
          <filter id="neonBlueGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="glowingBlueLightGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#80aaff" stopOpacity="0.9" />
            <stop offset="25%" stopColor="#1a55ff" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#0033cc" stopOpacity="0.5" />
            <stop offset="85%" stopColor="#001a80" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000d40" stopOpacity="0" />
          </radialGradient>

          {/* Location Halo Drop Shadow */}
          <filter id="appleHaloShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0066cc" floodOpacity="0.5" />
          </filter>

          <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
          </filter>

          {/* Deserted / Danger night safety hatch pattern (<15% Footfall · Null or Very Less) */}
          <pattern id="desertedHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#000000" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#111827" strokeWidth="2.8" strokeOpacity="0.85" />
            <line x1="0" y1="0" x2="10" y2="0" stroke="#000000" strokeWidth="1.5" strokeOpacity="0.95" />
          </pattern>
        </defs>

        {/* Outer Dark Void Canvas Background */}
        <rect width={FLOOR2_DIMENSIONS.width} height={FLOOR2_DIMENSIONS.height} fill="#081018" />

        {/* Floor Slab Architectural Footprint */}
        <g id="floor-slab">
          {/* Main rectangular floor slab */}
          <rect
            x="160"
            y="80"
            width="730"
            height="325"
            rx="12"
            fill={isNightSafety ? "#09121a" : "#0f1b29"}
            stroke={isNightSafety ? "#1c3349" : "#1f374e"}
            strokeWidth="2"
          />
          <rect x="160" y="80" width="730" height="325" rx="12" fill="url(#floorGrid)" opacity="0.4" />

          {/* Semicircular Balcony Projection (West Facade) */}
          <path
            d="M 165 152.5 A 90 90 0 0 0 165 332.5 Z"
            fill={isNightSafety ? "#000000" : "#122435"}
            stroke={isNightSafety ? "#000000" : "#79d189"}
            strokeWidth={isNightSafety ? "2.5" : "2"}
          />
          <path
            d="M 165 162.5 A 80 80 0 0 0 165 322.5 Z"
            fill="none"
            stroke={isNightSafety ? "#111827" : "#79d189"}
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        </g>

        {/* Corridors Network (Color-Coded by Footfall when Night Safety Active) */}
        <g id="corridors" className="opacity-95">
          {isNightSafety ? (
            /* Full-Map Footfall Color-Coded Corridors: Green -> Orange -> Red -> Black */
            <g id="night-footfall-corridors">
              {/* --- NORTH CORRIDOR SEGMENTS --- */}
              {/* North West: Deserted / Dead-end (<15%) -> Black (Null / Very Very Less) */}
              <rect x="165" y="182.5" width="105" height="22.5" fill="#000000" stroke="#000000" strokeWidth="1.5" />
              {/* North Mid-West: Moderate Footfall (50-80%) -> Orange (Little Low) */}
              <rect x="270" y="182.5" width="160" height="22.5" fill="#2b1303" stroke="#F97316" strokeWidth="1.2" />
              {/* North Central Concourse: High Footfall (85%+) -> Green */}
              <rect x="430" y="182.5" width="220" height="22.5" fill="#052e16" stroke="#22C55E" strokeWidth="2" />
              {/* North Mid-East: Moderate Footfall (50-80%) -> Orange (Little Low) */}
              <rect x="650" y="182.5" width="130" height="22.5" fill="#2b1303" stroke="#F97316" strokeWidth="1.2" />
              {/* North Far-East: Low Footfall (20-45%) -> Red (Very Low) */}
              <rect x="780" y="182.5" width="105" height="22.5" fill="#2a080c" stroke="#EF4444" strokeWidth="1.2" />

              {/* --- SOUTH CORRIDOR SEGMENTS --- */}
              {/* South West: Deserted / Dead-end (<15%) -> Black (Null / Very Very Less) */}
              <rect x="165" y="280" width="105" height="22.5" fill="#000000" stroke="#000000" strokeWidth="1.5" />
              {/* South Mid-West: Moderate Footfall (50-80%) -> Orange (Little Low) */}
              <rect x="270" y="280" width="160" height="22.5" fill="#2b1303" stroke="#F97316" strokeWidth="1.2" />
              {/* South Central Concourse: High Footfall (85%+) -> Green */}
              <rect x="430" y="280" width="220" height="22.5" fill="#052e16" stroke="#22C55E" strokeWidth="2" />
              {/* South Mid-East: Moderate Footfall (50-80%) -> Orange (Little Low) */}
              <rect x="650" y="280" width="130" height="22.5" fill="#2b1303" stroke="#F97316" strokeWidth="1.2" />
              {/* South Far-East: Low Footfall (20-45%) -> Red (Very Low) */}
              <rect x="780" y="280" width="105" height="22.5" fill="#2a080c" stroke="#EF4444" strokeWidth="1.2" />

              {/* --- VERTICAL CONNECTORS --- */}
              {/* West Atrium Connector: Deserted (<15%) -> Black (Null / Very Very Less) */}
              <rect x="165" y="182.5" width="52.5" height="120" fill="#000000" stroke="#000000" strokeWidth="1.5" />
              <text x="191" y="242" textAnchor="middle" dominantBaseline="central" className="text-[7.5px] font-bold fill-[#9CA3AF] pointer-events-none">
                AVOID
              </text>

              {/* Mid Vertical Connector: High Footfall (85%+) -> Green (Main Monitored Safe Spine) */}
              <rect x="540" y="182.5" width="52.5" height="120" fill="#052e16" stroke="#22C55E" strokeWidth="2" />
              <text x="566" y="242" textAnchor="middle" dominantBaseline="central" className="text-[8px] font-black fill-[#4ADE80] pointer-events-none">
                SAFE CORE
              </text>

              {/* East Vertical Connector: Low Footfall (20-45%) -> Red (Very Low) */}
              <rect x="840" y="182.5" width="45" height="120" fill="#2a080c" stroke="#EF4444" strokeWidth="1.2" />

              {/* Centerline Guideways */}
              <line x1="430" y1="193.75" x2="650" y2="193.75" stroke="#4ADE80" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="430" y1="291.25" x2="650" y2="291.25" stroke="#4ADE80" strokeWidth="1.5" strokeDasharray="4 4" />
            </g>
          ) : (
            /* Standard Corridors */
            <>
              {/* North Corridor: x 165 to 885, y 182.5 to 205 */}
              <rect x="165" y="182.5" width="720" height="22.5" fill="#162638" />
              <line x1="165" y1="193.75" x2="885" y2="193.75" stroke="#40627e" strokeWidth="1" strokeDasharray="5 5" opacity="0.5" />

              {/* South Corridor: x 165 to 885, y 280 to 302.5 */}
              <rect x="165" y="280" width="720" height="22.5" fill="#162638" />
              <line x1="165" y1="291.25" x2="885" y2="291.25" stroke="#40627e" strokeWidth="1" strokeDasharray="5 5" opacity="0.5" />

              {/* West Atrium Connector: connects North & South Corridors in front of Balcony */}
              <rect x="165" y="182.5" width="52.5" height="120" fill="#162638" />

              {/* Mid Vertical Connector: central stairs and elevator pass-through */}
              <rect x="540" y="182.5" width="52.5" height="120" fill="#162638" />

              {/* East Vertical Connector: Northeast fire exit passage */}
              <rect x="840" y="182.5" width="45" height="120" fill="#162638" />
            </>
          )}
        </g>

        {/* Architectural Rooms Layer */}
        {layers.rooms && (
          <g id="architectural-rooms">
            {ARCHITECTURAL_ROOMS.map((room) => {
              // Structural Voids (Lightwells X1, X2, X3)
              if (room.id.startsWith("void-")) {
                return (
                  <g key={room.id} className="pointer-events-none">
                    <rect
                      x={room.bounds.x}
                      y={room.bounds.y}
                      width={room.bounds.width}
                      height={room.bounds.height}
                      rx="6"
                      fill="#0d1520"
                      stroke="#8f8ff0"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    <rect
                      x={room.bounds.x}
                      y={room.bounds.y}
                      width={room.bounds.width}
                      height={room.bounds.height}
                      fill="url(#voidHatch)"
                    />
                    <line
                      x1={room.bounds.x}
                      y1={room.bounds.y}
                      x2={room.bounds.x + room.bounds.width}
                      y2={room.bounds.y + room.bounds.height}
                      stroke="#8f8ff0"
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                    <line
                      x1={room.bounds.x + room.bounds.width}
                      y1={room.bounds.y}
                      x2={room.bounds.x}
                      y2={room.bounds.y + room.bounds.height}
                      stroke="#8f8ff0"
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                    {layers.labels && (
                      <text
                        x={room.bounds.x + room.bounds.width / 2}
                        y={room.bounds.y + room.bounds.height / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[9px] font-bold fill-[#8f8ff0]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {room.code}
                      </text>
                    )}
                  </g>
                );
              }

              // Circular Balcony Room
              if (room.id === "balcony") {
                const balconyFootfall = getRoomFootfall("balcony");
                return (
                  <g
                    key={room.id}
                    className="cursor-pointer transition-transform duration-100 hover:opacity-90"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoom?.(room);
                      onSelectNode?.(room.nodeId, room.name);
                    }}
                  >
                    <path
                      d="M 165 152.5 A 90 90 0 0 0 165 332.5 Z"
                      fill={isNightSafety ? "#000000" : "#122822"}
                      stroke={isNightSafety ? "#000000" : "#79d189"}
                      strokeWidth={isNightSafety ? "3" : "2"}
                    />
                    {layers.labels && (
                      <g className="pointer-events-none select-none">
                        <text
                          x={120}
                          y={234}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={`text-[11px] font-bold ${isNightSafety ? "fill-[#9CA3AF]" : "fill-[#79d189]"}`}
                          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                        >
                          {isNightSafety ? "Balcony (Avoid)" : "Balcony"}
                        </text>
                        <text
                          x={120}
                          y={250}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={`text-[8px] font-semibold ${isNightSafety ? "fill-[#6B7280]" : "fill-[#a3c4b0]"}`}
                        >
                          {isNightSafety ? "⚫ Null Footfall (<15%)" : "Outdoor Terrace"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              }

              const style = getRoomStyle(room.category);
              const isNorth = room.wing === "North Wing";
              const isSouth = room.wing === "South Wing";
              const footfall = getRoomFootfall(room.id);

              const roomFill = isNightSafety
                ? footfall.fillColor
                : room.category === "lab"
                ? "#0f2338"
                : room.category === "restroom"
                ? "#0e2a2c"
                : room.category === "service"
                ? "#281b1f"
                : "#122030";

              const roomStroke = isNightSafety ? footfall.strokeColor : style.stroke;
              const roomStrokeWidth = isNightSafety
                ? footfall.tier === "high" || footfall.tier === "deserted"
                  ? "2"
                  : "1.4"
                : "1.2";

              return (
                <g
                  key={room.id}
                  className="cursor-pointer transition-transform duration-100 hover:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRoom?.(room);
                    onSelectNode?.(room.nodeId, room.name);
                  }}
                >
                  <rect
                    x={room.bounds.x}
                    y={room.bounds.y}
                    width={room.bounds.width}
                    height={room.bounds.height}
                    rx="6"
                    fill={roomFill}
                    stroke={roomStroke}
                    strokeWidth={roomStrokeWidth}
                    strokeOpacity={isNightSafety ? 0.95 : style.strokeOpacity}
                  />

                  {/* Room Doorway Indicator */}
                  <line
                    x1={room.bounds.x + room.bounds.width / 2 - 8}
                    y1={isNorth ? room.bounds.y + room.bounds.height : isSouth ? room.bounds.y : room.bounds.y}
                    x2={room.bounds.x + room.bounds.width / 2 + 8}
                    y2={isNorth ? room.bounds.y + room.bounds.height : isSouth ? room.bounds.y : room.bounds.y}
                    stroke={isNightSafety ? footfall.strokeColor : "#4fd1c2"}
                    strokeWidth="2.5"
                  />

                  {/* Night Safety Footfall Percentage Badge */}
                  {isNightSafety && (
                    <g transform={`translate(${room.bounds.x + room.bounds.width - 24}, ${room.bounds.y + 4})`}>
                      <rect
                        width="20"
                        height="11"
                        rx="3"
                        fill={footfall.color}
                        fillOpacity="0.25"
                        stroke={footfall.color}
                        strokeWidth="0.8"
                      />
                      <text
                        x="10"
                        y="6"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[7px] font-bold"
                        fill={footfall.color}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {footfall.badge}
                      </text>
                    </g>
                  )}

                  {/* Room Code & Name */}
                  {layers.labels && (
                    <g className="pointer-events-none select-none">
                      <text
                        x={room.bounds.x + room.bounds.width / 2}
                        y={room.bounds.y + room.bounds.height / 2 - 5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`text-[11px] font-bold ${
                          isNightSafety && footfall.tier === "high"
                            ? "fill-[#86efac]"
                            : isNightSafety && footfall.tier === "deserted"
                            ? "fill-[#fca5a5]"
                            : "fill-[#eaf2f8]"
                        }`}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {room.code}
                      </text>
                      <text
                        x={room.bounds.x + room.bounds.width / 2}
                        y={room.bounds.y + room.bounds.height / 2 + 9}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[8px] fill-[#8ea7b8] font-medium"
                        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                      >
                        {room.category === "lab" ? "Lab" : room.category === "office" ? "Office" : room.category === "restroom" ? "WC" : room.category === "service" ? "Core" : "Class"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* POI Markers Layer */}
        {layers.pois && (
          <g id="poi-markers" className="pointer-events-none select-none">
            {/* Restrooms */}
            <g transform="translate(243, 133)">
              <circle r="10" fill="#4fd1c2" fillOpacity="0.2" stroke="#4fd1c2" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#4fd1c2]">M-WC</text>
            </g>
            <g transform="translate(817, 133)">
              <circle r="10" fill="#4fd1c2" fillOpacity="0.2" stroke="#4fd1c2" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#4fd1c2]">F-WC</text>
            </g>
            <g transform="translate(243, 351)">
              <circle r="10" fill="#4fd1c2" fillOpacity="0.2" stroke="#4fd1c2" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#4fd1c2]">F-WC</text>
            </g>
            <g transform="translate(817, 351)">
              <circle r="10" fill="#4fd1c2" fillOpacity="0.2" stroke="#4fd1c2" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#4fd1c2]">M-WC</text>
            </g>

            {/* Elevators & Stairs */}
            <g transform="translate(566, 133)">
              <rect x="-14" y="-9" width="28" height="18" rx="4" fill="#0066cc" fillOpacity="0.3" stroke="#0066cc" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#54a0ff]">LIFT</text>
            </g>
          </g>
        )}

        {/* Emergency Equipment Layer */}
        {layers.emergencyEquipment && (
          <g id="emergency-equipment">
            {EMERGENCY_EQUIPMENT.map((eq) => {
              if (eq.type === "exit-ramp") {
                return (
                  <g
                    key={eq.id}
                    transform={`translate(${eq.x}, ${eq.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (eq.nodeId) onSelectNode?.(eq.nodeId, eq.label);
                    }}
                  >
                    <rect x="-26" y="-12" width="52" height="24" rx="6" fill="#34c759" filter="url(#pinShadow)" />
                    <text
                      textAnchor="middle"
                      y="-0.5"
                      dominantBaseline="central"
                      className="text-[8px] font-bold fill-white"
                      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                    >
                      EXIT (RAMP)
                    </text>
                  </g>
                );
              }
              if (eq.type === "exit-door") {
                return (
                  <g
                    key={eq.id}
                    transform={`translate(${eq.x}, ${eq.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (eq.nodeId) onSelectNode?.(eq.nodeId, eq.label);
                    }}
                  >
                    <rect x="-18" y="-11" width="36" height="22" rx="5" fill="#34c759" filter="url(#pinShadow)" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[8px] font-bold fill-white"
                      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                    >
                      EXIT
                    </text>
                  </g>
                );
              }
              if (eq.type === "extinguisher") {
                return (
                  <g key={eq.id} transform={`translate(${eq.x}, ${eq.y})`} className="pointer-events-none">
                    <circle r="7" fill="#ff3b30" stroke="#ffffff" strokeWidth="1.5" />
                    <text textAnchor="middle" y="0.5" dominantBaseline="central" className="text-[7px] font-black fill-white">
                      FE
                    </text>
                  </g>
                );
              }
              if (eq.type === "aed") {
                return (
                  <g key={eq.id} transform={`translate(${eq.x}, ${eq.y})`} className="pointer-events-none">
                    <rect x="-8" y="-8" width="16" height="16" rx="4" fill="#34c759" stroke="#ffffff" strokeWidth="1.5" />
                    <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-black fill-white">
                      +
                    </text>
                  </g>
                );
              }
              return null;
            })}
          </g>
        )}

        {/* Hazard Overlays (Fire Compartment & Dynamic Smoke Plumes) */}
        {layers.hazards && (
          <g id="hazards-layer">
            {/* Active Fire Room — Glowing Fiery Red */}
            {activeFireHazard && (
              <g className="animate-fire pointer-events-none">
                {/* Volumetric Radiant Red Room Aura */}
                <rect
                  x={fireBounds.x - 4}
                  y={fireBounds.y - 4}
                  width={fireBounds.width + 8}
                  height={fireBounds.height + 8}
                  rx="10"
                  fill="none"
                  stroke="#ff1a00"
                  strokeWidth="3.5"
                  opacity="0.85"
                  filter="url(#fireRoomGlow)"
                  className="animate-pulse"
                />
                <rect
                  x={fireBounds.x}
                  y={fireBounds.y}
                  width={fireBounds.width}
                  height={fireBounds.height}
                  rx="6"
                  fill="url(#fireCompartmentGrad)"
                  filter="url(#fireRoomGlow)"
                  stroke="#ff2200"
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                />
                <g transform={`translate(${fireCx}, ${fireCy - 8})`}>
                  <circle r="14" fill="#ff1a00" stroke="#ffffff" strokeWidth="2.5" filter="url(#fireRoomGlow)" />
                  <text textAnchor="middle" y="1" dominantBaseline="central" className="text-[13px]">
                    🔥
                  </text>
                </g>
                <text
                  x={fireCx}
                  y={fireCy + 18}
                  textAnchor="middle"
                  className="text-[9px] font-extrabold fill-[#ff3b30] tracking-wide"
                >
                  {fireLabel} · ACTIVE FIRE
                </text>
              </g>
            )}

            {/* Gaussian Puff Model Smoke Plumes Overlay */}
            {smokeMinutes > 0 && (
              <g id="smoke-simulation" className="pointer-events-none">
                {/* 1σ Core Gaussian Puff Plume */}
                <circle
                  cx={fireCx}
                  cy={fireCy}
                  r={smokeProps.r}
                  fill="url(#gaussianPuffGrad)"
                  opacity={smokeProps.opacity}
                  className="transition-all duration-700 ease-out"
                />
                {/* 2σ Dispersion Contour */}
                <circle
                  cx={fireCx}
                  cy={fireCy}
                  r={smokeProps.r * 1.35}
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                  opacity="0.65"
                  className="transition-all duration-700 ease-out"
                />
                {/* 3σ Dispersion Boundary */}
                <circle
                  cx={fireCx}
                  cy={fireCy}
                  r={smokeProps.r * 1.75}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="1.0"
                  strokeDasharray="3 4"
                  opacity="0.45"
                  className="transition-all duration-700 ease-out"
                />

                {smokeMinutes >= 5 && (
                  <g>
                    <circle
                      cx={fireCx - (fireCx > 500 ? 60 : -60)}
                      cy={fireCy}
                      r={smokeProps.r * 0.82}
                      fill="url(#gaussianPuffGrad)"
                      opacity={smokeProps.opacity * 0.85}
                      className="transition-all duration-700 ease-out"
                    />
                    <circle
                      cx={fireCx - (fireCx > 500 ? 60 : -60)}
                      cy={fireCy}
                      r={smokeProps.r * 1.15}
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="1.0"
                      strokeDasharray="3 3"
                      opacity="0.5"
                    />
                  </g>
                )}
                {smokeMinutes >= 10 && (
                  <g>
                    <circle
                      cx={fireCx - (fireCx > 500 ? 120 : -120)}
                      cy={fireCy}
                      r={smokeProps.r * 0.9}
                      fill="url(#gaussianPuffGrad)"
                      opacity={smokeProps.opacity * 0.85}
                      className="transition-all duration-700 ease-out"
                    />
                    <circle
                      cx={fireCx - (fireCx > 500 ? 120 : -120)}
                      cy={fireCy}
                      r={smokeProps.r * 1.25}
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="1.0"
                      strokeDasharray="3 3"
                      opacity="0.5"
                    />
                  </g>
                )}

                <text
                  x={fireCx}
                  y={fireCy - smokeProps.r - 8}
                  textAnchor="middle"
                  className="text-[7.5px] font-bold fill-[#9ca3af] tracking-wider uppercase"
                >
                  Gaussian Puff Plume · {smokeMinutes}m Dispersion
                </text>
              </g>
            )}
          </g>
        )}

        {/* Active Route Path Layer */}
        {routePoints && routePoints.length > 1 && (
          <g id="active-route" className="pointer-events-none">
            {/* Soft Radiant Route Halo / Glow */}
            <path
              d={getPathData(routePoints)}
              fill="none"
              stroke={isEmergencyRoute ? "#00ff66" : "#4fd1c2"}
              strokeWidth={isEmergencyRoute ? "18" : "12"}
              strokeOpacity={isEmergencyRoute ? "0.6" : "0.3"}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={isEmergencyRoute ? "url(#emergencyPathGlow)" : undefined}
              className={isEmergencyRoute ? "animate-pulse" : undefined}
            />

            {/* Core Route Polyline */}
            <path
              d={getPathData(routePoints)}
              fill="none"
              stroke={isEmergencyRoute ? "#00e676" : "#4fd1c2"}
              strokeWidth={isEmergencyRoute ? "6" : "4"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Animated Marching Flow Overlay */}
            <path
              d={getPathData(routePoints)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={isEmergencyRoute ? "3.5" : "2.5"}
              strokeDasharray={isEmergencyRoute ? "10 14" : "6 14"}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-route-flow"
            />

            {/* Origin Dot */}
            <circle
              cx={normalizePt(routePoints[0]).x}
              cy={normalizePt(routePoints[0]).y}
              r={isEmergencyRoute ? "8" : "7"}
              fill={isEmergencyRoute ? "#00ff66" : "#4fd1c2"}
              stroke="#ffffff"
              strokeWidth="2.5"
              filter={isEmergencyRoute ? "url(#emergencyPathGlow)" : undefined}
            />

            {/* Destination Target Pin (Ground Floor Fire Exit in Emergency) */}
            <g transform={`translate(${normalizePt(routePoints[routePoints.length - 1]).x}, ${normalizePt(routePoints[routePoints.length - 1]).y})`}>
              {isEmergencyRoute ? (
                <g>
                  {/* Expanding Pulsing Ring */}
                  <circle r="26" fill="none" stroke="#00ff66" strokeWidth="2.5" strokeDasharray="6 3" className="animate-ping opacity-80" />
                  <circle r="16" fill="#042612" stroke="#00ff66" strokeWidth="3" filter="url(#emergencyPathGlow)" />
                  <text textAnchor="middle" y="2" dominantBaseline="central" className="text-[15px]">
                    🏃
                  </text>
                  {/* High-visibility badge with ground exit details */}
                  <g transform="translate(22, -18)">
                    <rect x="0" y="0" width="168" height="34" rx="8" fill="#042612" fillOpacity="0.96" stroke="#00ff66" strokeWidth="2" filter="url(#emergencyPathGlow)" />
                    <text x="10" y="14" className="text-[10px] font-bold fill-white tracking-wide">
                      GROUND FLOOR FIRE EXIT
                    </text>
                    <text x="10" y="27" className="text-[8.5px] font-semibold fill-[#86efac]">
                      ⬇️ Descend Stairs · Safe Assembly
                    </text>
                  </g>
                </g>
              ) : (
                <g>
                  <circle r="9" fill="#f0a24a" stroke="#ffffff" strokeWidth="2" filter="url(#pinShadow)" />
                  <circle r="3.5" fill="#ffffff" />
                </g>
              )}
            </g>

            {/* Step-Free Accessibility Badge on Route */}
            {routeIsStepFree && routePoints.length > 2 && (
              <g
                transform={`translate(${normalizePt(routePoints[Math.floor(routePoints.length / 2)]).x + 10}, ${normalizePt(routePoints[Math.floor(routePoints.length / 2)]).y - 12})`}
              >
                <rect x="0" y="0" width="72" height="18" rx="9" fill="#162638" stroke="#4fd1c2" strokeWidth="1" filter="url(#pinShadow)" />
                <text x="7" y="12" className="text-[8px] font-bold fill-[#4fd1c2]">
                  ♿ Step-Free
                </text>
              </g>
            )}
          </g>
        )}

        {/* Guardian Ward Position Marker */}
        {guardianState?.isPaired && guardianState.childPosition && (
          <g
            id="guardian-ward-marker"
            transform={`translate(${guardianState.childPosition.x}, ${guardianState.childPosition.y})`}
            className="pointer-events-none"
          >
            <circle r="18" fill="#f0a24a" fillOpacity="0.2" className="animate-pulse" />
            <circle r="8" fill="#f0a24a" stroke="#ffffff" strokeWidth="2" filter="url(#pinShadow)" />
            <rect x="-24" y="-22" width="48" height="15" rx="7.5" fill="#081018" stroke="#f0a24a" strokeWidth="1" />
            <text textAnchor="middle" y="-12" className="text-[8px] font-bold fill-[#f0a24a]">
              {guardianState.childName}
            </text>
          </g>
        )}

        {/* User Location Dot with Glowing Dark Blue Light Beacon */}
        <g id="user-location-marker" className="pointer-events-none">
          {/* Broad Diffused Glowing Light Aura */}
          <circle
            cx={resolvedCoords.x}
            cy={resolvedCoords.y}
            r={Math.max(48, userPosition.uncertaintyRadius * 16)}
            fill="url(#glowingBlueLightGrad)"
            filter="url(#neonBlueGlow)"
            className="animate-pulse"
            opacity="0.85"
          />

          {/* Animated Pulsing Uncertainty Halo */}
          <circle
            cx={resolvedCoords.x}
            cy={resolvedCoords.y}
            r={userPosition.uncertaintyRadius * 12}
            fill="#002299"
            fillOpacity="0.22"
            stroke="#0033cc"
            strokeWidth="1.5"
            strokeOpacity="0.75"
            className="animate-halo"
          />

          {/* Inner Glowing Radar Ripple Ring */}
          <circle
            cx={resolvedCoords.x}
            cy={resolvedCoords.y}
            r="20"
            fill="none"
            stroke="#1a55ff"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.75"
          />

          {/* Intense Dark Blue Light Core */}
          <circle
            cx={resolvedCoords.x}
            cy={resolvedCoords.y}
            r="10"
            fill="#0033cc"
            stroke="#ffffff"
            strokeWidth="2.5"
            filter="url(#neonBlueGlow)"
          />

          {/* Inner Photon Center Dot */}
          <circle cx={resolvedCoords.x} cy={resolvedCoords.y} r="4" fill="#b3d1ff" />

          {/* Floating Dark Blue Badge */}
          <g transform={`translate(${resolvedCoords.x}, ${resolvedCoords.y - 22})`}>
            <rect
              x="-46"
              y="-12"
              width="92"
              height="18"
              rx="9"
              fill="#020d26"
              fillOpacity="0.95"
              stroke="#0033cc"
              strokeWidth="1.2"
              filter="url(#neonBlueGlow)"
            />
            <text
              x="0"
              y="1"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[9px] font-bold fill-[#b3d1ff] tracking-wide"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              YOU ARE HERE
            </text>
          </g>
        </g>
      </svg>

      {/* Night Safety Footfall Density Legend Overlay */}
      {isNightSafety && (
        <div className="absolute bottom-6 right-4 z-10 bg-[#0c1520]/95 backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-[#233a52] text-xs max-w-[260px] pointer-events-auto select-none">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#1f374e]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="font-bold text-[#eaf2f8] text-[11px]">Night Footfall Safety Map</span>
            </div>
            <span className="text-[10px] font-mono text-[#4fd1c2]">2F</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#22c55e] shrink-0 border border-[#16a34a]" />
              <span className="text-[#a7f3d0] font-semibold">Green: High Footfall (85%+) · Safest</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#f97316] shrink-0 border border-[#ea580c]" />
              <span className="text-[#fed7aa] font-semibold">Orange: Little Low / Moderate (50-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#ef4444] shrink-0 border border-[#dc2626]" />
              <span className="text-[#fca5a5] font-semibold">Red: Very Low Footfall (20-45%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#000000] shrink-0 border border-[#374151]" />
              <span className="text-[#e5e7eb] font-semibold">Black: Null / Very Very Less (&lt;15%) · Avoid</span>
            </div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-[#1f374e] text-[9px] text-[#8ea7b8] leading-tight">
            Full floor mapped. Safe Night routing automatically prioritizes green concourses and avoids black null-footfall areas.
          </div>
        </div>
      )}
    </div>
  );
};
