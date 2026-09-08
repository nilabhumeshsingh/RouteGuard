import React, { useRef, useEffect } from "react";
import { Indoor2DMap } from "./Indoor2DAdapter";
import { FloorId, MapLayerConfig, UserPositionState, GuardianState } from "../../types";
import { HazardOverlay, RoutePoint } from "@routeguard/shared";
import { ArchitecturalRoom } from "../../data/floor2Data";

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
  smokeMinutes,
  guardianState,
  onSelectNode,
  onSelectRoom,
  viewMode = "3D"
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync live position to 3D Three.js scene via postMessage
  useEffect(() => {
    if (viewMode === "3D" && iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "nativePositionUpdate",
          payload: userPosition
        },
        "*"
      );
    }
  }, [userPosition, viewMode]);

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
