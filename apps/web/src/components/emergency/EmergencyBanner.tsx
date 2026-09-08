import React from "react";

interface EmergencyBannerProps {
  isAlarmActive: boolean;
  alarmLocation?: string;
  timestamp?: string;
  onEvacuate: () => void;
  onDismissAlarm?: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  isAlarmActive,
  alarmLocation = "Room 207",
  timestamp = "14:32",
  onEvacuate,
  onDismissAlarm
}) => {
  if (!isAlarmActive) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 h-[56px] bg-[#FF3B30] text-white shadow-md flex items-center justify-between px-4 select-none animate-in slide-in-from-top duration-200">
      {/* Alert Title */}
      <div className="flex items-center gap-2 font-medium text-[15px] tracking-wide">
        <span className="text-lg">⚠️</span>
        <span className="font-bold tracking-tight">FIRE ALERT</span>
        <span>·</span>
        <span>{alarmLocation}</span>
        <span>·</span>
        <span className="opacity-90">{timestamp}</span>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onEvacuate}
          className="h-9 px-4 rounded-full bg-white text-[#FF3B30] font-bold text-xs hover:bg-[#F8F9FA] active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">emergency_share</span>
          <span>Safe Evacuation</span>
        </button>

        {onDismissAlarm && (
          <button
            onClick={onDismissAlarm}
            className="h-9 w-9 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors"
            title="Silence / Reset Alarm"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
};
