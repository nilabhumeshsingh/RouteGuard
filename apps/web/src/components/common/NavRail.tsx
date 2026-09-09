import React, { useState } from "react";

interface NavRailProps {
  onOpenLayers: () => void;
  onOpenRecents: () => void;
  onOpenSaved: () => void;
  onTriggerJudgeMenu: () => void;
  onAskRouteGuard: () => void;
  isParentalModeActive?: boolean;
  onToggleParentalMode?: (active: boolean) => void;
  onOpenParentalConfig?: () => void;
  childName?: string;
  isBreached?: boolean;
  isDarkMode?: boolean;
}

export const NavRail: React.FC<NavRailProps> = ({
  onOpenLayers,
  onOpenRecents,
  onOpenSaved,
  onTriggerJudgeMenu,
  onAskRouteGuard,
  isParentalModeActive = false,
  onToggleParentalMode,
  onOpenParentalConfig,
  childName = "Alex",
  isBreached = false,
  isDarkMode = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeItem, setActiveItem] = useState<string>("explore");
  const [clickCount, setClickCount] = useState(0);

  const handleLogoClick = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount >= 3) {
      onTriggerJudgeMenu();
      setClickCount(0);
    }
    setTimeout(() => {
      setClickCount(0);
    }, 2000);
  };

  const navItems = [
    { id: "explore", label: "Explore Campus", icon: "explore", action: () => setActiveItem("explore") },
    { id: "saved", label: "Saved Rooms", icon: "bookmark", action: () => { setActiveItem("saved"); onOpenSaved(); } },
    { id: "recents", label: "Recent Routes", icon: "schedule", action: () => { setActiveItem("recents"); onOpenRecents(); } },
    { id: "layers", label: "Map Layers", icon: "layers", action: () => { setActiveItem("layers"); onOpenLayers(); } }
  ];

  return (
    <aside
      className={`hidden md:flex flex-col justify-between relative h-full shrink-0 z-30 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
        expanded ? "w-[260px]" : "w-[64px]"
      } ${
        isDarkMode
          ? "bg-[#1a1f3a] text-white border-r border-white/10"
          : "bg-white text-[#202124] border-r border-[#E8EAED]"
      } shadow-[0_1px_3px_rgba(60,64,67,0.15)] select-none`}
    >
      {/* Top Section */}
      <div className="flex flex-col items-center w-full pt-3">
        {/* Brand / Menu Toggle with 3-click Judge trigger */}
        <div className="flex items-center w-full px-3 mb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
            title={expanded ? "Collapse menu" : "Expand menu"}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          {expanded && (
            <div
              onClick={handleLogoClick}
              className="ml-2 flex items-center gap-1.5 cursor-pointer select-none overflow-hidden"
              title="Click 3 times for Judge Scenario Panel"
            >
              <span className="font-semibold text-sm tracking-tight text-[#1A73E8]">RouteGuard</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#E8F0FE] text-[#1967D2]">
                MUJ
              </span>
            </div>
          )}
        </div>

        {/* Prominent Ask RouteGuard Action Button */}
        <div className="w-full px-2 mb-4 flex justify-center">
          <button
            onClick={onAskRouteGuard}
            className={`flex items-center transition-all duration-200 ${
              expanded
                ? "w-full px-3 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white shadow-md gap-3"
                : "w-11 h-11 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white justify-center shadow-md"
            }`}
            title="Ask RouteGuard indoor AI"
          >
            <span className="material-symbols-outlined text-[22px]">assistant_navigation</span>
            {expanded && <span className="text-sm font-medium whitespace-nowrap">Ask RouteGuard</span>}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="w-full px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className={`w-full flex items-center transition-colors rounded-full ${
                  expanded ? "px-3 py-2.5 gap-4" : "h-11 justify-center"
                } ${
                  isActive
                    ? "text-[#1A73E8] bg-[#E8F0FE] font-medium"
                    : "text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124]"
                }`}
                title={item.label}
              >
                <span className={`material-symbols-outlined text-[22px] ${isActive ? "text-[#1A73E8]" : ""}`}>
                  {item.icon}
                </span>
                {expanded && <span className="text-sm truncate">{item.label}</span>}
              </button>
            );
          })}

          {/* Parental Mode One-Tap Toggle Item in Three Bars Menu */}
          <div
            onClick={onOpenParentalConfig}
            className={`w-full relative flex items-center transition-all rounded-2xl cursor-pointer ${
              expanded
                ? "px-3 py-2.5 justify-between gap-2 border " +
                  (isParentalModeActive
                    ? isBreached
                      ? "bg-[#FEF2F2] border-[#EF4444]/40 text-[#991B1B]"
                      : "bg-[#ECFDF5] border-[#10B981]/40 text-[#065F46]"
                    : "bg-[#F8F9FA] border-[#E8EAED] text-[#5F6368] hover:bg-[#F1F3F4]")
                : "h-11 justify-center rounded-full " +
                  (isParentalModeActive
                    ? isBreached
                      ? "bg-[#FEE2E2] text-[#DC2626]"
                      : "bg-[#D1FAE5] text-[#059669]"
                    : "text-[#5F6368] hover:bg-[#F1F3F4]")
            }`}
            title={
              expanded
                ? "Parental Mode Geofence: Tap switch to toggle, or click card to configure"
                : `Parental Mode: ${isParentalModeActive ? "Active" : "Off"} (Tap to toggle)`
            }
          >
            {expanded ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`material-symbols-outlined text-[22px] ${
                    isParentalModeActive
                      ? isBreached ? "text-[#EF4444] animate-bounce" : "text-[#10B981]"
                      : "text-[#5F6368]"
                  }`}>
                    supervised_user_circle
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                      <span>Parental Mode</span>
                      {isParentalModeActive && (
                        <span className={`w-2 h-2 rounded-full ${isBreached ? "bg-[#EF4444] animate-ping" : "bg-[#10B981] animate-pulse"}`} />
                      )}
                    </div>
                    <div className="text-[10px] text-[#64748b] truncate">
                      {childName} • {isBreached ? "Breached!" : isParentalModeActive ? "Geofenced" : "Off"}
                    </div>
                  </div>
                </div>

                {/* One-Tap Toggle Switch inside Three Bars Menu */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleParentalMode?.(!isParentalModeActive);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isParentalModeActive
                      ? isBreached
                        ? "bg-[#EF4444]"
                        : "bg-[#10B981]"
                      : "bg-[#CBD5E1]"
                  }`}
                  title={isParentalModeActive ? "Disable Parental Mode" : "Enable Parental Mode"}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isParentalModeActive ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleParentalMode?.(!isParentalModeActive);
                }}
                className="relative w-full h-full flex items-center justify-center"
                title={`Parental Mode: ${isParentalModeActive ? "ON" : "OFF"} (Click to toggle)`}
              >
                <span className={`material-symbols-outlined text-[22px] ${
                  isParentalModeActive
                    ? isBreached ? "text-[#EF4444] animate-pulse" : "text-[#10B981]"
                    : "text-[#5F6368]"
                }`}>
                  supervised_user_circle
                </span>
                {isParentalModeActive && (
                  <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    isBreached ? "bg-[#EF4444] animate-ping" : "bg-[#10B981]"
                  }`} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="w-full p-2 flex flex-col items-center border-t border-[#E8EAED]">
        <button
          onClick={onTriggerJudgeMenu}
          className={`w-full flex items-center transition-colors rounded-full ${
            expanded ? "px-3 py-2.5 gap-4" : "h-11 justify-center"
          } text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124]`}
          title="Judge Evaluation Panel"
        >
          <span className="material-symbols-outlined text-[22px]">tune</span>
          {expanded && <span className="text-sm truncate">Judge Controls</span>}
        </button>
      </div>
    </aside>
  );
};
