import React, { useState, useCallback, useEffect, useRef } from "react";
import { NavRail } from "./components/common/NavRail";
import { GoogleSearchBar } from "./components/search/GoogleSearchBar";
import { CategoryFilterChips, CampusCategory } from "./components/search/CategoryFilterChips";
import { GoogleSearchPanel } from "./components/search/GoogleSearchPanel";
import { PositioningStatusBar, PositioningSourceType } from "./components/controls/PositioningStatusBar";
import { GoogleMapControls } from "./components/controls/GoogleMapControls";
import { LayersModal } from "./components/controls/LayersModal";
import { BottomSheet, SheetSnapPoint } from "./components/sheet/BottomSheet";
import { RoutePreviewCard } from "./components/navigation/RoutePreviewCard";
import { TurnByTurnNav } from "./components/navigation/TurnByTurnNav";
import { EmergencyBanner } from "./components/emergency/EmergencyBanner";
import { EmergencySheetContent } from "./components/emergency/EmergencySheetContent";
import { JudgeParameterMenu, ScenarioParams } from "./components/demo/JudgeParameterMenu";
import { CampusMapContainer, CampusMapContainerHandle } from "./components/map/CampusMapContainer";
import { FloorId, MapLayerConfig, UserPositionState, GuardianState } from "./types";
import { HazardOverlay, MobilityProfile, PositionEstimate, RouteResult } from "@routeguard/shared";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom, POI } from "./data/floor2Data";
import {
  calculateRouteTradeOffs,
  calculateEvacuationRoute,
  RouteComparison,
  speakInstruction
} from "./services/routingService";

export const App: React.FC = () => {
  // Map Container Handle for Zoom & Recenter
  const mapHandleRef = useRef<CampusMapContainerHandle>(null);

  // App & Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<"3D" | "2D">("3D");
  const [currentFloor, setCurrentFloor] = useState<FloorId>("floor-2");
  const [snapPoint, setSnapPoint] = useState<SheetSnapPoint>("peek");
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CampusCategory>("All");

  // Scanner & Positioning State
  const [isScannerConnected, setIsScannerConnected] = useState(true);
  const [scannerLabel, setScannerLabel] = useState("BLE · 0.9");
  const [positionSource, setPositionSource] = useState<PositioningSourceType>("BLE");
  const [signalAge, setSignalAge] = useState(1);
  const [apCount, setApCount] = useState(9);

  const [userPos, setUserPos] = useState<UserPositionState>({
    x: 472.5,
    y: 193.75,
    floorId: "floor-2",
    uncertaintyRadius: 2.2,
    nearestPlaceName: "Room 204"
  });

  // Emergency State
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmLocation, setAlarmLocation] = useState("Room 207");
  const [alarmTime, setAlarmTime] = useState("14:32");
  const [smokeMinutes, setSmokeMinutes] = useState<0 | 2 | 5 | 10>(0);
  const [isSOSActive, setIsSOSActive] = useState(false);

  // Routing State
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [activeProfile, setActiveProfile] = useState<MobilityProfile>("recommended");
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Judge Demo & Scenario State
  const [isJudgeMenuOpen, setIsJudgeMenuOpen] = useState(false);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioTimeLeft, setScenarioTimeLeft] = useState(60);
  const [evacuationProgress, setEvacuationProgress] = useState(0);
  const scenarioTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Layers Config
  const [layers, setLayers] = useState<MapLayerConfig>({
    rooms: true,
    labels: true,
    pois: true,
    emergencyEquipment: true,
    hazards: true
  });

  // Guardian State
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
    batteryLevel: 92,
    lastUpdatedSecondsAgo: 2,
    inSafeZone: true,
    geofenceWarning: null
  });

  // Hazard Overlays
  const [hazardOverlays, setHazardOverlays] = useState<HazardOverlay[]>([
    {
      zoneId: "room-207",
      floorId: "floor-2",
      severity: "fire",
      polygon: [
        { x: 757.5, y: 205 },
        { x: 817.5, y: 205 },
        { x: 817.5, y: 280 },
        { x: 757.5, y: 280 }
      ],
      pulsed: true,
      smokeIntensity: 0.85
    }
  ]);

  // Signal age ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSignalAge((prev) => (prev >= 15 ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Native Android positioning bridge support
  useEffect(() => {
    (window as any).onNativePositionUpdate = (pos: PositionEstimate) => {
      setUserPos({
        x: pos.x,
        y: pos.y,
        floorId: "floor-2",
        uncertaintyRadius: pos.uncertaintyRadius || 2.0,
        nearestPlaceName: pos.nearestPlaceName || "Floor 2"
      });
      setSignalAge(0);
    };

    const handleCustomEvent = (e: any) => {
      if (e.detail) {
        setUserPos({
          x: e.detail.x,
          y: e.detail.y,
          floorId: "floor-2",
          uncertaintyRadius: e.detail.uncertaintyRadius || 2.0,
          nearestPlaceName: e.detail.nearestPlaceName || "Floor 2"
        });
        setSignalAge(0);
      }
    };
    window.addEventListener("nativePositionUpdate", handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener("nativePositionUpdate", handleCustomEvent as EventListener);
      delete (window as any).onNativePositionUpdate;
    };
  }, []);

  // Toggle map detail layer
  const toggleLayer = (layer: keyof MapLayerConfig) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Recenter button
  const handleRecenter = () => {
    mapHandleRef.current?.resetView();
  };

  // Select destination and calculate route preview
  const handleSelectDestination = useCallback(
    (poi: POI) => {
      setSelectedPOI(poi);
      setIsSearchPanelOpen(false);

      const startNode = "node-204";
      const endNode = poi.nodeId;
      const blocked = isAlarmActive ? new Set(["node-207", "node-208", "c-208", "c-lift"]) : undefined;

      const comparison = calculateRouteTradeOffs(startNode, endNode, blocked);
      setRouteComparison(comparison);
      setActiveProfile("recommended");
      setActiveRoute(comparison.recommended);
      setIsNavigating(false);
      setSnapPoint("half");

      // Focus room in 3D camera
      const roomId = poi.id.replace("poi-", "");
      mapHandleRef.current?.focusRoom(roomId);
    },
    [isAlarmActive]
  );

  // Category chip filter click
  const handleCategorySelect = (cat: CampusCategory) => {
    setSelectedCategory(cat);
    // If not "All", open search panel to show matching places
    if (cat !== "All") {
      setIsSearchPanelOpen(true);
    }
  };

  // Profile selection (Recommended / Shortest / Step-free)
  const handleSelectProfile = (profile: MobilityProfile) => {
    if (!routeComparison) return;
    setActiveProfile(profile);
    if (profile === "step-free") setActiveRoute(routeComparison.stepFree);
    else if (profile === "shortest") setActiveRoute(routeComparison.shortest);
    else setActiveRoute(routeComparison.recommended);
  };

  // Start Navigation
  const handleStartNavigation = () => {
    setIsNavigating(true);
    setSnapPoint("half");
    speakInstruction(
      `Starting navigation to ${selectedPOI?.name || "destination"}. Follow the illuminated path on your floor plan.`
    );
  };

  // End Navigation
  const handleEndNavigation = () => {
    setIsNavigating(false);
    setSelectedPOI(null);
    setRouteComparison(null);
    setActiveRoute(null);
    setSnapPoint("peek");
  };

  // One-tap Evacuate
  const handleEvacuate = () => {
    setIsAlarmActive(true);
    const blockedNodes = new Set(["node-207", "node-208", "c-208", "c-lift"]);
    const currentUserNode = "node-204";
    const evacRoute = calculateEvacuationRoute(currentUserNode, blockedNodes);

    if (evacRoute.status === "found") {
      const exitPoi: POI = {
        id: "poi-evac-exit",
        name: "Stair NE (Fire Refuge Exit)",
        category: "Emergency Exit",
        nodeId: "exit-west",
        aliases: ["fire exit", "stair ne"]
      };

      setSelectedPOI(exitPoi);
      setActiveProfile("emergency");
      setActiveRoute(evacRoute);
      setIsNavigating(true);
      setSnapPoint("half");

      speakInstruction(
        "Emergency evacuation active. Avoid Room 207 and Corridor B. Proceed directly to Stair NE fire refuge."
      );
    }
  };

  // Dismiss Alarm
  const handleDismissAlarm = () => {
    setIsAlarmActive(false);
    setIsNavigating(false);
    setSelectedPOI(null);
    setActiveRoute(null);
    setSmokeMinutes(0);
    setSnapPoint("peek");
    speakInstruction("Emergency alarm reset. System returned to normal status.");
  };

  // SOS Trigger
  const handleSendSOS = () => {
    setIsSOSActive(true);
    speakInstruction("Emergency SOS alert dispatched. Security team is on the way.");
  };

  // Toggle Scanner Connection
  const handleToggleScanner = () => {
    const nextState = !isScannerConnected;
    setIsScannerConnected(nextState);
    if (nextState) {
      setScannerLabel("BLE · 0.9");
      setPositionSource("BLE");
      setApCount(9);
      setSignalAge(0);
    } else {
      setPositionSource("Manual");
      setScannerLabel("Disconnected");
    }
  };

  // Run Judge Scenario Simulation
  const handleRunScenario = (params: ScenarioParams) => {
    setIsScenarioRunning(true);
    setScenarioTimeLeft(60);
    setEvacuationProgress(0);
    setIsAlarmActive(true);
    setAlarmLocation(`Room ${params.fireRoomId}`);
    setAlarmTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    // Advance smoke & evac % over 60s
    if (scenarioTimerRef.current) clearInterval(scenarioTimerRef.current);

    let seconds = 60;
    scenarioTimerRef.current = setInterval(() => {
      seconds -= 1;
      setScenarioTimeLeft(seconds);
      const progress = Math.min(100, Math.round(((60 - seconds) / 60) * 100));
      setEvacuationProgress(progress);

      // Advance smoke forecast based on elapsed time
      if (seconds === 45) setSmokeMinutes(2);
      else if (seconds === 30) setSmokeMinutes(5);
      else if (seconds === 10) setSmokeMinutes(10);

      if (seconds <= 0) {
        if (scenarioTimerRef.current) clearInterval(scenarioTimerRef.current);
        setIsScenarioRunning(false);
        setEvacuationProgress(100);
        speakInstruction("Evaluation scenario completed. All occupants safely evacuated.");
      }
    }, 1000);

    // Trigger dynamic evacuation rerouting
    handleEvacuate();
  };

  const handleStopScenario = () => {
    if (scenarioTimerRef.current) clearInterval(scenarioTimerRef.current);
    setIsScenarioRunning(false);
  };

  // Room selected from 3D/2D map click
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
      category: "Selected Space",
      nodeId: nodeId,
      aliases: [label]
    });
  };

  // Determine bottom sheet header content
  const renderBottomSheetHeader = () => {
    if (isAlarmActive) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D93025] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#D93025]">
              Evacuation Protocol Active
            </span>
          </div>
          <span className="text-xs text-[#5F6368]">Nearest: Stair NE</span>
        </div>
      );
    }

    if (isNavigating && selectedPOI) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse" />
            <span className="text-xs font-semibold text-[#137333]">Navigating to {selectedPOI.name}</span>
          </div>
          <button onClick={handleEndNavigation} className="text-xs font-medium text-[#5F6368] hover:text-[#202124]">
            Exit
          </button>
        </div>
      );
    }

    if (selectedPOI && routeComparison) {
      return (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">Route Comparison</span>
          <span className="text-xs font-medium text-[#1A73E8]">3 Options Available</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5F6368]">Academic Block 1 · Second Floor</span>
        <span className="text-xs font-medium text-[#1A73E8] cursor-pointer" onClick={() => setIsSearchPanelOpen(true)}>
          Browse All Rooms
        </span>
      </div>
    );
  };

  // Determine bottom sheet body content
  const renderBottomSheetBody = () => {
    if (isAlarmActive) {
      return (
        <EmergencySheetContent
          avoidList={[`${alarmLocation} (Active Hazard)`, "Corridor B (Heavy Smoke)", "Passenger Lifts (Offline)"]}
          nearestExitName="Stair NE (Fire Refuge)"
          nearestExitMeta="28m · 35s walking"
          onStartEvacuation={handleEvacuate}
          onSendSOS={handleSendSOS}
          isSOSActive={isSOSActive}
        />
      );
    }

    if (isNavigating && activeRoute && selectedPOI) {
      return (
        <TurnByTurnNav
          route={activeRoute}
          destinationName={selectedPOI.name}
          onEndNavigation={handleEndNavigation}
        />
      );
    }

    if (selectedPOI && routeComparison) {
      return (
        <RoutePreviewCard
          destinationName={selectedPOI.name}
          categoryLabel={selectedPOI.category}
          comparison={routeComparison}
          activeProfile={activeProfile}
          onSelectProfile={handleSelectProfile}
          onStartNavigation={handleStartNavigation}
          onCancel={handleEndNavigation}
        />
      );
    }

    // Default Peek Content: Quick search shortcuts & recent destinations
    return (
      <div className="space-y-3 pt-2 select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#5F6368] uppercase tracking-wider">Suggested Places</span>
          <button
            onClick={() => setIsSearchPanelOpen(true)}
            className="text-xs font-semibold text-[#1A73E8] hover:underline"
          >
            Search More
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "poi-204", name: "Room 204", desc: "Lecture Hall · North", icon: "school" },
            { id: "poi-219", name: "Room 219", desc: "AI & Robotics Lab", icon: "precision_manufacturing" },
            { id: "poi-wash-nw", name: "Washroom NW", desc: "Male Restroom", icon: "wc" },
            { id: "poi-stair-nw", name: "Stair & Lift NW", desc: "Main Egress Core", icon: "stairs" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                const room = ARCHITECTURAL_ROOMS.find((r) => item.id.includes(r.code) || item.id.includes(r.id));
                if (room) handleSelectRoom(room);
                else handleSelectNode(item.id, item.name);
              }}
              className="p-2.5 rounded-xl border border-[#DADCE0] bg-[#F8F9FA] hover:bg-[#F1F3F4] text-left transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[18px] text-[#1A73E8]">{item.icon}</span>
                <span className="text-xs font-bold text-[#202124] group-hover:text-[#1A73E8] transition-colors truncate">
                  {item.name}
                </span>
              </div>
              <div className="text-[11px] text-[#5F6368] truncate">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`relative w-full h-screen overflow-hidden ${
        isDarkMode ? "bg-[#1a1f3a] text-white" : "bg-[#F8F6F0] text-[#202124]"
      } flex font-sans select-none`}
    >
      {/* 1. Desktop Left Navigation Rail */}
      <NavRail
        onOpenLayers={() => setIsLayersModalOpen(true)}
        onOpenRecents={() => setIsSearchPanelOpen(true)}
        onOpenSaved={() => setIsSearchPanelOpen(true)}
        onTriggerJudgeMenu={() => setIsJudgeMenuOpen(true)}
        onAskRouteGuard={() => setIsSearchPanelOpen(true)}
        isDarkMode={isDarkMode}
      />

      {/* 2. Top Emergency Fire Alert Banner (56px #FF3B30) */}
      <EmergencyBanner
        isAlarmActive={isAlarmActive}
        alarmLocation={alarmLocation}
        timestamp={alarmTime}
        onEvacuate={handleEvacuate}
        onDismissAlarm={handleDismissAlarm}
      />

      {/* 3. Main Full-Bleed Map Canvas Area */}
      <main className="relative flex-1 h-full w-full overflow-hidden">
        {/* Full-Bleed 3D / 2D Map Container */}
        <CampusMapContainer
          ref={mapHandleRef}
          currentFloor={currentFloor}
          layers={layers}
          userPosition={userPos}
          routePoints={activeRoute?.pathPoints}
          activeRoute={activeRoute}
          routeIsStepFree={activeProfile === "step-free"}
          isEmergencyRoute={isAlarmActive}
          hazardOverlays={hazardOverlays}
          smokeMinutes={smokeMinutes}
          guardianState={guardianState}
          onSelectNode={handleSelectNode}
          onSelectRoom={handleSelectRoom}
          viewMode={viewMode}
          categoryFilter={selectedCategory.toLowerCase()}
          theme={isAlarmActive ? "emergency" : isDarkMode ? "dark" : "light"}
        />

        {/* Floating Top Controls (Search Bar, Category Chips, Status Bar) */}
        {!isAlarmActive && (
          <div className="absolute top-3 left-4 right-4 md:left-20 md:right-auto md:w-[480px] z-30 flex flex-col gap-2 pointer-events-auto">
            {/* Floating Google Pill Search Bar */}
            <GoogleSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onFocus={() => setIsSearchPanelOpen(true)}
              isScannerConnected={isScannerConnected}
              scannerLabel={scannerLabel}
              onToggleScanner={handleToggleScanner}
            />

            {/* Category Filter Chips */}
            <CategoryFilterChips
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
            />

            {/* Positioning Status Bar */}
            <div className="w-fit">
              <PositioningStatusBar
                source={positionSource}
                confidence="94% (±2.2m)"
                ageSeconds={signalAge}
                batteryPercent={92}
                apCount={apCount}
                onSelectSource={(s) => setPositionSource(s)}
                onRecenter={handleRecenter}
              />
            </div>

            {/* Expandable Search Drawer Overlay */}
            <GoogleSearchPanel
              isOpen={isSearchPanelOpen}
              query={searchQuery}
              onClose={() => setIsSearchPanelOpen(false)}
              onSelectPOI={handleSelectDestination}
              categoryFilter={selectedCategory}
            />
          </div>
        )}

        {/* Floating Map Controls (Zoom, My Location, Floor Switcher, Layers) */}
        <GoogleMapControls
          currentFloor={currentFloor}
          onSelectFloor={setCurrentFloor}
          onZoomIn={() => mapHandleRef.current?.zoomIn()}
          onZoomOut={() => mapHandleRef.current?.zoomOut()}
          onRecenter={handleRecenter}
          onToggleLayers={() => setIsLayersModalOpen(true)}
          isLocating={true}
        />

        {/* Bottom Sheet UI (80px peek / 50vh half / 90vh full) */}
        <BottomSheet
          snapPoint={snapPoint}
          onSnapChange={setSnapPoint}
          headerContent={renderBottomSheetHeader()}
        >
          {renderBottomSheetBody()}
        </BottomSheet>
      </main>

      {/* Layers Configuration Modal */}
      <LayersModal
        isOpen={isLayersModalOpen}
        onClose={() => setIsLayersModalOpen(false)}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        layers={layers}
        onToggleLayer={toggleLayer}
      />

      {/* Judge Parameter Menu (Admin Demo Trigger) */}
      <JudgeParameterMenu
        isOpen={isJudgeMenuOpen}
        onClose={() => setIsJudgeMenuOpen(false)}
        onRunScenario={handleRunScenario}
        isScenarioRunning={isScenarioRunning}
        scenarioTimeLeft={scenarioTimeLeft}
        evacuationProgress={evacuationProgress}
        onStopScenario={handleStopScenario}
      />
    </div>
  );
};

export default App;
