import React, { useState } from "react";
import { HeaderNav } from "./components/common/HeaderNav";
import { FloatingControls } from "./components/controls/FloatingControls";
import { BottomSheet } from "./components/sheet/BottomSheet";
import { CampusMapContainer } from "./components/map/CampusMapContainer";
import { SearchSheet } from "./components/search/SearchSheet";
import { RoutePreviewCard } from "./components/navigation/RoutePreviewCard";
import { TurnByTurnNav } from "./components/navigation/TurnByTurnNav";
import { EmergencyBanner } from "./components/emergency/EmergencyBanner";
import { SmokeScrubber } from "./components/emergency/SmokeScrubber";
import { FloorId, MapLayerConfig, SnapPoint, UserPositionState } from "./types";
import { HazardOverlay, MobilityProfile, RoutePoint, RouteResult } from "@routeguard/shared";
import { ArchitecturalRoom, POI } from "./data/floor2Data";
import { calculateRouteTradeOffs, calculateEvacuationRoute, RouteComparison, speakInstruction } from "./services/routingService";

export const App: React.FC = () => {
  const [currentFloor, setCurrentFloor] = useState<FloorId>("floor-2");
  const [snapPoint, setSnapPoint] = useState<SnapPoint>("half");
  const [searchQuery, setSearchQuery] = useState("");

  const [layers, setLayers] = useState<MapLayerConfig>({
    rooms: true,
    labels: true,
    pois: true,
    emergencyEquipment: true,
    hazards: true
  });

  const [userPos, setUserPos] = useState<UserPositionState>({
    x: 120,
    y: 220,
    floorId: "floor-2",
    uncertaintyRadius: 2.5,
    nearestPlaceName: "AB1 Room 204"
  });

  // Emergency & Hazard State
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [smokeMinutes, setSmokeMinutes] = useState<0 | 2 | 5 | 10>(0);
  const [showSmokeScrubber, setShowSmokeScrubber] = useState(false);

  // Routing State
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [activeProfile, setActiveProfile] = useState<MobilityProfile>("recommended");
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const [hazardOverlays, setHazardOverlays] = useState<HazardOverlay[]>([
    {
      zoneId: "room-208",
      floorId: "floor-2",
      severity: "fire",
      polygon: [
        { x: 185, y: 170 },
        { x: 255, y: 170 },
        { x: 255, y: 255 },
        { x: 185, y: 255 }
      ],
      pulsed: true,
      smokeIntensity: 0.8
    }
  ]);

  const toggleLayer = (layer: keyof MapLayerConfig) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleRecenter = () => {
    setUserPos((prev) => ({ ...prev }));
  };

  // One-Tap Evacuation Handler
  const handleEvacuate = () => {
    // Block the fire room, adjacent smoke corridor, and lifts
    const blockedNodes = new Set(["node-208", "c-208", "c-lift"]);
    const currentUserNode = "node-204";

    const evacRoute = calculateEvacuationRoute(currentUserNode, blockedNodes);

    if (evacRoute.status === "found") {
      const exitPoi: POI = {
        id: "poi-evac-exit",
        name: "Fire Exit West (Ramp)",
        category: "Emergency Exit",
        nodeId: "exit-west",
        aliases: ["fire exit", "west ramp"]
      };

      setSelectedPOI(exitPoi);
      setActiveProfile("emergency");
      setActiveRoute(evacRoute);
      setIsNavigating(true);
      setSnapPoint("half");

      speakInstruction(
        "Emergency evacuation started. Follow the green route to Fire Exit West Ramp. Avoid Corridor 208 and do not use elevators."
      );
    }
  };

  // Start route preview when selecting a destination
  const handleSelectDestination = (poi: POI) => {
    setSelectedPOI(poi);
    const startNode = "node-204"; // Current user location node
    const endNode = poi.nodeId;

    const blocked = isAlarmActive ? new Set(["node-208", "c-208", "c-lift"]) : undefined;
    const comparison = calculateRouteTradeOffs(startNode, endNode, blocked);
    setRouteComparison(comparison);
    setActiveProfile("recommended");
    setActiveRoute(comparison.recommended);
    setIsNavigating(false);
    setSnapPoint("half");
  };

  const handleSelectProfile = (profile: MobilityProfile) => {
    if (!routeComparison) return;
    setActiveProfile(profile);
    if (profile === "step-free") setActiveRoute(routeComparison.stepFree);
    else if (profile === "shortest") setActiveRoute(routeComparison.shortest);
    else setActiveRoute(routeComparison.recommended);
  };

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setSnapPoint("half");
  };

  const handleEndNavigation = () => {
    setIsNavigating(false);
    setSelectedPOI(null);
    setRouteComparison(null);
    setActiveRoute(null);
    setSnapPoint("half");
  };

  const handleSelectRoom = (room: ArchitecturalRoom) => {
    handleSelectDestination({
      id: `poi-${room.code}`,
      name: room.name,
      category: room.category,
      nodeId: room.nodeId,
      aliases: [room.code, room.name]
    });
  };

  const handleSelectNode = (nodeId: string, label: string) => {
    handleSelectDestination({
      id: `poi-${nodeId}`,
      name: label,
      category: "Selected Node",
      nodeId: nodeId,
      aliases: [label]
    });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f] flex flex-col font-sans select-none">
      {/* Apple Header Nav */}
      <HeaderNav
        currentFloor={currentFloor}
        isAlarmActive={isAlarmActive}
        onOpenGuardian={() => {}}
        onOpenEmergency={() => {
          const next = !isAlarmActive;
          setIsAlarmActive(next);
          if (next) {
            setShowSmokeScrubber(true);
            speakInstruction("Attention: Emergency alarm activated for Floor 2.");
          }
        }}
      />

      {/* Persistent Emergency Fire Banner */}
      <EmergencyBanner
        isAlarmActive={isAlarmActive}
        alarmLocation="Room 208 (Computer & IoT Lab)"
        onEvacuate={handleEvacuate}
        onOpenSmokeScrubber={() => setShowSmokeScrubber(!showSmokeScrubber)}
      />

      {/* Main Map Viewport */}
      <main
        className={`relative flex-1 w-full h-full pb-20 overflow-hidden transition-all duration-200 ${
          isAlarmActive ? "pt-28" : "pt-11"
        }`}
      >
        <CampusMapContainer
          currentFloor={currentFloor}
          layers={layers}
          userPosition={userPos}
          routePoints={activeRoute?.pathPoints || null}
          routeIsStepFree={activeProfile === "step-free" || activeProfile === "emergency"}
          isEmergencyRoute={isAlarmActive}
          hazardOverlays={hazardOverlays}
          smokeMinutes={smokeMinutes}
          onSelectRoom={handleSelectRoom}
          onSelectNode={handleSelectNode}
        />

        {/* Floating Smoke Scrubber Card */}
        {showSmokeScrubber && (
          <div className="absolute left-4 top-4 z-20 w-80 max-w-[calc(100vw-32px)]">
            <SmokeScrubber
              smokeMinutes={smokeMinutes}
              onSelectMinutes={(m) => setSmokeMinutes(m)}
              onClose={() => setShowSmokeScrubber(false)}
            />
          </div>
        )}

        {/* Floating Action Controls */}
        <FloatingControls
          currentFloor={currentFloor}
          onSelectFloor={(floor) => setCurrentFloor(floor)}
          layers={layers}
          onToggleLayer={toggleLayer}
          onRecenter={handleRecenter}
        />
      </main>

      {/* Bottom Sheet Drawer */}
      <BottomSheet snapPoint={snapPoint} onSnapChange={setSnapPoint}>
        {isNavigating && activeRoute && selectedPOI ? (
          <TurnByTurnNav
            route={activeRoute}
            destinationName={selectedPOI.name}
            onEndNavigation={handleEndNavigation}
          />
        ) : routeComparison && selectedPOI ? (
          <RoutePreviewCard
            destinationName={selectedPOI.name}
            comparison={routeComparison}
            activeProfile={activeProfile}
            onSelectProfile={handleSelectProfile}
            onStartNavigation={handleStartNavigation}
            onCancel={handleEndNavigation}
          />
        ) : (
          <SearchSheet
            onSelectDestination={handleSelectDestination}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </BottomSheet>
    </div>
  );
};

export default App;
