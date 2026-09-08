import React, { useState } from "react";

export type PositioningSourceType = "BLE" | "GPS" | "Replay" | "Manual";

interface PositioningStatusBarProps {
  source: PositioningSourceType;
  confidence: string; // e.g. "94% (±2.5m)"
  ageSeconds: number;
  batteryPercent?: number;
  apCount?: number;
  onSelectSource?: (source: PositioningSourceType) => void;
  onRecenter?: () => void;
}

const SOURCE_CONFIG: Record<
  PositioningSourceType,
  { label: string; icon: string; color: string; bg: string }
> = {
  BLE: {
    label: "BLE Scanner",
    icon: "bluetooth_searching",
    color: "#0F9D58",
    bg: "#E6F4EA"
  },
  GPS: {
    label: "Indoor GPS",
    icon: "my_location",
    color: "#1A73E8",
    bg: "#E8F0FE"
  },
  Replay: {
    label: "Demo Replay",
    icon: "replay",
    color: "#EA8600",
    bg: "#FEF7E0"
  },
  Manual: {
    label: "Manual Pin",
    icon: "push_pin",
    color: "#9C27B0",
    bg: "#F3E8FD"
  }
};

export const PositioningStatusBar: React.FC<PositioningStatusBarProps> = ({
  source,
  confidence,
  ageSeconds,
  batteryPercent = 88,
  apCount = 8,
  onSelectSource,
  onRecenter
}) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = SOURCE_CONFIG[source];

  return (
    <div className="relative">
      <div
        onClick={() => setExpanded(!expanded)}
        className="h-[36px] px-3 bg-white rounded-[8px] border border-[#DADCE0] shadow-[0_1px_3px_rgba(60,64,67,0.12)] flex items-center gap-2 cursor-pointer hover:bg-[#F8F9FA] transition-all select-none text-xs text-[#5F6368]"
        title="Click to view sensor telemetry"
      >
        {/* Source Icon with Color */}
        <span
          className="material-symbols-outlined text-[17px] shrink-0"
          style={{ color: cfg.color }}
        >
          {cfg.icon}
        </span>

        {/* Source Label */}
        <span className="font-semibold text-[#202124]">{cfg.label}</span>

        {source === "Replay" && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
            DEMO
          </span>
        )}

        <span className="text-[#DADCE0]">·</span>

        {/* Confidence */}
        <span className="font-medium text-[#202124]">{confidence}</span>

        <span className="text-[#DADCE0]">·</span>

        {/* Age */}
        <span>{ageSeconds}s ago</span>

        <span className="material-symbols-outlined text-[14px] text-[#5F6368] ml-auto">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </div>

      {/* Expanded Telemetry Popover */}
      {expanded && (
        <div className="absolute top-[42px] left-0 w-72 bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-[#DADCE0] p-3.5 z-40 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#E8EAED] mb-2.5">
            <span className="font-semibold text-[#202124]">Positioning Diagnostics</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-[#5F6368] hover:text-[#202124]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Signal AP Count</span>
              <span className="font-medium text-[#202124]">{apCount} Access Points</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Phone Battery</span>
              <span className="font-medium text-[#202124]">{batteryPercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Scan Freshness</span>
              <span className="font-medium text-[#137333]">Live (Every 1.2s)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E8EAED]">
            <div className="text-[11px] font-medium text-[#5F6368] mb-1.5">Switch Positioning Feed</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(SOURCE_CONFIG) as PositioningSourceType[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSelectSource?.(s);
                    setExpanded(false);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-left text-[11px] font-medium transition-colors ${
                    source === s
                      ? "bg-[#E8F0FE] text-[#1967D2] font-semibold"
                      : "bg-[#F8F9FA] text-[#5F6368] hover:bg-[#F1F3F4]"
                  }`}
                >
                  {SOURCE_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {onRecenter && (
            <button
              onClick={() => {
                onRecenter();
                setExpanded(false);
              }}
              className="w-full mt-3 py-1.5 px-3 rounded-lg bg-[#1A73E8] text-white font-medium hover:bg-[#1557B0] transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">my_location</span>
              <span>Recenter My Dot</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
