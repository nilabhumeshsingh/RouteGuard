import React from "react";
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
  onSelectRoom
}) => {
  if (currentFloor !== "floor-2") {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center p-6 apple-card max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-3 font-semibold text-base">
            {currentFloor === "floor-1" ? "1F" : "3F"}
          </div>
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-1">
            {currentFloor === "floor-1" ? "First Floor (Ground)" : "Third Floor (Upper Labs)"}
          </h3>
          <p className="text-[13px] text-[#86868b] leading-relaxed mb-4">
            Floor blueprint survey in progress. Switch to Floor 2 for real-time indoor Wi-Fi navigation and emergency routes.
          </p>
          <div className="inline-block px-3 py-1 rounded-full bg-black/5 text-[12px] font-medium text-[#1d1d1f]">
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
