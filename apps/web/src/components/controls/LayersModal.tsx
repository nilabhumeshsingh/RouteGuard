import React from "react";
import { MapLayerConfig, MapViewMode } from "../../types";

interface LayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: MapViewMode;
  onSetViewMode: (mode: MapViewMode) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  layers: MapLayerConfig;
  onToggleLayer: (layer: keyof MapLayerConfig) => void;
}

export const LayersModal: React.FC<LayersModalProps> = ({
  isOpen,
  onClose,
  viewMode,
  onSetViewMode,
  isDarkMode,
  onToggleDarkMode,
  layers,
  onToggleLayer
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in select-none">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-[#DADCE0] p-4 text-[#202124]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] mb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-[#202124]">
            <span className="material-symbols-outlined text-[20px] text-[#1A73E8]">layers</span>
            <span>Map Layers & Details</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Map Rendering Engine Switcher */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider mb-2">
            Map Rendering Engine
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onSetViewMode("3D")}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                viewMode === "3D"
                  ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1967D2] font-semibold shadow-sm"
                  : "bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">view_in_ar</span>
              <span className="text-[11px]">3D Dollhouse</span>
            </button>

            <button
              onClick={() => onSetViewMode("2D")}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                viewMode === "2D"
                  ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1967D2] font-semibold shadow-sm"
                  : "bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">map</span>
              <span className="text-[11px]">2D Blueprint</span>
            </button>

            <button
              onClick={() => onSetViewMode("Google")}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                viewMode === "Google"
                  ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1967D2] font-semibold shadow-sm"
                  : "bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"
              }`}
            >
              <span className="material-symbols-outlined text-[22px] text-[#34A853]">satellite_alt</span>
              <span className="text-[11px]">Google Maps</span>
            </button>
          </div>
        </div>

        {/* Appearance / Theme */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider mb-2">
            Canvas Theme
          </div>
          <button
            onClick={onToggleDarkMode}
            className="w-full p-2.5 rounded-xl border border-[#DADCE0] bg-[#F8F9FA] hover:bg-[#F1F3F4] flex items-center justify-between text-xs font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#5F6368]">
                {isDarkMode ? "dark_mode" : "light_mode"}
              </span>
              <span>{isDarkMode ? "Dark Navy Canvas" : "Warm Cream Canvas (#F8F6F0)"}</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isDarkMode ? "bg-[#1a1f3a] text-white" : "bg-[#E8F0FE] text-[#1967D2]"
            }`}>
              {isDarkMode ? "DARK" : "LIGHT"}
            </span>
          </button>
        </div>

        {/* Layer Checkboxes */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider mb-1">
            Display Details
          </div>

          {[
            { key: "labels" as const, label: "Room & Space Labels", icon: "label" },
            { key: "emergencyEquipment" as const, label: "AED & Fire Extinguishers", icon: "medical_services" },
            { key: "hazards" as const, label: "Live Smoke & Hazard Overlays", icon: "warning" },
            { key: "pois" as const, label: "Services & Amenities", icon: "place" }
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F8F9FA] cursor-pointer text-xs"
            >
              <span className="flex items-center gap-2 text-[#202124]">
                <span className="material-symbols-outlined text-[18px] text-[#5F6368]">{item.icon}</span>
                <span>{item.label}</span>
              </span>
              <input
                type="checkbox"
                checked={layers[item.key]}
                onChange={() => onToggleLayer(item.key)}
                className="w-4 h-4 rounded accent-[#1A73E8]"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
