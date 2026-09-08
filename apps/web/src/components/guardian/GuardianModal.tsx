import React, { useState } from "react";
import { GuardianState } from "../../types";
import {
  X,
  Users,
  ShieldCheck,
  AlertTriangle,
  Battery,
  Wifi,
  MapPin,
  RefreshCw,
  KeyRound,
  CheckCircle2
} from "lucide-react";

interface GuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  guardianState: GuardianState;
  onTogglePairing: () => void;
  onLocateChild: () => void;
}

export const GuardianModal: React.FC<GuardianModalProps> = ({
  isOpen,
  onClose,
  guardianState,
  onTogglePairing,
  onLocateChild
}) => {
  const [inputCode, setInputCode] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(guardianState.pairingCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return "text-[#34c759]";
    if (level > 20) return "text-[#ff9500]";
    return "text-[#ff3b30]";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-black/10 rounded-[28px] shadow-floating overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-black/5 bg-[#f5f5f7]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0066cc] flex items-center justify-center text-white shadow-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1d1d1f] tracking-tight">
                Guardian Link
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Real-time safety companion
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* Pairing Code Card */}
          <div className="apple-card p-4 text-center space-y-2.5 bg-[#f5f5f7]/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
              Your Device Pairing Code
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-extrabold tracking-widest text-[#1d1d1f] font-mono">
                {guardianState.pairingCode}
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">
              Share this 6-digit code with authorized guardians for indoor tracking.
            </p>
            <button
              onClick={handleCopy}
              className="text-[12px] font-semibold text-[#0066cc] hover:underline inline-flex items-center gap-1"
            >
              {copySuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-[#34c759]" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{copySuccess ? "Copied to clipboard!" : "Copy Code"}</span>
            </button>
          </div>

          {/* Linked Ward Live Status Card */}
          {guardianState.isPaired ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                  Monitored Dependent
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#34c759]/15 text-[#248a3d] text-[11px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
                  <span>Live Tracking</span>
                </span>
              </div>

              <div className="apple-card p-4 space-y-3">
                {/* Dependent identity and battery */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ff9500]/15 text-[#ff9500] font-bold flex items-center justify-center text-[15px]">
                      {guardianState.childName[0]}
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-[#1d1d1f]">
                        {guardianState.childName}
                      </h4>
                      <p className="text-[12px] text-[#86868b] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#0066cc]" />
                        <span>{guardianState.childPosition.placeName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div className={`text-[13px] font-bold ${getBatteryColor(guardianState.batteryLevel)}`}>
                        {guardianState.batteryLevel}%
                      </div>
                      <div className="text-[10px] text-[#86868b]">
                        Battery
                      </div>
                    </div>
                    <Battery className={`w-5 h-5 ${getBatteryColor(guardianState.batteryLevel)}`} />
                  </div>
                </div>

                {/* Signal freshness & telemetry */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 text-[11px] text-[#6e6e73]">
                  <div className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#0066cc]" />
                    <span>Updated {guardianState.lastUpdatedSecondsAgo}s ago</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-medium text-[#1d1d1f]">Wi-Fi RSSI: -54 dBm</span>
                  </div>
                </div>

                {/* Geofence Status */}
                <div
                  className={`p-2.5 rounded-xl text-[12px] flex items-start gap-2 ${
                    guardianState.geofenceWarning
                      ? "bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#d70015]"
                      : "bg-[#34c759]/10 border border-[#34c759]/20 text-[#248a3d]"
                  }`}
                >
                  {guardianState.geofenceWarning ? (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Geofence Warning: </span>
                        <span>{guardianState.geofenceWarning}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Safe Boundary: </span>
                        <span>Within authorized campus safety zone (Floor 2).</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onLocateChild}
                  className="flex-1 apple-pill-btn py-2.5 text-[13px] font-semibold bg-[#0066cc] hover:bg-[#0071e3]"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Locate on Floor Map</span>
                </button>

                <button
                  onClick={onTogglePairing}
                  className="px-4 py-2.5 rounded-full border border-black/10 text-[13px] font-medium text-[#ff3b30] hover:bg-black/5 active:scale-95 transition-all"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                Pair with another device
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-digit code (e.g. 749-218)"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#e3e3e8]/60 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
                />
                <button
                  onClick={onTogglePairing}
                  className="apple-pill-btn px-5 text-[13px] font-semibold"
                >
                  Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
