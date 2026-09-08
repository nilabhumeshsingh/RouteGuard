import React, { useState } from "react";
import { HeaderNav } from "./components/common/HeaderNav";
import { FloatingControls } from "./components/controls/FloatingControls";
import { BottomSheet } from "./components/sheet/BottomSheet";
import { FloorId, MapLayerConfig, SnapPoint, UserPositionState } from "./types";
import { Search, Compass, MapPin, Sparkles } from "lucide-react";

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

  const toggleLayer = (layer: keyof MapLayerConfig) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleRecenter = () => {
    // Recenter triggered
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

      {/* Map Surface Viewport Canvas */}
      <main className="relative flex-1 w-full h-full pt-11 pb-20 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[#f5f5f7] flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-black/5 flex items-center justify-center mx-auto mb-4">
              <Compass className="w-8 h-8 text-[#0066cc]" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f] mb-1">
              CampusSafe Interactive Map
            </h2>
            <p className="text-[14px] text-[#86868b] leading-relaxed mb-4">
              PWA layout initialized with SF Pro typography, #F5F5F7 parchment canvas, and frosted glass controls.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/5 text-[13px] text-[#1d1d1f] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#34c759]" />
              <span>Location: {userPos.nearestPlaceName} (2F)</span>
            </div>
          </div>
        </div>

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
                  Academic Block 1 • Floor 2 • ±2.5m precision
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
