import React from "react";
import { Flame, ShieldAlert, ArrowRight, AlertTriangle } from "lucide-react";

interface EmergencyBannerProps {
  isAlarmActive: boolean;
  alarmLocation: string;
  onEvacuate: () => void;
  onOpenSmokeScrubber: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  isAlarmActive,
  alarmLocation,
  onEvacuate,
  onOpenSmokeScrubber
}) => {
  if (!isAlarmActive) return null;

  return (
    <div className="fixed top-11 inset-x-0 z-30 bg-[#d70015] text-white shadow-lg border-b border-white/20 select-none animate-in slide-in-from-top duration-200">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left Fire Alert Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-pulse">
            <Flame className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-white text-[#d70015]">
                FIRE EMERGENCY
              </span>
              <span className="text-[13px] font-bold text-white tracking-tight">
                {alarmLocation}
              </span>
            </div>
            <p className="text-[12px] text-white/90 font-medium">
              Corridor 208 compromised. Elevators offline. Follow emergency guidance.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenSmokeScrubber}
            className="px-3.5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-[13px] font-semibold text-white active:scale-95 transition-all flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-300" />
            <span>Smoke Forecast</span>
          </button>

          <button
            onClick={onEvacuate}
            className="flex-1 sm:flex-initial px-5 py-2 rounded-full bg-white hover:bg-[#f5f5f7] text-[#d70015] text-[13px] font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Evacuate Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
