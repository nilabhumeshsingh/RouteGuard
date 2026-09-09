import React from "react";
import { Shield, ShieldAlert, Users, Bell } from "lucide-react";
import { FloorId } from "../../types";

interface HeaderNavProps {
  currentFloor: FloorId;
  isAlarmActive: boolean;
  onOpenGuardian: () => void;
  onOpenEmergency: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentFloor,
  isAlarmActive,
  onOpenGuardian,
  onOpenEmergency
}) => {
  const floorLabels: Record<FloorId, string> = {
    "floor-1": "1F • Ground",
    "floor-2": "2F • Academic Block 1",
    "floor-3": "3F • Upper Labs"
  };

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-11 px-4 flex items-center justify-between frosted-chrome border-b border-black/5">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#0066cc] flex items-center justify-center text-white shadow-sm">
          <Shield className="w-4 h-4" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[15px] tracking-tight text-[#1d1d1f]">Raah</span>
          <span className="text-[12px] text-[#86868b] font-normal hidden sm:inline">Indoor Navigation</span>
        </div>
      </div>

      {/* Center Floor Indicator */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[12px] font-medium text-[#1d1d1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse"></span>
        <span>{floorLabels[currentFloor]}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {isAlarmActive ? (
          <button
            onClick={onOpenEmergency}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff3b30] text-white text-[12px] font-medium active:scale-95 transition-all shadow-sm animate-pulse"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ALARM ACTIVE</span>
          </button>
        ) : (
          <button
            onClick={onOpenEmergency}
            title="Safety & Alarms"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 active:scale-95 transition-all"
          >
            <Bell className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenGuardian}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-black/10 text-[12px] font-medium text-[#1d1d1f] hover:bg-white active:scale-95 transition-all shadow-sm"
        >
          <Users className="w-3.5 h-3.5 text-[#0066cc]" />
          <span>Guardian</span>
        </button>
      </div>
    </header>
  );
};
