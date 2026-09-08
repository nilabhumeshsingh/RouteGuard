import React, { useState, useCallback, useEffect } from "react";
import { HeaderNav } from "./components/common/HeaderNav";
import { FloatingControls } from "./components/controls/FloatingControls";
import { BottomSheet } from "./components/sheet/BottomSheet";
import { CampusMapContainer } from "./components/map/CampusMapContainer";
import { TopSearchBar } from "./components/search/TopSearchBar";
import { SearchSheet } from "./components/search/SearchSheet";
import { RoutePreviewCard } from "./components/navigation/RoutePreviewCard";
import { TurnByTurnNav } from "./components/navigation/TurnByTurnNav";
import { EmergencyBanner } from "./components/emergency/EmergencyBanner";
import { SmokeScrubber } from "./components/emergency/SmokeScrubber";
import { GuardianModal } from "./components/guardian/GuardianModal";
import { AdminDemoToolbar } from "./components/demo/AdminDemoToolbar";
import { FloorId, MapLayerConfig, SnapPoint, UserPositionState, GuardianState } from "./types";
import { HazardOverlay, MobilityProfile, PositionEstimate, RouteResult } from "@routeguard/shared";
import { ArchitecturalRoom, POI } from "./data/floor2Data";
import {
  calculateRouteTradeOffs,
  calculateEvacuationRoute,
  RouteComparison,
  speakInstruction
} from "./services/routingService";

export const App: React.FC = () => {
  const [currentFloor, setCurrentFloor] = useState<FloorId>("floor-2");
  const [snapPoint, setSnapPoint] = useState<SnapPoint>("half");
  const [searchQuery, setSearchQuery] = useState("");
  // Default to 3D Model as requested
  const [viewMode, setViewMode] = useState<"2D" | "3D">("3D");

  const [layers, setLayers] = useState<MapLayerConfig>({
    rooms: true,
    labels: true,
    pois: true,
    emergencyEquipment: true,
    hazards: true
  });

  const [userPos, setUserPos] = useState<UserPositionState>({
    x: 472.5,
    y: 193.75,
    floorId: "floor-2",
    uncertaintyRadius: 2.5,
    nearestPlaceName: "Room 204"
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

  // Guardian State
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [guardianState, setGuardianState] = useState<GuardianState>({
    isPaired: true,
    pairingCode: "839-421",
    childName: "Alex",
    childPosition: {
      x: 337.5,
      y: 351,
      floorId: "floor-2",
      placeName: "Room 219 (AI Lab)"
    },
    batteryLevel: 88,
    lastUpdatedSecondsAgo: 2,
    inSafeZone: true,
    geofenceWarning: null
  });

  const [hazardOverlays, setHazardOverlays] = useState<HazardOverlay[]>([
    {
      zoneId: "room-208",
      floorId: "floor-2",
      severity: "fire",
      polygon: [
        { x: 757.5, y: 205 },
        { x: 817.5, y: 205 },
        { x: 817.5, y: 280 },
        { x: 757.5, y: 280 }
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
    // Block the fire room, adjacent smoke corridor, and ordinary lifts
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
        "Emergency evacuation started. Follow the route to Fire Exit West Ramp. Avoid Corridor 208 and do not use elevators."
      );
    }
  };

  // Start route preview when selecting a destination
  const handleSelectDestination = (poi: POI) => {
    setSelectedPOI(poi);
    const startNode = "node-204";
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

  // Demo Controls
  const handleToggleFire = () => {
    const nextAlarm = !isAlarmActive;
    setIsAlarmActive(nextAlarm);

    // Update guardian geofence status based on alarm
    setGuardianState((prev) => ({
      ...prev,
      geofenceWarning: nextAlarm ? "Active fire alarm in sector (Room 208)" : null
    }));

    if (nextAlarm) {
      setShowSmokeScrubber(true);
      speakInstruction("Attention: Emergency alarm activated for Floor 2.");
    } else {
      setShowSmokeScrubber(false);
    }
  };

  const handleAdvanceSmoke = () => {
    const sequence: (0 | 2 | 5 | 10)[] = [0, 2, 5, 10];
    const currentIndex = sequence.indexOf(smokeMinutes);
    const nextMinutes = sequence[(currentIndex + 1) % sequence.length];
    setSmokeMinutes(nextMinutes);
  };

  const handlePositionUpdate = useCallback((pos: PositionEstimate) => {
    setUserPos({
      x: pos.x,
      y: pos.y,
      floorId: "floor-2",
      uncertaintyRadius: pos.uncertaintyRadius,
      nearestPlaceName: pos.nearestPlaceName || "Floor 2"
    });
  }, []);

  // Listen for native Android scanner updates via JavaScript Bridge
  useEffect(() => {
    (window as any).onNativePositionUpdate = (pos: PositionEstimate) => {
      handlePositionUpdate(pos);
    };

    const handleCustomEvent = (e: any) => {
      if (e.detail) {
        handlePositionUpdate(e.detail);
      }
    };
    window.addEventListener("nativePositionUpdate", handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener("nativePositionUpdate", handleCustomEvent as EventListener);
      delete (window as any).onNativePositionUpdate;
    };
  }, [handlePositionUpdate]);

  const handleToggleStepFreeProfile = () => {
    const nextProfile = activeProfile === "step-free" ? "recommended" : "step-free";
    setActiveProfile(nextProfile);
    if (routeComparison) {
      setActiveRoute(nextProfile === "step-free" ? routeComparison.stepFree : routeComparison.recommended);
    }
  };

  const handleLocateChild = () => {
    setIsGuardianModalOpen(false);
    setUserPos((prev) => ({
      ...prev,
      x: guardianState.childPosition.x,
      y: guardianState.childPosition.y,
      nearestPlaceName: guardianState.childPosition.placeName
    }));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#081018] text-[#eaf2f8] flex flex-col font-sans select-none">
      {/* Sleek Floating Mode Switcher Pill (3D Dollhouse vs 2D Blueprint) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center bg-[#0f1b29]/92 backdrop-blur-md border border-[#40627e]/45 rounded-full p-1 shadow-2xl">
        <button
          onClick={() => setViewMode("3D")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            viewMode === "3D"
              ? "bg-[#4fd1c2] text-[#081018] shadow-md shadow-[#4fd1c2]/30"
              : "text-[#8ea7b8] hover:text-[#eaf2f8]"
          }`}
        >
          <span>🏠</span> 3D Dollhouse
        </button>
        <button
          onClick={() => setViewMode("2D")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            viewMode === "2D"
              ? "bg-[#4fd1c2] text-[#081018] shadow-md shadow-[#4fd1c2]/30"
              : "text-[#8ea7b8] hover:text-[#eaf2f8]"
          }`}
        >
          <span>📐</span> 2D Blueprint
        </button>
      </div>

      {/* When in 2D Mode: Render full navigation chrome, search, and drawer */}
      {viewMode === "2D" && (
        <>
          {/* Apple Header Nav */}
          <HeaderNav
            currentFloor={currentFloor}
            isAlarmActive={isAlarmActive}
            onOpenGuardian={() => setIsGuardianModalOpen(true)}
            onOpenEmergency={() => handleToggleFire()}
          />

          {/* Persistent Emergency Fire Banner */}
          <EmergencyBanner
            isAlarmActive={isAlarmActive}
            alarmLocation="Room 208 (Computer & IoT Lab)"
            onEvacuate={handleEvacuate}
            onOpenSmokeScrubber={() => setShowSmokeScrubber(!showSmokeScrubber)}
          />

          {/* Floating Top Search Bar */}
          <TopSearchBar
            onSelectDestination={handleSelectDestination}
            selectedPOI={selectedPOI}
            onClearDestination={handleEndNavigation}
            isAlarmActive={isAlarmActive}
          />

          {/* Admin Demo Simulation Toolbar */}
          <AdminDemoToolbar
            isAlarmActive={isAlarmActive}
            onToggleFire={handleToggleFire}
            smokeMinutes={smokeMinutes}
            onAdvanceSmoke={handleAdvanceSmoke}
            onPositionUpdate={handlePositionUpdate}
            activeProfile={activeProfile}
            onToggleStepFree={handleToggleStepFreeProfile}
          />
        </>
      )}

      {/* Main Map Viewport */}
      <main className={`relative flex-1 w-full h-full overflow-hidden ${viewMode === "2D" ? (isAlarmActive ? "pt-28 pb-20" : "pt-11 pb-20") : ""}`}>
        <CampusMapContainer
          currentFloor={currentFloor}
          layers={layers}
          userPosition={userPos}
          routePoints={activeRoute?.pathPoints || null}
          routeIsStepFree={activeProfile === "step-free" || activeProfile === "emergency"}
          isEmergencyRoute={isAlarmActive}
          hazardOverlays={hazardOverlays}
          smokeMinutes={smokeMinutes}
          guardianState={guardianState}
          onSelectRoom={handleSelectRoom}
          onSelectNode={handleSelectNode}
          viewMode={viewMode}
        />

        {/* Floating Smoke Scrubber Card (in 2D mode) */}
        {viewMode === "2D" && showSmokeScrubber && (
          <div className="absolute left-4 top-16 z-20 w-80 max-w-[calc(100vw-32px)]">
            <SmokeScrubber
              smokeMinutes={smokeMinutes}
              onSelectMinutes={(m) => setSmokeMinutes(m)}
              onClose={() => setShowSmokeScrubber(false)}
            />
          </div>
        )}

        {/* Floating Action Controls (in 2D mode) */}
        {viewMode === "2D" && (
          <FloatingControls
            currentFloor={currentFloor}
            onSelectFloor={(floor) => setCurrentFloor(floor)}
            layers={layers}
            onToggleLayer={toggleLayer}
            onRecenter={handleRecenter}
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode((v) => (v === "2D" ? "3D" : "2D"))}
          />
        )}
      </main>

      {/* Bottom Sheet Drawer (in 2D mode) */}
      {viewMode === "2D" && (
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
      )}

      {/* Guardian Dashboard Modal */}
      <GuardianModal
        isOpen={isGuardianModalOpen}
        onClose={() => setIsGuardianModalOpen(false)}
        guardianState={guardianState}
        onTogglePairing={() =>
          setGuardianState((prev) => ({ ...prev, isPaired: !prev.isPaired }))
        }
        onLocateChild={handleLocateChild}
      />
    </div>
  );
};

export default App;
