import React, { useState, useEffect } from "react";
import { MobilityProfile } from "@routeguard/shared";

interface JudgeParameterMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRunScenario: (params: ScenarioParams) => void;
  isScenarioRunning: boolean;
  scenarioTimeLeft?: number;
  evacuationProgress?: number;
  onStopScenario?: () => void;
}

export interface ScenarioParams {
  fireRoomId: string;
  smokeRate: "slow" | "medium" | "fast";
  userCount: number;
  congestionLevel: "low" | "medium" | "high";
  mobilityMode: "walking" | "wheelchair" | "visually-impaired";
}

const AVAILABLE_ROOMS = [
  { id: "208", label: "Room 208 (IoT & Hardware Lab)" },
  { id: "207", label: "Room 207 (Academic Classroom)" },
  { id: "204", label: "Room 204 (Central North)" },
  { id: "201", label: "Room 201 (Northwest Wing)" },
  { id: "219", label: "Room 219 (AI & Robotics Lab)" },
  { id: "214", label: "Room 214 (Southeast Wing)" }
];

export const JudgeParameterMenu: React.FC<JudgeParameterMenuProps> = ({
  isOpen,
  onClose,
  onRunScenario,
  isScenarioRunning,
  scenarioTimeLeft = 60,
  evacuationProgress = 0,
  onStopScenario
}) => {
  const [fireRoomId, setFireRoomId] = useState("208");
  const [smokeRate, setSmokeRate] = useState<"slow" | "medium" | "fast">("medium");
  const [userCount, setUserCount] = useState(48);
  const [congestionLevel, setCongestionLevel] = useState<"low" | "medium" | "high">("medium");
  const [mobilityMode, setMobilityMode] = useState<"walking" | "wheelchair" | "visually-impaired">("walking");

  if (!isOpen) return null;

  const handleStart = () => {
    onRunScenario({
      fireRoomId,
      smokeRate,
      userCount,
      congestionLevel,
      mobilityMode
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in select-none">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#DADCE0] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8EAED] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#1A73E8]">tune</span>
            <div>
              <h2 className="text-base font-bold text-[#202124]">Judge Evaluation Suite</h2>
              <p className="text-xs text-[#5F6368]">Live Dynamic Evacuation & Simulation Parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#E8EAED] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-[#202124]">
          {/* Active Live Progress Bar if Scenario Running */}
          {isScenarioRunning && (
            <div className="p-4 rounded-xl bg-[#E8F0FE] border border-[#1A73E8] space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1967D2]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1A73E8] animate-ping" />
                  SCENARIO ACTIVE: {scenarioTimeLeft}s REMAINING
                </span>
                <span>{Math.round(evacuationProgress)}% EVACUATED</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white overflow-hidden p-0.5 border border-[#1A73E8]/30">
                <div
                  className="h-full rounded-full bg-[#1A73E8] transition-all duration-300"
                  style={{ width: `${evacuationProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#5F6368]">
                <span>Building Occupancy: {userCount} pax</span>
                <span>Evacuation Speed: {smokeRate} smoke propagation</span>
              </div>
            </div>
          )}

          {/* Parameter 1: Fire Incident Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
              1. Incident Fire Origin
            </label>
            <select
              value={fireRoomId}
              onChange={(e) => setFireRoomId(e.target.value)}
              disabled={isScenarioRunning}
              className="w-full p-2.5 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] text-[#202124] text-xs font-medium focus:border-[#1A73E8] outline-none"
            >
              {AVAILABLE_ROOMS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Parameter 2: Smoke Spread Rate */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
              2. Smoke Propagation Speed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["slow", "medium", "fast"] as const).map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSmokeRate(rate)}
                  disabled={isScenarioRunning}
                  className={`py-2 rounded-lg text-xs font-medium capitalize transition-all border ${
                    smokeRate === rate
                      ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1967D2] font-semibold"
                      : "bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"
                  }`}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter 3: User Occupancy Count (1-100) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
              <span>3. Floor Occupancy Count</span>
              <span className="text-[#1A73E8] font-bold">{userCount} Occupants</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={userCount}
              onChange={(e) => setUserCount(Number(e.target.value))}
              disabled={isScenarioRunning}
              className="w-full accent-[#1A73E8]"
            />
            <div className="flex justify-between text-[10px] text-[#5F6368]">
              <span>1 (Single Walker)</span>
              <span>50 (Normal Class Day)</span>
              <span>100 (Full Capacity)</span>
            </div>
          </div>

          {/* Parameter 4: Corridor Congestion */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
              4. Corridor Congestion Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setCongestionLevel(lvl)}
                  disabled={isScenarioRunning}
                  className={`py-2 rounded-lg text-xs font-medium capitalize transition-all border ${
                    congestionLevel === lvl
                      ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1967D2] font-semibold"
                      : "bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter 5: Mobility Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
              5. Evaluated Mobility Profile
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "walking", label: "Walking" },
                { id: "wheelchair", label: "Wheelchair (Step-free)" },
                { id: "visually-impaired", label: "Audio Guide" }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMobilityMode(m.id as any)}
                  disabled={isScenarioRunning}
                  className={`py-2 px-1 text-center rounded-lg text-[11px] font-medium transition-all border ${
                    mobilityMode === m.id
                      ? "bg-[#E8F0FE] border-[#1A73E8] text-[#1967D2] font-semibold"
                      : "bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#E8EAED] bg-[#F8F9FA] flex items-center justify-end gap-2">
          {isScenarioRunning ? (
            <button
              onClick={onStopScenario}
              className="px-5 py-2.5 rounded-lg bg-[#D93025] hover:bg-[#B71C1C] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">stop</span>
              <span>Stop Simulation</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="px-6 py-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Run Scenario (60s Live Rerun)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
