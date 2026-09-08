import React, { useState } from "react";

interface GoogleSearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
  isScannerConnected: boolean;
  scannerLabel?: string;
  onToggleScanner: () => void;
  placeholder?: string;
}

export const GoogleSearchBar: React.FC<GoogleSearchBarProps> = ({
  value,
  onChange,
  onFocus,
  onClear,
  isScannerConnected,
  scannerLabel = "BLE · 0.9",
  onToggleScanner,
  placeholder = "Search campus rooms, labs, stairs…"
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`relative flex items-center h-[50px] md:h-[52px] w-full max-w-[460px] bg-white rounded-[28px] transition-all duration-200 border ${
        isFocused
          ? "border-[#1A73E8] shadow-[0_2px_8px_rgba(26,115,232,0.2),0_1px_4px_rgba(32,33,36,0.12)]"
          : "border-transparent shadow-[0_2px_6px_rgba(32,33,36,0.12),0_1px_3px_rgba(32,33,36,0.08)] hover:shadow-[0_2px_8px_rgba(32,33,36,0.16)]"
      }`}
    >
      {/* Left Search Icon */}
      <div className="pl-4 pr-2.5 flex items-center justify-center text-[#5F6368]">
        <span className="material-symbols-outlined text-[22px]">search</span>
      </div>

      {/* Input Field */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[15px] text-[#202124] placeholder-[#5F6368] outline-none font-normal"
      />

      {/* Clear Button if input has text */}
      {value && (
        <button
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="p-1.5 text-[#5F6368] hover:text-[#202124] rounded-full mr-1 transition-colors"
          title="Clear search"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}

      {/* Vertical Divider */}
      <div className="w-[1px] h-6 bg-[#DADCE0] my-auto mx-1" />

      {/* Right Action: Connect Scanner Button */}
      <div className="pr-2">
        <button
          onClick={onToggleScanner}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isScannerConnected
              ? "bg-[#E6F4EA] text-[#137333] hover:bg-[#CEEAD6]"
              : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED] hover:text-[#202124]"
          }`}
          title={isScannerConnected ? "WiFi/BLE Scanner Active" : "Click to connect WiFi/BLE scanner"}
        >
          {isScannerConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
              <span className="font-semibold">{scannerLabel}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px] text-[#5F6368]">sensors</span>
              <span>Connect</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
