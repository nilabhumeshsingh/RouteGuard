import React, { useRef, useState, useEffect, useCallback } from "react";
import { CampusMapAdapter, CameraState, HazardOverlay, MapScene, RoutePoint } from "@routeguard/shared";
import {
  ARCHITECTURAL_ROOMS,
  EMERGENCY_EQUIPMENT,
  FLOOR2_DIMENSIONS,
  ArchitecturalRoom,
  EmergencyEquipment
} from "../../data/floor2Data";
import { MapLayerConfig, UserPositionState, FloorId, GuardianState } from "../../types";

export interface Indoor2DMapProps {
  currentFloor: FloorId;
  layers: MapLayerConfig;
  userPosition: UserPositionState;
  routePoints?: RoutePoint[] | null;
  routeIsStepFree?: boolean;
  isEmergencyRoute?: boolean;
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
  private camera: CameraState = { zoom: 1, targetX: 425, targetY: 325, rotation: 0 };
  private route: Array<{ x: number; y: number }> = [];
  private hazards: HazardOverlay[] = [];
  private userPos = { x: 120, y: 220, uncertaintyRadius: 2.5 };

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
 */
export const Indoor2DMap: React.FC<Indoor2DMapProps> = ({
  currentFloor,
  layers,
  userPosition,
  routePoints,
  routeIsStepFree = false,
  isEmergencyRoute = false,
  hazardOverlays = [],
  smokeMinutes = 0,
  guardianState,
  onSelectNode,
  onSelectRoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom Transformation State
  const [zoom, setZoom] = useState(1.15);
  const [pan, setPan] = useState({ x: -40, y: -40 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Reset / Recenter smoothly
  const recenter = useCallback(() => {
    setZoom(1.2);
    setPan({
      x: -(userPosition.x - 380) * 1.2,
      y: -(userPosition.y - 280) * 1.2
    });
  }, [userPosition.x, userPosition.y]);

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
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.6), 3.2));
  };

  // SVG route path generator
  const getPathData = (points: RoutePoint[]): string => {
    if (!points || points.length === 0) return "";
    return points.reduce((acc, pt, index) => {
      return index === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, "");
  };

  // Category styles for rooms
  const getRoomStyle = (category: ArchitecturalRoom["category"]) => {
    switch (category) {
      case "lab":
        return { fill: "#f0f6ff", stroke: "#0066cc", strokeOpacity: 0.25 };
      case "restroom":
        return { fill: "#f2f9f4", stroke: "#34c759", strokeOpacity: 0.3 };
      case "office":
        return { fill: "#fdf8ee", stroke: "#ff9500", strokeOpacity: 0.3 };
      case "service":
        return { fill: "#f2f2f7", stroke: "#8e8e93", strokeOpacity: 0.4 };
      default:
        return { fill: "#ffffff", stroke: "#e0e0e0", strokeOpacity: 1 };
    }
  };

  // Compute smoke plume radius and opacity based on forecast
  const getSmokeProps = () => {
    switch (smokeMinutes) {
      case 2:
        return { r: 75, opacity: 0.45 };
      case 5:
        return { r: 125, opacity: 0.6 };
      case 10:
        return { r: 180, opacity: 0.72 };
      default:
        return { r: 45, opacity: 0.3 };
    }
  };

  const smokeProps = getSmokeProps();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#f5f5f7] cursor-grab active:cursor-grabbing touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <svg
        viewBox={`0 0 ${FLOOR2_DIMENSIONS.width} ${FLOOR2_DIMENSIONS.height}`}
        className="w-full h-full transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center"
        }}
      >
        <defs>
          {/* Subtle grid pattern */}
          <pattern id="floorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8e8ed" strokeWidth="0.5" />
          </pattern>

          {/* Fire compartment gradient */}
          <radialGradient id="fireCompartmentGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff3b30" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#ff453a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#d70015" stopOpacity="0.1" />
          </radialGradient>

          {/* Smoke diffusion gradient */}
          <radialGradient id="smokePlumeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2c2c2e" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#48484a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#636366" stopOpacity="0" />
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

          {/* Location Halo Drop Shadow */}
          <filter id="appleHaloShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0066cc" floodOpacity="0.3" />
          </filter>

          <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Floor Slab Background Canvas */}
        <rect
          x="50"
          y="100"
          width="760"
          height="500"
          rx="24"
          fill="#fafafc"
          stroke="#e0e0e0"
          strokeWidth="1.5"
        />
        <rect x="50" y="100" width="760" height="500" rx="24" fill="url(#floorGrid)" opacity="0.6" />

        {/* Corridors Architecture */}
        <g id="corridors" className="opacity-95">
          {/* Main Corridor East-West */}
          <rect x="65" y="260" width="730" height="40" fill="#f0f0f4" />
          <line x1="75" y1="280" x2="785" y2="280" stroke="#d2d2d7" strokeWidth="1" strokeDasharray="4 4" />

          {/* West South Corridor */}
          <rect x="105" y="295" width="30" height="155" fill="#f0f0f4" />

          {/* Balcony Corridor South */}
          <rect x="285" y="295" width="30" height="200" fill="#f0f0f4" />

          {/* Circular Balcony Terrace */}
          <circle cx="300" cy="545" r="45" fill="#edf4f0" stroke="#a3c4b0" strokeWidth="1.5" />
          <circle cx="300" cy="545" r="38" fill="none" stroke="#a3c4b0" strokeWidth="1" strokeDasharray="3 3" />

          {/* Central South Corridor */}
          <rect x="485" y="295" width="30" height="95" fill="#f0f0f4" />
        </g>

        {/* Architectural Rooms Layer */}
        {layers.rooms && (
          <g id="architectural-rooms">
            {ARCHITECTURAL_ROOMS.map((room) => {
              const style = getRoomStyle(room.category);
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
                    rx="8"
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth="1.2"
                    strokeOpacity={style.strokeOpacity}
                  />

                  {/* Room Doorway Indicator */}
                  <line
                    x1={room.bounds.x + room.bounds.width / 2 - 8}
                    y1={room.bounds.y > 270 ? room.bounds.y : room.bounds.y + room.bounds.height}
                    x2={room.bounds.x + room.bounds.width / 2 + 8}
                    y2={room.bounds.y > 270 ? room.bounds.y : room.bounds.y + room.bounds.height}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />

                  {/* Room Code & Name (if labels active) */}
                  {layers.labels && (
                    <g className="pointer-events-none select-none">
                      <text
                        x={room.bounds.x + room.bounds.width / 2}
                        y={room.bounds.y + room.bounds.height / 2 - (room.bounds.height > 60 ? 4 : 0)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[11px] font-semibold fill-[#1d1d1f]"
                        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                      >
                        {room.code}
                      </text>
                      {room.bounds.height > 60 && (
                        <text
                          x={room.bounds.x + room.bounds.width / 2}
                          y={room.bounds.y + room.bounds.height / 2 + 10}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-[8px] fill-[#86868b] font-medium"
                          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                        >
                          {room.category === "lab" ? "Lab" : room.category === "office" ? "Office" : ""}
                        </text>
                      )}
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
            {/* Restroom Glyphs */}
            <g transform="translate(110, 415)">
              <circle r="10" fill="#34c759" fillOpacity="0.15" stroke="#34c759" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[9px] font-bold fill-[#248a3d]">WC</text>
            </g>
            <g transform="translate(200, 145)">
              <circle r="9" fill="#34c759" fillOpacity="0.15" stroke="#34c759" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#248a3d]">W</text>
            </g>
            <g transform="translate(495, 355)">
              <circle r="9" fill="#34c759" fillOpacity="0.15" stroke="#34c759" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-[#248a3d]">W</text>
            </g>

            {/* Elevator & Stairs Glyphs */}
            <g transform="translate(500, 230)">
              <rect x="-12" y="-10" width="24" height="20" rx="5" fill="#0066cc" fillOpacity="0.15" stroke="#0066cc" strokeWidth="1" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[9px] font-bold fill-[#0066cc]">LIFT</text>
            </g>
            <g transform="translate(500, 175)">
              <rect x="-14" y="-8" width="28" height="16" rx="4" fill="#8e8e93" fillOpacity="0.2" />
              <text textAnchor="middle" dominantBaseline="central" className="text-[8px] font-medium fill-[#333333]">STAIRS</text>
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
                    <rect x="-24" y="-14" width="48" height="28" rx="7" fill="#34c759" filter="url(#pinShadow)" />
                    <text
                      textAnchor="middle"
                      y="-1"
                      dominantBaseline="central"
                      className="text-[9px] font-bold fill-white"
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
                    <rect x="-18" y="-12" width="36" height="24" rx="6" fill="#34c759" filter="url(#pinShadow)" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[9px] font-bold fill-white"
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

        {/* Hazard Overlays (Fire Compartment & Smoke Plumes) */}
        {layers.hazards && (
          <g id="hazards-layer">
            {/* Active Fire Compartment (Room 208) */}
            {hazardOverlays.some((h) => h.severity === "fire") && (
              <g className="animate-fire pointer-events-none">
                <rect
                  x="185"
                  y="170"
                  width="70"
                  height="85"
                  rx="8"
                  fill="url(#fireCompartmentGrad)"
                  stroke="#ff3b30"
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                />
                <g transform="translate(220, 205)">
                  <circle r="14" fill="#ff3b30" stroke="#ffffff" strokeWidth="2" filter="url(#pinShadow)" />
                  <text textAnchor="middle" y="1" dominantBaseline="central" className="text-[12px]">
                    🔥
                  </text>
                </g>
                <text
                  x="220"
                  y="235"
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-[#d70015] tracking-wide"
                >
                  ACTIVE FIRE
                </text>
              </g>
            )}

            {/* Smoke Plumes Overlay */}
            {smokeMinutes > 0 && (
              <g id="smoke-simulation" className="pointer-events-none">
                <circle
                  cx="220"
                  cy="240"
                  r={smokeProps.r}
                  fill="url(#smokePlumeGrad)"
                  opacity={smokeProps.opacity}
                  className="transition-all duration-700 ease-out"
                />
                {smokeMinutes >= 5 && (
                  <circle
                    cx="140"
                    cy="280"
                    r={smokeProps.r * 0.7}
                    fill="url(#smokePlumeGrad)"
                    opacity={smokeProps.opacity * 0.8}
                    className="transition-all duration-700 ease-out"
                  />
                )}
                {smokeMinutes >= 10 && (
                  <circle
                    cx="300"
                    cy="280"
                    r={smokeProps.r * 0.8}
                    fill="url(#smokePlumeGrad)"
                    opacity={smokeProps.opacity * 0.8}
                    className="transition-all duration-700 ease-out"
                  />
                )}
              </g>
            )}
          </g>
        )}

        {/* Active Route Path Layer */}
        {routePoints && routePoints.length > 1 && (
          <g id="active-route" className="pointer-events-none">
            {/* Soft Route Halo / Glow */}
            <path
              d={getPathData(routePoints)}
              fill="none"
              stroke={isEmergencyRoute ? "#34c759" : "#0066cc"}
              strokeWidth="10"
              strokeOpacity="0.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Core Route Polyline */}
            <path
              d={getPathData(routePoints)}
              fill="none"
              stroke={isEmergencyRoute ? "#34c759" : "#0066cc"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Animated Marching Chevrons / Flow Overlay */}
            <path
              d={getPathData(routePoints)}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="6 14"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-route-flow"
            />

            {/* Origin Dot */}
            <circle
              cx={routePoints[0].x}
              cy={routePoints[0].y}
              r="6"
              fill={isEmergencyRoute ? "#34c759" : "#0066cc"}
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Destination Target Pin */}
            <g transform={`translate(${routePoints[routePoints.length - 1].x}, ${routePoints[routePoints.length - 1].y})`}>
              <circle r="9" fill={isEmergencyRoute ? "#34c759" : "#1d1d1f"} stroke="#ffffff" strokeWidth="2.5" filter="url(#pinShadow)" />
              <circle r="4" fill="#ffffff" />
            </g>

            {/* Step-Free Accessibility Badge on Route */}
            {routeIsStepFree && routePoints.length > 2 && (
              <g
                transform={`translate(${routePoints[Math.floor(routePoints.length / 2)].x + 12}, ${routePoints[Math.floor(routePoints.length / 2)].y - 14})`}
              >
                <rect x="0" y="0" width="76" height="20" rx="10" fill="#ffffff" stroke="#0066cc" strokeWidth="1" filter="url(#pinShadow)" />
                <text x="8" y="13" className="text-[9px] font-bold fill-[#0066cc]">
                  ♿ Step-Free
                </text>
              </g>
            )}
          </g>
        )}

        {/* Guardian Child / Ward Position Marker (Milestone 16) */}
        {guardianState?.isPaired && guardianState.childPosition && (
          <g
            id="guardian-ward-marker"
            transform={`translate(${guardianState.childPosition.x}, ${guardianState.childPosition.y})`}
            className="pointer-events-none"
          >
            <circle r="18" fill="#ff9500" fillOpacity="0.2" className="animate-pulse" />
            <circle r="8" fill="#ff9500" stroke="#ffffff" strokeWidth="2" filter="url(#pinShadow)" />
            <rect x="-24" y="-22" width="48" height="15" rx="7.5" fill="#1d1d1f" />
            <text textAnchor="middle" y="-12" className="text-[8px] font-bold fill-white">
              {guardianState.childName}
            </text>
          </g>
        )}

        {/* User Location Dot with Pulsing Uncertainty Halo */}
        <g id="user-location-marker" className="pointer-events-none">
          {/* Animated Pulsing Halo */}
          <circle
            cx={userPosition.x}
            cy={userPosition.y}
            r={userPosition.uncertaintyRadius * 12}
            fill="#0066cc"
            fillOpacity="0.18"
            stroke="#0066cc"
            strokeWidth="1.5"
            strokeOpacity="0.4"
            className="animate-halo"
          />

          {/* Solid Core Dot with Apple Halo Shadow */}
          <circle
            cx={userPosition.x}
            cy={userPosition.y}
            r="8"
            fill="#0066cc"
            stroke="#ffffff"
            strokeWidth="2.5"
            filter="url(#appleHaloShadow)"
          />

          {/* Inner Light Core */}
          <circle cx={userPosition.x} cy={userPosition.y} r="3" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
};
