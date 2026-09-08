import React, { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Indoor3DAdapter, Indoor3DAdapterRef, UserMarker } from "../../maps/Indoor3DAdapter";
import { Indoor2DMap } from "./Indoor2DAdapter";
import { GoogleMapAdapter, GoogleMapAdapterRef } from "./GoogleMapAdapter";
import { FloorId, MapLayerConfig, UserPositionState, GuardianState, MapViewMode } from "../../types";
import { HazardOverlay, PositionEstimate, RoutePoint, RouteResult } from "@routeguard/shared";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom } from "../../data/floor2Data";

export interface CampusMapContainerProps {
  currentFloor: FloorId;
  layers: MapLayerConfig;
  userPosition: UserPositionState;
  routePoints?: RoutePoint[] | null;
  activeRoute?: RouteResult | null;
  routeIsStepFree?: boolean;
  isEmergencyRoute?: boolean;
  hazardOverlays?: HazardOverlay[];
  smokeMinutes?: number;
  guardianState?: GuardianState | null;
  onSelectNode?: (nodeId: string, label: string) => void;
  onSelectRoom?: (room: ArchitecturalRoom) => void;
  onMapClick?: (pos: { x: number; y: number }) => void;
  viewMode?: MapViewMode;
  onSwitchViewMode?: (mode: MapViewMode) => void;
  isNightSafety?: boolean;
  isTrafficActive?: boolean;
  googleMapType?: "satellite" | "hybrid" | "roadmap";
  onToggleGoogleMapType?: (type: "satellite" | "hybrid" | "roadmap") => void;
  onToggleTraffic?: (active: boolean) => void;
  categoryFilter?: string;
  theme?: "light" | "dark" | "emergency";
}

export interface CampusMapContainerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusRoom: (roomId: string) => void;
}

export const CampusMapContainer = forwardRef<CampusMapContainerHandle, CampusMapContainerProps>(
  (
    {
      currentFloor,
      layers,
      userPosition,
      routePoints,
      activeRoute,
      routeIsStepFree,
      isEmergencyRoute,
      hazardOverlays = [],
      smokeMinutes = 0,
      guardianState,
      onSelectNode,
      onSelectRoom,
      onMapClick,
      viewMode = "3D",
      onSwitchViewMode,
      isNightSafety,
      isTrafficActive,
      googleMapType,
      onToggleGoogleMapType,
      onToggleTraffic,
      categoryFilter = "all",
      theme = "light"
    },
    ref
  ) => {
    const adapter3dRef = useRef<Indoor3DAdapterRef>(null);
    const adapterGoogleRef = useRef<GoogleMapAdapterRef>(null);
    const [use2DFallback, setUse2DFallback] = useState(false);

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (viewMode === "Google") {
          adapterGoogleRef.current?.zoomIn();
        } else {
          adapter3dRef.current?.zoomIn();
        }
      },
      zoomOut: () => {
        if (viewMode === "Google") {
          adapterGoogleRef.current?.zoomOut();
        } else {
          adapter3dRef.current?.zoomOut();
        }
      },
      resetView: () => {
        if (viewMode === "Google") {
          adapterGoogleRef.current?.resetView();
        } else {
          adapter3dRef.current?.resetView();
        }
      },
      focusRoom: (roomId: string) => {
        if (viewMode === "Google") {
          adapterGoogleRef.current?.focusRoom(roomId);
        } else {
          adapter3dRef.current?.focusRoom(roomId);
        }
      }
    }));

    // Convert UserPositionState to PositionEstimate
    const positionEstimate: PositionEstimate & { label?: string; roomId?: string } = {
      x: userPosition.x,
      y: userPosition.y,
      floorId: userPosition.floorId,
      uncertaintyRadius: userPosition.uncertaintyRadius,
      nearestPlaceName: userPosition.nearestPlaceName,
      label: userPosition.nearestPlaceName,
      roomId: userPosition.nearestPlaceName,
      source: "wifi",
      confidence: 0.94,
      quality: "high",
      timestamp: Date.now()
    };

    // Construct user markers for 3D engine (e.g. child alex)
    const userMarkers: UserMarker[] = [];
    if (guardianState?.isPaired && guardianState.childPosition) {
      userMarkers.push({
        id: "child-alex",
        name: guardianState.childName,
        label: guardianState.childName,
        position: {
          x: guardianState.childPosition.x,
          y: guardianState.childPosition.y,
          floorId: guardianState.childPosition.floorId
        },
        role: "child"
      });
    }

    const handleRoomSelected = (roomId: string) => {
      const room = ARCHITECTURAL_ROOMS.find(
        (r) => r.id === roomId || r.code === roomId || r.id === `room-${roomId}`
      );
      if (room && onSelectRoom) {
        onSelectRoom(room);
      }
      if (onSelectNode) {
        onSelectNode(room?.nodeId || `node-${roomId}`, room?.name || `Room ${roomId}`);
      }
    };

    const handleMapClick = (pos: { x: number; y: number }) => {
      onMapClick?.(pos);
    };

    // If Floor 1 or Floor 3 selected (demo placeholder)
    if (currentFloor !== "floor-2") {
      return (
        <div className="relative w-full h-full flex items-center justify-center bg-[#F8F6F0]">
          <div className="text-center p-6 bg-white rounded-2xl shadow-md border border-[#DADCE0] max-w-sm text-[#202124]">
            <div className="w-12 h-12 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center mx-auto mb-3 font-bold text-base">
              {currentFloor === "floor-1" ? "1F" : "3F"}
            </div>
            <h3 className="font-semibold text-base mb-1">
              {currentFloor === "floor-1" ? "Ground & First Floor" : "Third Floor Complex"}
            </h3>
            <p className="text-xs text-[#5F6368] leading-relaxed mb-4">
              Academic Block 1 survey data is currently focused on the Second Floor (2F) Core Wing for evaluation.
            </p>
          </div>
        </div>
      );
    }

    // Render Google Maps Satellite / Aerial Platform
    if (viewMode === "Google") {
      return (
        <div className="relative w-full h-full overflow-hidden bg-[#1F2421]">
          <GoogleMapAdapter
            ref={adapterGoogleRef}
            currentFloor={currentFloor}
            userPosition={userPosition}
            routePoints={routePoints}
            activeRoute={activeRoute}
            isEmergencyRoute={isEmergencyRoute}
            isNightSafety={isNightSafety}
            isTrafficActive={isTrafficActive}
            mapType={googleMapType}
            onToggleMapType={onToggleGoogleMapType}
            onToggleTraffic={onToggleTraffic}
            hazardOverlays={hazardOverlays}
            guardianState={guardianState}
            onSelectRoom={onSelectRoom}
            onSelectNode={onSelectNode}
            onSwitchViewMode={onSwitchViewMode}
          />
        </div>
      );
    }

    // Render 3D if viewMode === "3D" and fallback has not been triggered
    if (viewMode === "3D" && !use2DFallback) {
      return (
        <div className="relative w-full h-full overflow-hidden bg-[#F8F6F0]">
          <Indoor3DAdapter
            ref={adapter3dRef}
            position={positionEstimate}
            route={activeRoute || null}
            hazards={hazardOverlays}
            users={userMarkers}
            mode={isEmergencyRoute ? "emergency" : "normal"}
            categoryFilter={categoryFilter}
            theme={theme}
            smokeMinutes={smokeMinutes}
            onRoomSelect={handleRoomSelected}
            onMapClick={handleMapClick}
            onError={() => {
              console.warn("3D WebGL timed out or failed; falling back to 2D Blueprint");
              setUse2DFallback(true);
            }}
          />
        </div>
      );
    }

    // Render 2D Vectorized Blueprint
    return (
      <div className="relative w-full h-full overflow-hidden bg-[#F8F6F0]">
        <Indoor2DMap
          currentFloor={currentFloor}
          layers={layers}
          userPosition={userPosition}
          routePoints={routePoints}
          routeIsStepFree={routeIsStepFree}
          isEmergencyRoute={isEmergencyRoute}
          hazardOverlays={hazardOverlays}
          smokeMinutes={smokeMinutes}
          guardianState={guardianState}
          onSelectNode={onSelectNode}
          onSelectRoom={onSelectRoom}
        />
      </div>
    );
  }
);

CampusMapContainer.displayName = "CampusMapContainer";
