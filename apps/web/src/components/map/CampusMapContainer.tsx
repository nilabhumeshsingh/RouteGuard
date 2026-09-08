import React, { useRef, useEffect } from "react";
import { Indoor2DMap } from "./Indoor2DAdapter";
import { FloorId, MapLayerConfig, UserPositionState, GuardianState } from "../../types";
import { HazardOverlay, RoutePoint } from "@routeguard/shared";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom } from "../../data/floor2Data";

interface CampusMapContainerProps {
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
  viewMode?: "2D" | "3D";
}

export const CampusMapContainer: React.FC<CampusMapContainerProps> = ({
  currentFloor,
  layers,
  userPosition,
  routePoints,
  routeIsStepFree,
  isEmergencyRoute,
  hazardOverlays,
  smokeMinutes = 0,
  guardianState,
  onSelectNode,
  onSelectRoom,
  viewMode = "3D"
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 1. Send live user position to 3D Three.js renderer
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "SET_POSITION",
          position: userPosition
        },
        "*"
      );
    }
  }, [userPosition, viewMode]);

  // 2. Send active route overlay
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current?.contentWindow) {
      if (routePoints && routePoints.length > 1) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "SET_ROUTE",
            route: routePoints
          },
          "*"
        );
      } else {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "CLEAR_ROUTE"
          },
          "*"
        );
      }
    }
  }, [routePoints, viewMode]);

  // 3. Send hazard overlays
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current?.contentWindow) {
      if (hazardOverlays && hazardOverlays.length > 0) {
        hazardOverlays.forEach((h) => {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "SET_HAZARD",
              hazard: {
                roomId: h.zoneId === "room-208" ? "208" : h.zoneId,
                severity: h.severity,
                pulsed: h.pulsed
              }
            },
            "*"
          );
        });
      }
    }
  }, [hazardOverlays, viewMode]);

  // 4. Send smoke simulation forecast
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "SET_SMOKE_FORECAST",
          forecast: { minutes: smokeMinutes }
        },
        "*"
      );
    }
  }, [smokeMinutes, viewMode]);

  // 5. Send child/ward avatar
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current?.contentWindow) {
      if (guardianState?.isPaired && guardianState.childPosition) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "SET_USERS",
            users: [
              {
                id: "child-alex",
                name: guardianState.childName,
                position: guardianState.childPosition
              }
            ]
          },
          "*"
        );
      }
    }
  }, [guardianState, viewMode]);

  // 6. Send emergency / normal mode
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "SET_MODE",
          mode: isEmergencyRoute ? "emergency" : "normal"
        },
        "*"
      );
    }
  }, [isEmergencyRoute, viewMode]);

  // 7. Receive room selection events from 3D renderer
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "ROOM_SELECTED") {
        const roomId = e.data.roomId;
        const room = ARCHITECTURAL_ROOMS.find(
          (r) => r.id === roomId || r.code === roomId || r.id === `room-${roomId}`
        );
        if (room && onSelectRoom) {
          onSelectRoom(room);
        }
        if (onSelectNode) {
          onSelectNode(room?.nodeId || `node-${roomId}`, e.data.label || room?.name || roomId);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSelectRoom, onSelectNode]);

  if (viewMode === "3D") {
    return (
      <div className="relative w-full h-full overflow-hidden bg-[#081018]">
        <iframe
          ref={iframeRef}
          src="/standalone_floorplan.html"
          title="3D Architectural Dollhouse Floorplan"
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  if (currentFloor !== "floor-2") {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-[#081018]">
        <div className="text-center p-6 apple-card max-w-sm border border-[#40627e]/40 bg-[#0f1b29]/90 text-[#eaf2f8]">
          <div className="w-12 h-12 rounded-2xl bg-[#4fd1c2]/20 text-[#4fd1c2] flex items-center justify-center mx-auto mb-3 font-semibold text-base">
            {currentFloor === "floor-1" ? "1F" : "3F"}
          </div>
          <h3 className="text-[17px] font-semibold text-[#eaf2f8] mb-1">
            {currentFloor === "floor-1" ? "First Floor (Ground)" : "Third Floor (Upper Labs)"}
          </h3>
          <p className="text-[13px] text-[#8ea7b8] leading-relaxed mb-4">
            Floor blueprint survey in progress. Switch to Floor 2 for real-time indoor Wi-Fi navigation and emergency routes.
          </p>
          <div className="inline-block px-3 py-1 rounded-full bg-[#4fd1c2]/10 text-[12px] font-medium text-[#4fd1c2] border border-[#4fd1c2]/30">
            Floor 2 Active Survey
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
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
};
