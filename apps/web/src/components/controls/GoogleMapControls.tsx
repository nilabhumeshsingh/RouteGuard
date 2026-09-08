import React, { useState } from "react";
import { FloorId } from "../../types";

interface GoogleMapControlsProps {
  currentFloor: FloorId;
  onSelectFloor: (floor: FloorId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onToggleLayers: () => void;
  isLocating?: boolean;
}

export const GoogleMapControls: React.FC<GoogleMapControlsProps> = ({
  currentFloor,
  onSelectFloor,
  onZoomIn,
  onZoomOut,
  onRecenter,
  onToggleLayers,
  isLocating = true
}) => {
  const [floorMenuOpen, setFloorMenuOpen] = useState(false);

  const floorLabels: Record<FloorId, string> = {
    "floor-1": "Floor 1",
    "floor-2": "Floor 2",
    "floor-3": "Floor 3"
  };

  return (
    <>
      {/* Bottom-Left: Layers Button & Scale Bar */}
      <div className="absolute left-4 bottom-24 md:bottom-6 z-20 flex flex-col gap-2.5 items-start select-none">
        {/* Layers Button (40x40 white square, 8px radius) */}
        <button
          onClick={onToggleLayers}
          className="w-10 h-10 bg-white rounded-lg gmap-shadow-btn flex items-center justify-center text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#F8F9FA] transition-all"
          title="Map Layers (3D / 2D / Hazards)"
        >
          <span className="material-symbols-outlined text-[22px]">layers</span>
        </button>

        {/* Metric Scale Bar */}
        <div className="bg-white/85 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm border border-[#DADCE0] flex items-center gap-1 text-[10px] font-mono text-[#5F6368]">
          <div className="w-10 h-[2px] bg-[#5F6368] relative">
            <span className="absolute left-0 -top-1 w-[1px] h-2 bg-[#5F6368]" />
            <span className="absolute right-0 -top-1 w-[1px] h-2 bg-[#5F6368]" />
          </div>
          <span>10 m</span>
        </div>
      </div>

      {/* Bottom-Right Controls: Floor Switcher, My Location, Zoom +/- */}
      <div className="absolute right-4 bottom-24 md:bottom-6 z-20 flex flex-col items-end gap-2.5 select-none">
        {/* Floor Switcher Pill (Floor 2 ▾) */}
        <div className="relative">
          <button
            onClick={() => setFloorMenuOpen(!floorMenuOpen)}
            className="h-9 px-3 bg-white rounded-full gmap-shadow-btn flex items-center gap-1.5 text-xs font-semibold text-[#202124] hover:bg-[#F8F9FA] transition-all border border-[#DADCE0]"
          >
            <span>{floorLabels[currentFloor]}</span>
            <span className="material-symbols-outlined text-[16px] text-[#5F6368]">
              {floorMenuOpen ? "arrow_drop_up" : "arrow_drop_down"}
            </span>
          </button>

          {floorMenuOpen && (
            <div className="absolute bottom-11 right-0 w-28 bg-white rounded-xl shadow-lg border border-[#DADCE0] p-1.5 flex flex-col gap-1 z-30">
              {(["floor-3", "floor-2", "floor-1"] as FloorId[]).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    onSelectFloor(f);
                    setFloorMenuOpen(false);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium text-left transition-colors ${
                    currentFloor === f
                      ? "bg-[#E8F0FE] text-[#1967D2] font-bold"
                      : "text-[#5F6368] hover:bg-[#F8F9FA] hover:text-[#202124]"
                  }`}
                >
                  {floorLabels[f]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* My Location Button (40x40 white square, 8px radius) */}
        <button
          onClick={onRecenter}
          className={`w-10 h-10 bg-white rounded-lg gmap-shadow-btn flex items-center justify-center transition-all ${
            isLocating
              ? "text-[#1A73E8] hover:bg-[#E8F0FE]"
              : "text-[#5F6368] hover:text-[#202124] hover:bg-[#F8F9FA]"
          }`}
          title="Recenter to my location"
        >
          <span className="material-symbols-outlined text-[20px]">my_location</span>
        </button>

        {/* Zoom Controls (+ / - stacked 40x40 white squares) */}
        <div className="flex flex-col bg-white rounded-lg gmap-shadow-btn overflow-hidden border border-[#DADCE0]">
          <button
            onClick={onZoomIn}
            className="w-10 h-10 flex items-center justify-center text-[#5F6368] hover:text-[#202124] hover:bg-[#F8F9FA] transition-colors"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <div className="w-full h-[1px] bg-[#E8EAED]" />
          <button
            onClick={onZoomOut}
            className="w-10 h-10 flex items-center justify-center text-[#5F6368] hover:text-[#202124] hover:bg-[#F8F9FA] transition-colors"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </button>
        </div>
      </div>
    </>
  );
};
