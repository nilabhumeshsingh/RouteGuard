import React, { useState } from "react";
import { HeaderNav } from "./components/common/HeaderNav";
import { FloatingControls } from "./components/controls/FloatingControls";
import { BottomSheet } from "./components/sheet/BottomSheet";
import { CampusMapContainer } from "./components/map/CampusMapContainer";
import { FloorId, MapLayerConfig, SnapPoint, UserPositionState } from "./types";
import { Search, MapPin, Sparkles } from "lucide-react";
import { HazardOverlay, RoutePoint } from "@routeguard/shared";
import { ArchitecturalRoom } from "./data/floor2Data";

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

  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [smokeMinutes, setSmokeMinutes] = useState<0 | 2 | 5 | 10>(0);

  // Sample route preview points
  const [activeRoutePoints, setActiveRoutePoints] = useState<RoutePoint[] | null>([
    { x: 120, y: 220, floorId: "floor-2" },
    { x: 120, y: 280, floorId: "floor-2" },
    { x: 80, y: 280, floorId: "floor-2" }
  ]);

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

  const handleSelectRoom = (room: ArchitecturalRoom) => {
    setSearchQuery(room.name);
    if (snapPoint === "collapsed") setSnapPoint("half");
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f] flex flex-col font-sans select-none">
      {/* Apple Header Nav */}
      <HeaderNav
        currentFloor={currentFloor}
        isAlarmActive={isAlarmActive}
        onOpenGuardian={() => {}}
        onOpenEmergency={() => setIsAlarmActive(!isAlarmActive)}
      />

      {/* Main Map Viewport */}
      <main className="relative flex-1 w-full h-full pt-11 pb-20 overflow-hidden">
        <CampusMapContainer
          currentFloor={currentFloor}
          layers={layers}
          userPosition={userPos}
          routePoints={activeRoutePoints}
          routeIsStepFree={true}
          isEmergencyRoute={false}
          hazardOverlays={hazardOverlays}
          smokeMinutes={smokeMinutes}
          onSelectRoom={handleSelectRoom}
        />

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
        <div className="space-y-4">
          {/* Search Bar Input (Apple Pill) */}
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[#86868b] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (snapPoint === "collapsed") setSnapPoint("half");
              }}
              placeholder="Search rooms, labs, exits, restrooms..."
              className="w-full h-11 pl-10 pr-4 rounded-full bg-[#e3e3e8]/50 focus:bg-white text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] border border-transparent focus:border-[#0071e3] focus:outline-none transition-all"
            />
          </div>

          {/* Category Quick Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["All", "Restrooms", "Exits", "Labs", "Faculty", "Classrooms"].map((cat, idx) => (
              <button
                key={cat}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all active:scale-95 whitespace-nowrap ${
                  idx === 0
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-white border border-black/8 text-[#1d1d1f] hover:bg-black/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Utility Card */}
          <div className="apple-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {userPos.nearestPlaceName}
                </h4>
                <p className="text-[12px] text-[#86868b]">
                  Academic Block 1 • Floor 2 • ±{userPos.uncertaintyRadius}m precision
                </p>
              </div>
            </div>
            <button
              onClick={() => setSnapPoint("expanded")}
              className="apple-pill-btn text-[13px] px-4 py-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

export default App;
