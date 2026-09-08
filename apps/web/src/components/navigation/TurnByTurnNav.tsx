import React, { useState, useEffect } from "react";
import { RouteResult, RouteSegment } from "@routeguard/shared";
import { speakInstruction, triggerHapticFeedback } from "../../services/routingService";
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  DoorOpen,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  ChevronLeft,
  Flag,
  Activity
} from "lucide-react";

interface TurnByTurnNavProps {
  route: RouteResult;
  destinationName: string;
  onEndNavigation: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export const TurnByTurnNav: React.FC<TurnByTurnNavProps> = ({
  route,
  destinationName,
  onEndNavigation,
  onStepChange
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const segments = route.segments;
  const currentSegment: RouteSegment | undefined = segments[currentStepIndex];

  // Announce step change via voice and tactile vibration
  useEffect(() => {
    if (!currentSegment) return;

    if (isVoiceEnabled) {
      speakInstruction(currentSegment.instruction);
    }
    triggerHapticFeedback([120, 60, 120]);
    onStepChange?.(currentStepIndex);
  }, [currentStepIndex, isVoiceEnabled]);

  const handleNextStep = () => {
    if (currentStepIndex < segments.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Arrived
      if (isVoiceEnabled) {
        speakInstruction(`You have arrived at ${destinationName}`);
      }
      triggerHapticFeedback([250]);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const getTurnIcon = (instruction: string, edgeType: string) => {
    const lower = instruction.toLowerCase();
    if (lower.includes("left")) return <CornerUpLeft className="w-8 h-8 text-white" />;
    if (lower.includes("right")) return <CornerUpRight className="w-8 h-8 text-white" />;
    if (lower.includes("enter") || edgeType === "door") return <DoorOpen className="w-8 h-8 text-white" />;
    if (lower.includes("ramp")) return <Activity className="w-8 h-8 text-white" />;
    return <ArrowUp className="w-8 h-8 text-white" />;
  };

  if (!currentSegment) {
    return null;
  }

  const isLastStep = currentStepIndex === segments.length - 1;

  return (
    <div className="space-y-4 select-none">
      {/* Turn Banner Card (Apple Maps Banner) */}
      <div className="rounded-[22px] bg-[#1d1d1f] text-white p-5 shadow-floating space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0066cc] flex items-center justify-center shadow-sm">
              {isLastStep ? (
                <Flag className="w-7 h-7 text-white" />
              ) : (
                getTurnIcon(currentSegment.instruction, currentSegment.edgeType)
              )}
            </div>

            <div>
              <div className="text-[13px] font-medium text-[#86868b] tracking-wide">
                {isLastStep ? "ARRIVING AT DESTINATION" : `IN ${currentSegment.distanceMeters} METERS`}
              </div>
              <h2 className="text-[19px] font-bold tracking-tight text-white leading-tight">
                {currentSegment.instruction}
              </h2>
            </div>
          </div>

          {/* Voice Guidance Mute Button */}
          <button
            onClick={() => {
              const next = !isVoiceEnabled;
              setIsVoiceEnabled(next);
              if (next) speakInstruction("Voice guidance enabled");
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isVoiceEnabled ? "bg-white/20 text-white" : "bg-white/5 text-[#86868b]"
            }`}
            title={isVoiceEnabled ? "Mute Voice" : "Enable Voice"}
          >
            {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="pt-2 flex items-center justify-between text-[11px] text-[#86868b] border-t border-white/10">
          <span>
            Step {currentStepIndex + 1} of {segments.length}
          </span>
          <span className="text-white/80 font-medium">
            {route.totalDistanceMeters}m Total • {Math.round(route.estimatedTimeSeconds / 60)}m Left
          </span>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePrevStep}
          disabled={currentStepIndex === 0}
          className="w-12 h-12 rounded-full bg-white border border-black/8 shadow-sm flex items-center justify-center text-[#1d1d1f] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
          title="Previous Step"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={handleNextStep}
          className="flex-1 apple-pill-btn py-3.5 text-[15px] font-semibold bg-[#0066cc] hover:bg-[#0071e3] text-white shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span>{isLastStep ? "Finish Route" : "Next Step"}</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={onEndNavigation}
          className="w-12 h-12 rounded-full bg-white border border-black/8 shadow-sm flex items-center justify-center text-[#ff3b30] hover:bg-[#ff3b30]/10 active:scale-95 transition-all"
          title="End Route"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
