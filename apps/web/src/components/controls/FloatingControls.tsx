import React, { useState } from "react";
import { Layers, LocateFixed, Eye, Check, Box } from "lucide-react";
import { FloorId, MapLayerConfig } from "../../types";

interface FloatingControlsProps {
  currentFloor: FloorId;
  onSelectFloor: (floor: FloorId) => void;
  layers: MapLayerConfig;
  onToggleLayer: (layer: keyof MapLayerConfig) => void;
  onRecenter: () => void;
  viewMode: "2D" | "3D";
  onToggleViewMode: () => void;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  currentFloor,
  onSelectFloor,
  layers,
  onToggleLayer,
  onRecenter,
  viewMode,
  onToggleViewMode
}) => {
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const floors: { id: FloorId; label: string }[] = [
    { id: "floor-3", label: "3F" },
    { id: "floor-2", label: "2F" },
    { id: "floor-1", label: "1F" }
  ];

  return (
    <div className="fixed right-4 top-32 z-20 flex flex-col items-end gap-2.5 pointer-events-none">
      {/* 2D / 3D Mode Toggle Button */}
      <button
        onClick={onToggleViewMode}
        className={`pointer-events-auto px-2.5 py-1.5 rounded-xl border border-black/10 shadow-sm text-[12px] font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
          viewMode === "3D"
            ? "bg-[#0066cc] text-white shadow-md"
            : "bg-white/90 text-[#1d1d1f] hover:bg-white backdrop-blur-md"
        }`}
        title="Toggle 2D Blueprint / 3D Dollhouse Floorplan"
        aria-label="Toggle 2D or 3D view mode"
      >
        <Box className="w-3.5 h-3.5" />
        <span>{viewMode === "3D" ? "3D Model" : "2D Map"}</span>
      </button>

      {/* Floor Selector (Vertical Capsule) */}
      <div className="pointer-events-auto flex flex-col bg-white/90 backdrop-blur-md rounded-2xl border border-black/8 shadow-sm overflow-hidden p-1 gap-1">
        {floors.map((fl) => {
          const isActive = currentFloor === fl.id;
          return (
            <button
              key={fl.id}
              onClick={() => onSelectFloor(fl.id)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-semibold transition-all active:scale-95 ${
                isActive
                  ? "bg-[#0066cc] text-white shadow-sm"
                  : "text-[#1d1d1f] hover:bg-black/5"
              }`}
              aria-label={`Select ${fl.label}`}
            >
              {fl.label}
            </button>
          );
        })}
      </div>

      {/* Layer Switcher Popover & Button */}
      <div className="pointer-events-auto relative">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className={`w-11 h-11 rounded-full bg-white/90 backdrop-blur-md border border-black/8 shadow-sm flex items-center justify-center text-[#1d1d1f] hover:bg-white active:scale-95 transition-all ${
            showLayerMenu ? "ring-2 ring-[#0066cc]" : ""
          }`}
          title="Toggle Layers"
          aria-label="Map Layers"
        >
          <Layers className="w-5 h-5 text-[#0066cc]" />
        </button>

        {showLayerMenu && (
          <div className="absolute right-0 top-13 w-56 bg-white/95 backdrop-blur-xl border border-black/8 rounded-[18px] shadow-floating p-2 z-40 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-black/5">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#86868b]">
                Map Overlays
              </span>
            </div>
            <div className="flex flex-col py-1">
              {(
                [
                  { key: "rooms", label: "Architectural Rooms" },
                  { key: "labels", label: "Room Numbers" },
                  { key: "pois", label: "Points of Interest" },
                  { key: "emergencyEquipment", label: "Emergency Exits & AED" },
                  { key: "hazards", label: "Fire & Smoke Hazards" }
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => onToggleLayer(item.key)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-[13px] text-[#1d1d1f] hover:bg-black/5 transition-colors text-left"
                >
                  <span className="font-medium">{item.label}</span>
                  {layers[item.key] ? (
                    <span className="w-5 h-5 rounded-full bg-[#0066cc] flex items-center justify-center text-white">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-black/20" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recenter Button (44x44 Apple Circular Button) */}
      <button
        onClick={onRecenter}
        className="pointer-events-auto w-11 h-11 rounded-full bg-white/90 backdrop-blur-md border border-black/8 shadow-sm flex items-center justify-center text-[#1d1d1f] hover:bg-white active:scale-95 transition-all"
        title="Recenter Map"
        aria-label="Recenter on current location"
      >
        <LocateFixed className="w-5 h-5 text-[#0066cc]" />
      </button>
    </div>
  );
};
