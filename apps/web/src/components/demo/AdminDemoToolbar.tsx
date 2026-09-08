import React, { useState, useEffect, useRef } from "react";
import { Flame, Wind, Play, Pause, RotateCcw, Accessibility, Sliders, ChevronDown, ChevronUp } from "lucide-react";
import { ReplayWalkProvider } from "@routeguard/positioning";
import { MobilityProfile, PositionEstimate } from "@routeguard/shared";

interface AdminDemoToolbarProps {
  isAlarmActive: boolean;
  onToggleFire: () => void;
  smokeMinutes: 0 | 2 | 5 | 10;
  onAdvanceSmoke: () => void;
  onPositionUpdate: (pos: PositionEstimate) => void;
  activeProfile: MobilityProfile;
  onToggleStepFree: () => void;
}

export const AdminDemoToolbar: React.FC<AdminDemoToolbarProps> = ({
  isAlarmActive,
  onToggleFire,
  smokeMinutes,
  onAdvanceSmoke,
  onPositionUpdate,
  activeProfile,
  onToggleStepFree
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlayingWalk, setIsPlayingWalk] = useState(false);
  const replayProviderRef = useRef<ReplayWalkProvider>(new ReplayWalkProvider());
  const walkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Play synthetic walk along Corridor waypoints
  useEffect(() => {
    if (isPlayingWalk) {
      walkTimerRef.current = setInterval(() => {
        const nextPos = replayProviderRef.current.getNextEstimate();
        onPositionUpdate(nextPos);
      }, 2500);
    } else {
      if (walkTimerRef.current) {
        clearInterval(walkTimerRef.current);
        walkTimerRef.current = null;
      }
    }

    return () => {
      if (walkTimerRef.current) {
        clearInterval(walkTimerRef.current);
      }
    };
  }, [isPlayingWalk, onPositionUpdate]);

  const handleResetWalk = () => {
    setIsPlayingWalk(false);
    replayProviderRef.current.reset();
    const startPos = replayProviderRef.current.getNextEstimate();
    onPositionUpdate(startPos);
  };

  return (
    <div className="fixed left-4 top-14 z-20 select-none">
      {/* Mini Toggle Pill */}
      <div className="flex items-center gap-1.5 p-1 bg-white/90 backdrop-blur-md rounded-full border border-black/8 shadow-sm">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/5 active:scale-95 transition-all"
        >
          <Sliders className="w-3.5 h-3.5 text-[#0066cc]" />
          <span>Demo Controls</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Control Palette */}
      {isExpanded && (
        <div className="mt-2 w-72 bg-white/95 backdrop-blur-xl border border-black/8 rounded-[20px] shadow-floating p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-1 flex items-center justify-between border-b border-black/5 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
              Interactive Simulation
            </span>
          </div>

          {/* 1. Fire Simulation Trigger */}
          <button
            onClick={onToggleFire}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95 ${
              isAlarmActive
                ? "bg-[#ff3b30] text-white shadow-sm"
                : "bg-black/5 text-[#1d1d1f] hover:bg-black/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <Flame className="w-4 h-4" />
              <span>{isAlarmActive ? "Clear Fire Alarm" : "Trigger Fire (Room 208)"}</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">
              {isAlarmActive ? "ACTIVE" : "OFF"}
            </span>
          </button>

          {/* 2. Smoke Model Advancement */}
          <button
            onClick={onAdvanceSmoke}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-semibold bg-black/5 text-[#1d1d1f] hover:bg-black/10 transition-all active:scale-95"
          >
            <span className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-[#86868b]" />
              <span>Advance Smoke Model</span>
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/10">
              +{smokeMinutes}m
            </span>
          </button>

          {/* 3. Synthetic Walk Replay along Corridor */}
          <div className="p-2 rounded-xl bg-black/5 space-y-1.5">
            <div className="flex items-center justify-between text-[12px] font-semibold text-[#1d1d1f]">
              <span>Synthetic Replay Walk</span>
              <span className="text-[11px] text-[#0066cc]">Corridor Path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsPlayingWalk(!isPlayingWalk)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                  isPlayingWalk
                    ? "bg-[#ff9500] text-white"
                    : "bg-[#0066cc] text-white"
                }`}
              >
                {isPlayingWalk ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Walk</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Play Walk</span>
                  </>
                )}
              </button>

              <button
                onClick={handleResetWalk}
                title="Reset Replay"
                className="w-8 h-8 rounded-lg bg-white border border-black/10 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4. Toggle Step-Free Accessibility Profile */}
          <button
            onClick={onToggleStepFree}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95 ${
              activeProfile === "step-free"
                ? "bg-[#0066cc] text-white shadow-sm"
                : "bg-black/5 text-[#1d1d1f] hover:bg-black/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <Accessibility className="w-4 h-4" />
              <span>Step-Free Profile</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">
              {activeProfile === "step-free" ? "ENABLED" : "STANDARD"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
