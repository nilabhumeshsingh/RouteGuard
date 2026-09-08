import React from "react";
import { RouteResult, MobilityProfile } from "@routeguard/shared";
import { RouteComparison } from "../../services/routingService";

interface RoutePreviewCardProps {
  destinationName: string;
  categoryLabel?: string;
  comparison: RouteComparison;
  activeProfile: MobilityProfile;
  onSelectProfile: (profile: MobilityProfile) => void;
  onStartNavigation: () => void;
  onCancel: () => void;
}

export const RoutePreviewCard: React.FC<RoutePreviewCardProps> = ({
  destinationName,
  categoryLabel = "Campus Space",
  comparison,
  activeProfile,
  onSelectProfile,
  onStartNavigation,
  onCancel
}) => {
  const currentRoute: RouteResult =
    activeProfile === "step-free"
      ? comparison.stepFree
      : activeProfile === "shortest"
      ? comparison.shortest
      : comparison.recommended;

  const profiles: {
    id: MobilityProfile;
    label: string;
    route: RouteResult;
    icon: string;
    badge: string;
    tradeoff: string;
  }[] = [
    {
      id: "recommended",
      label: "Recommended",
      route: comparison.recommended,
      icon: "verified",
      badge: "Safest Path",
      tradeoff: "Standard path with wide corridors & emergency signage"
    },
    {
      id: "shortest",
      label: "Shortest",
      route: comparison.shortest,
      icon: "bolt",
      badge: "Fastest ETA",
      tradeoff: "Direct line cutting through central lightwell crossover"
    },
    {
      id: "step-free",
      label: "Step-free",
      route: comparison.stepFree,
      icon: "accessible",
      badge: "♿ Ramp & Lift",
      tradeoff: "100% accessible; routes strictly through flat ramps & elevators"
    }
  ];

  const durationMin = Math.ceil((currentRoute.estimatedTimeSeconds || 60) / 60);
  const distanceMeters = Math.round(currentRoute.totalDistanceMeters || 45);

  return (
    <div className="space-y-3.5 pt-1">
      {/* Destination Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1967D2]">
              {categoryLabel}
            </span>
            <span className="text-xs text-[#5F6368]">Floor 2</span>
          </div>
          <h2 className="text-lg font-semibold text-[#202124] tracking-tight">{destinationName}</h2>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-full text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124] transition-colors"
          title="Close preview"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* 3 Profile Tabs (Recommended / Shortest / Step-free) */}
      <div className="grid grid-cols-3 gap-2">
        {profiles.map((p) => {
          const isSelected = activeProfile === p.id;
          const mins = Math.ceil((p.route.estimatedTimeSeconds || 60) / 60);
          const dist = Math.round(p.route.totalDistanceMeters || 40);

          return (
            <button
              key={p.id}
              onClick={() => onSelectProfile(p.id)}
              className={`p-2.5 rounded-xl text-left transition-all border ${
                isSelected
                  ? "bg-[#E8F0FE] border-[#1A73E8] shadow-sm"
                  : "bg-[#F8F9FA] border-[#DADCE0] hover:bg-[#F1F3F4]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    isSelected ? "text-[#1A73E8]" : "text-[#5F6368]"
                  }`}
                >
                  {p.icon}
                </span>
                <span className="text-[10px] font-bold text-[#1967D2]">{mins} min</span>
              </div>
              <div className={`text-xs font-semibold ${isSelected ? "text-[#1967D2]" : "text-[#202124]"}`}>
                {p.label}
              </div>
              <div className="text-[11px] text-[#5F6368]">{dist}m</div>
            </button>
          );
        })}
      </div>

      {/* Trade-off Explanation Card */}
      <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#DADCE0] flex items-start gap-2.5 text-xs text-[#5F6368]">
        <span className="material-symbols-outlined text-[18px] text-[#1A73E8] shrink-0 mt-0.5">
          info
        </span>
        <div className="flex-1">
          <span className="font-semibold text-[#202124]">
            {profiles.find((p) => p.id === activeProfile)?.badge}:{" "}
          </span>
          {profiles.find((p) => p.id === activeProfile)?.tradeoff}
        </div>
      </div>

      {/* ETA & Distance Summary */}
      <div className="flex items-baseline justify-between px-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#137333]">{durationMin} min</span>
          <span className="text-sm text-[#5F6368]">({distanceMeters} m)</span>
        </div>
        <div className="text-xs text-[#5F6368]">Walking indoors</div>
      </div>

      {/* Start Navigation Action Button (Google Blue #1A73E8, 48px tall, 8px radius) */}
      <button
        onClick={onStartNavigation}
        className="w-full h-[48px] rounded-[8px] bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white font-medium text-[15px] shadow-[0_1px_3px_rgba(60,64,67,0.3)] transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">navigation</span>
        <span>Start Navigation</span>
      </button>
    </div>
  );
};
