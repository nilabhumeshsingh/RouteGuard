import React from "react";
import { RouteResult, MobilityProfile } from "@routeguard/shared";
import { RouteComparison } from "../../services/routingService";
import { Navigation, Clock, ShieldCheck, ArrowRight, X, Volume2 } from "lucide-react";

interface RoutePreviewCardProps {
  destinationName: string;
  comparison: RouteComparison;
  activeProfile: MobilityProfile;
  onSelectProfile: (profile: MobilityProfile) => void;
  onStartNavigation: () => void;
  onCancel: () => void;
}

export const RoutePreviewCard: React.FC<RoutePreviewCardProps> = ({
  destinationName,
  comparison,
  activeProfile,
  onSelectProfile,
  onStartNavigation,
  onCancel
}) => {
  const currentRoute =
    activeProfile === "step-free"
      ? comparison.stepFree
      : activeProfile === "shortest"
      ? comparison.shortest
      : comparison.recommended;

  const profiles: {
    id: MobilityProfile;
    label: string;
    route: RouteResult;
    badge: string;
    description: string;
  }[] = [
    {
      id: "recommended",
      label: "Recommended",
      route: comparison.recommended,
      badge: "Balanced & Well-Lit",
      description: "Safest path via well-monitored corridors"
    },
    {
      id: "step-free",
      label: "Step-Free",
      route: comparison.stepFree,
      badge: "♿ 100% Ramp & Lift",
      description: "Avoids all stairs, steps, and heavy thresholds"
    },
    {
      id: "shortest",
      label: "Shortest",
      route: comparison.shortest,
      badge: "Fastest Distance",
      description: "Shortest physical corridor distance"
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
            Route Preview
          </span>
          <h3 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight">
            {destinationName}
          </h3>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] active:scale-95 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile Selector Tabs (Apple Segmented Style) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#e3e3e8]/70 rounded-2xl">
        {profiles.map((p) => {
          const isSelected = activeProfile === p.id;
          const isAvailable = p.route.status === "found";
          return (
            <button
              key={p.id}
              disabled={!isAvailable}
              onClick={() => onSelectProfile(p.id)}
              className={`py-2 px-2 rounded-xl text-center transition-all ${
                isSelected
                  ? "bg-white text-[#1d1d1f] font-semibold shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] font-medium"
              } ${!isAvailable ? "opacity-40 cursor-not-allowed" : "active:scale-95"}`}
            >
              <div className="text-[13px]">{p.label}</div>
              <div className="text-[11px] opacity-75">
                {isAvailable ? `${p.route.totalDistanceMeters}m` : "N/A"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Route Summary & Trade-off Badges */}
      <div className="apple-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[16px] font-bold text-[#1d1d1f]">
                {Math.ceil(currentRoute.estimatedTimeSeconds / 60)} min
                <span className="text-[13px] font-normal text-[#86868b] ml-1.5">
                  ({currentRoute.totalDistanceMeters} meters)
                </span>
              </div>
              <div className="text-[12px] text-[#0066cc] font-medium">
                {profiles.find((p) => p.id === activeProfile)?.badge}
              </div>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-[#34c759]/15 text-[#248a3d] text-[11px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Hazard Free</span>
          </div>
        </div>

        {/* Trade-off Explanation Notice */}
        <div className="p-2.5 rounded-xl bg-black/5 text-[12px] text-[#6e6e73] leading-relaxed">
          {comparison.explanation}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onStartNavigation}
          disabled={currentRoute.status !== "found"}
          className="flex-1 apple-pill-btn py-3 text-[15px] font-semibold flex items-center justify-center gap-2 bg-[#0066cc] hover:bg-[#0071e3] active:scale-95 transition-all shadow-sm"
        >
          <Navigation className="w-4 h-4" />
          <span>Start Voice Guidance</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
