import React, { useState, useEffect } from "react";
import { GuardianState, GeofenceZoneConfig, ParentalModeState } from "../../types";
import {
  X,
  Users,
  ShieldCheck,
  AlertTriangle,
  Battery,
  MapPin,
  Bell,
  Volume2,
  Play,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Radio
} from "lucide-react";
import {
  requestNotificationPermission,
  isNotificationPermissionGranted,
  playWarningChime
} from "../../services/webNotificationService";

export const PREDEFINED_GEOFENCE_ZONES: GeofenceZoneConfig[] = [
  {
    id: "zone-room-219",
    name: "Room 219 (AI & Robotics Lab)",
    floorId: "floor-2",
    center: { x: 337.5, y: 351 },
    radiusMeters: 25,
    svgRadius: 80
  },
  {
    id: "zone-room-208",
    name: "Room 208 (Computer & IoT Lab)",
    floorId: "floor-2",
    center: { x: 757.5, y: 205 },
    radiusMeters: 25,
    svgRadius: 80
  },
  {
    id: "zone-central-concourse",
    name: "Central Concourse & Hall",
    floorId: "floor-2",
    center: { x: 540, y: 242.5 },
    radiusMeters: 35,
    svgRadius: 110
  },
  {
    id: "zone-west-classrooms",
    name: "West Classroom Wing (Rooms 201-204)",
    floorId: "floor-2",
    center: { x: 220, y: 140 },
    radiusMeters: 30,
    svgRadius: 95
  }
];

interface ParentalGeofenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  guardianState: GuardianState;
  parentalState: ParentalModeState;
  onToggleParentalMode: (active: boolean) => void;
  onUpdateZone: (zone: GeofenceZoneConfig) => void;
  onSimulateChildBreach: () => void;
  onSimulateChildReturn: () => void;
  onLocateChild: () => void;
}

export const ParentalGeofenceModal: React.FC<ParentalGeofenceModalProps> = ({
  isOpen,
  onClose,
  guardianState,
  parentalState,
  onToggleParentalMode,
  onUpdateZone,
  onSimulateChildBreach,
  onSimulateChildReturn,
  onLocateChild
}) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [selectedRadius, setSelectedRadius] = useState<number>(
    parentalState.selectedZone.radiusMeters || 25
  );

  useEffect(() => {
    if (isOpen) {
      setHasPermission(isNotificationPermissionGranted());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setHasPermission(res === "granted");
    if (res === "granted") {
      playWarningChime();
    }
  };

  const handleRadiusChange = (newRadiusMeters: number) => {
    setSelectedRadius(newRadiusMeters);
    const updatedZone: GeofenceZoneConfig = {
      ...parentalState.selectedZone,
      radiusMeters: newRadiusMeters,
      svgRadius: Math.round(newRadiusMeters * 3.2)
    };
    onUpdateZone(updatedZone);
  };

  const handleSelectZone = (zone: GeofenceZoneConfig) => {
    onUpdateZone({
      ...zone,
      radiusMeters: selectedRadius,
      svgRadius: Math.round(selectedRadius * 3.2)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-black/10 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-black/5 bg-[#f5f5f7]/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-colors ${
              parentalState.isActive ? "bg-[#10B981]" : "bg-[#0066CC]"
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold text-[#1d1d1f] tracking-tight">
                  Parental Mode & Geofence
                </h3>
                {parentalState.isActive && (
                  <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#059669] text-[10px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#86868b]">
                Real-time child boundary tracker & browser push notifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] active:scale-95 transition-all"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Main One-Tap Toggle Card */}
          <div className="p-4 rounded-2xl border bg-[#fbfbfd] shadow-sm flex items-center justify-between transition-all">
            <div className="space-y-0.5">
              <span className="text-[14px] font-bold text-[#1d1d1f] flex items-center gap-1.5">
                <Radio className={`w-4 h-4 ${parentalState.isActive ? "text-[#10B981] animate-pulse" : "text-[#86868b]"}`} />
                <span>Parental Geofence Monitoring</span>
              </span>
              <p className="text-[12px] text-[#86868b]">
                Dispatches web notifications and alarms if child leaves designated zone.
              </p>
            </div>

            <button
              onClick={() => onToggleParentalMode(!parentalState.isActive)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                parentalState.isActive ? "bg-[#10B981]" : "bg-[#d1d1d6]"
              }`}
              title="Toggle Parental Mode"
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  parentalState.isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Monitored Child Status */}
          <div className="p-4 rounded-2xl bg-[#f5f5f7]/90 border border-black/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                Monitored Ward
              </span>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-[#34c759]" />
                <span className="text-[11px] font-bold text-[#34c759]">
                  {guardianState.batteryLevel}% Battery
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ff9500]/20 text-[#d97706] font-bold flex items-center justify-center text-[16px]">
                  {guardianState.childName[0]}
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#1d1d1f]">
                    {guardianState.childName}
                  </h4>
                  <p className="text-[12px] text-[#86868b] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>{guardianState.childPosition.placeName}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={onLocateChild}
                className="px-3 py-1.5 rounded-full bg-white text-[#0066cc] border border-[#0066cc]/20 text-xs font-semibold hover:bg-[#0066cc]/5 transition-all shadow-xs"
              >
                Locate
              </button>
            </div>

            {/* Live Safe/Breach Status Badge */}
            <div
              className={`p-2.5 rounded-xl text-[12px] flex items-center gap-2 transition-all ${
                parentalState.isBreached
                  ? "bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#B91C1C]"
                  : "bg-[#10B981]/15 border border-[#10B981]/30 text-[#047857]"
              }`}
            >
              {parentalState.isBreached ? (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444] animate-bounce" />
                  <span className="font-bold">
                    🚨 GEOFENCE BREACH: Child has exited the approved perimeter!
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#10B981]" />
                  <span className="font-semibold">
                    ✅ Child is safely inside {parentalState.selectedZone.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Geofence Target Location Picker */}
          <div className="space-y-2.5">
            <label className="text-[12px] font-bold text-[#1d1d1f] flex items-center justify-between">
              <span>Designated Safe Zone Location</span>
              <span className="text-[11px] font-normal text-[#86868b]">Floor 2 Campus</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PREDEFINED_GEOFENCE_ZONES.map((zone) => {
                const isSelected = parentalState.selectedZone.id === zone.id;
                return (
                  <button
                    key={zone.id}
                    onClick={() => handleSelectZone(zone)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#E0F2FE] border-[#0284C7] ring-1 ring-[#0284C7]/40 shadow-xs"
                        : "bg-white border-black/10 hover:bg-[#F8F9FA] hover:border-black/20"
                    }`}
                  >
                    <div className="text-[12px] font-bold text-[#1d1d1f] line-clamp-1">
                      {zone.name}
                    </div>
                    <div className="text-[11px] text-[#64748b]">
                      Default radius: {zone.radiusMeters}m
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radius Slider */}
          <div className="p-4 rounded-2xl bg-[#f5f5f7]/70 border border-black/5 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-bold text-[#1d1d1f]">Geofence Radius Perimeter</span>
              <span className="font-mono font-bold text-[#0066cc]">
                {selectedRadius} meters (~{Math.round(selectedRadius * 3.2)} ft)
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={selectedRadius}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              className="w-full h-1.5 bg-[#d2d2d7] rounded-lg appearance-none cursor-pointer accent-[#0066cc]"
            />
            <div className="flex justify-between text-[10px] text-[#86868b]">
              <span>10m (Tight Room)</span>
              <span>30m (Wing)</span>
              <span>60m (Whole Floor)</span>
            </div>
          </div>

          {/* Web Notification Permission & Status */}
          <div className="p-3.5 rounded-2xl bg-white border border-black/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-[#1d1d1f]">
                  Browser Web Notifications
                </div>
                <div className="text-[11px] text-[#86868b]">
                  {hasPermission ? "System push enabled" : "Requires permission for desktop/mobile alerts"}
                </div>
              </div>
            </div>

            {hasPermission ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Granted</span>
              </span>
            ) : (
              <button
                onClick={handleRequestPermission}
                className="px-3 py-1.5 rounded-full bg-[#0066cc] text-white text-[11px] font-semibold hover:bg-[#0071e3] transition-all"
              >
                Allow Push
              </button>
            )}
          </div>

          {/* Interactive Breach Test Simulator (Judge Demo) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border border-[#FDE68A] space-y-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#92400E]">
              <ShieldAlert className="w-4 h-4 text-[#D97706]" />
              <span>Interactive Geofence Simulator (Judge & Test Demo)</span>
            </div>
            <p className="text-[11px] text-[#B45309] leading-relaxed">
              Instantly test the real browser Web Notification, audio chime, and visual boundary warnings without needing the child to physically exit.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onSimulateChildBreach}
                className="flex-1 py-2 px-3 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Child Leaving Zone</span>
              </button>

              <button
                onClick={onSimulateChildReturn}
                className="py-2 px-3 rounded-xl bg-white border border-[#D97706]/30 text-[#92400E] text-[12px] font-semibold hover:bg-white/80 active:scale-95 transition-all flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Inside</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-black/5 bg-[#f5f5f7]/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-black active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
