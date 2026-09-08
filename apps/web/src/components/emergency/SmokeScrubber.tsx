import React from "react";
import { Wind, AlertCircle, Clock, Info, X } from "lucide-react";

interface SmokeScrubberProps {
  smokeMinutes: 0 | 2 | 5 | 10;
  onSelectMinutes: (min: 0 | 2 | 5 | 10) => void;
  onClose?: () => void;
}

export const SmokeScrubber: React.FC<SmokeScrubberProps> = ({
  smokeMinutes,
  onSelectMinutes,
  onClose
}) => {
  const steps: { min: 0 | 2 | 5 | 10; label: string; impact: string; visibility: string }[] = [
    {
      min: 0,
      label: "Current (0m)",
      impact: "Fire contained to Room 208 IoT Lab.",
      visibility: "Corridor visibility 100%"
    },
    {
      min: 2,
      label: "+2 min",
      impact: "Light smoke plume venting into Corridor Hall 208.",
      visibility: "Corridor visibility ~8 meters"
    },
    {
      min: 5,
      label: "+5 min",
      impact: "Dense smoke spread to Corridor 208 & 206. West ramp priority.",
      visibility: "Visibility < 3 meters in Zone B"
    },
    {
      min: 10,
      label: "+10 min",
      impact: "Heavy smoke dispersion reaching central lobby. Evacuate immediately.",
      visibility: "Zero visibility near Lab 208"
    }
  ];

  const currentStep = steps.find((s) => s.min === smokeMinutes) || steps[0];

  return (
    <div className="apple-card p-4 space-y-3.5 border-black/10 bg-white/95 backdrop-blur-xl shadow-floating select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-[#1d1d1f]">
            <Wind className="w-4 h-4 text-[#86868b]" />
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-[#1d1d1f] flex items-center gap-1.5">
              <span>Smoke Dispersion Scrubber</span>
            </h4>
            <p className="text-[11px] text-[#86868b]">
              Compartment airflow forecast model
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Timeline Scrubber Buttons */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#e3e3e8]/70 rounded-2xl">
        {steps.map((step) => {
          const isSelected = smokeMinutes === step.min;
          return (
            <button
              key={step.min}
              onClick={() => onSelectMinutes(step.min)}
              className={`py-2 px-1 rounded-xl text-center transition-all ${
                isSelected
                  ? "bg-[#1d1d1f] text-white font-bold shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f] font-medium"
              } active:scale-95`}
            >
              <div className="text-[12px]">{step.label}</div>
            </button>
          );
        })}
      </div>

      {/* Impact Status Card */}
      <div className="p-3 rounded-xl bg-black/5 space-y-1">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#1d1d1f]">
          <span>Forecast: {currentStep.label}</span>
          <span className="text-[#d70015] font-bold">{currentStep.visibility}</span>
        </div>
        <p className="text-[12px] text-[#6e6e73] leading-relaxed">
          {currentStep.impact}
        </p>
      </div>

      {/* Simulated Projection Disclaimer */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#ff9500]/10 border border-[#ff9500]/20 text-[11px] text-[#8a5300] leading-normal">
        <Info className="w-4 h-4 shrink-0 text-[#ff9500] mt-0.5" />
        <span>
          Simulated projection based on compartment airflow dynamics. Verify real-world exit conditions.
        </span>
      </div>
    </div>
  );
};
