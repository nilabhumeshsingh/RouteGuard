import React from "react";

interface EmergencySheetContentProps {
  avoidList: string[];
  nearestExitName?: string;
  nearestExitMeta?: string;
  onStartEvacuation: () => void;
  onSendSOS: () => void;
  isSOSActive?: boolean;
}

export const EmergencySheetContent: React.FC<EmergencySheetContentProps> = ({
  avoidList = ["Room 207 (Incident Origin)", "Corridor B (Heavy Smoke)", "Passenger Elevators (Offline)"],
  nearestExitName = "Stair NE",
  nearestExitMeta = "28m · 35s walking",
  onStartEvacuation,
  onSendSOS,
  isSOSActive = false
}) => {
  return (
    <div className="space-y-4 pt-1 select-none">
      {/* Nearest Safe Egress Callout */}
      <div className="p-4 rounded-xl bg-[#FEEBE9] border border-[#FF8A80] text-[#B71C1C]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D32F2F]">
            Recommended Escape Path
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-[#D32F2F] border border-[#FF8A80]">
            Active
          </span>
        </div>
        <div className="text-lg font-bold text-[#B71C1C]">
          Nearest exit: {nearestExitName}
        </div>
        <div className="text-xs font-medium text-[#C62828] mt-0.5 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">directions_walk</span>
          <span>{nearestExitMeta}</span>
        </div>
      </div>

      {/* Avoid Hazards List */}
      <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#DADCE0]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#202124] mb-2">
          <span className="material-symbols-outlined text-[18px] text-[#D93025]">dangerous</span>
          <span>Compromised Zones — DO NOT ENTER:</span>
        </div>
        <ul className="space-y-1.5 text-xs text-[#5F6368]">
          {avoidList.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D93025]" />
              <span className="font-medium text-[#202124]">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Emergency Guidance Message */}
      <div className="text-xs text-[#5F6368] leading-relaxed px-1">
        Stay low if smoke begins entering the corridor. Proceed along the illuminated evacuation path toward {nearestExitName}. Campus security and emergency services have been dispatched.
      </div>

      {/* Action Buttons: Follow Route & Large Red SOS Button */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onStartEvacuation}
          className="w-full h-[48px] rounded-[8px] bg-[#D93025] hover:bg-[#B71C1C] text-white font-semibold text-[15px] shadow-sm flex items-center justify-center gap-2 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">directions_run</span>
          <span>Follow Evacuation Path</span>
        </button>

        {/* Large SOS Button (Bottom-fixed or prominent) */}
        <button
          onClick={onSendSOS}
          className={`w-full h-[52px] rounded-[10px] font-bold text-[16px] shadow-md transition-all flex items-center justify-center gap-2 ${
            isSOSActive
              ? "bg-[#202124] text-[#34A853] border-2 border-[#34A853]"
              : "bg-[#B71C1C] hover:bg-[#8E0000] text-white animate-pulse"
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">sos</span>
          <span>{isSOSActive ? "SOS DISPATCHED · RESCUE TEAM NOTIFIED" : "EMERGENCY SOS · BROADCAST LOCATION"}</span>
        </button>
      </div>
    </div>
  );
};
