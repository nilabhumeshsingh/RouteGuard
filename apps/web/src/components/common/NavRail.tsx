import React, { useState } from "react";

interface NavRailProps {
  onOpenLayers: () => void;
  onOpenRecents: () => void;
  onOpenSaved: () => void;
  onTriggerJudgeMenu: () => void;
  onAskRouteGuard: () => void;
  isDarkMode?: boolean;
}

export const NavRail: React.FC<NavRailProps> = ({
  onOpenLayers,
  onOpenRecents,
  onOpenSaved,
  onTriggerJudgeMenu,
  onAskRouteGuard,
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
      className={`hidden md:flex flex-col justify-between absolute left-0 top-0 bottom-0 z-30 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
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
        </div>
      </div>

      {/* Bottom Section */}
      <div className="w-full p-2 flex flex-col items-center border-t border-[#E8EAED]">
        <button
          onClick={handleLogoClick}
          className={`w-full flex items-center transition-colors rounded-full ${
            expanded ? "px-3 py-2.5 gap-4" : "h-11 justify-center"
          } text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#202124]`}
          title="Judge Evaluation Panel (3-click trigger)"
        >
          <span className="material-symbols-outlined text-[22px]">tune</span>
          {expanded && <span className="text-sm truncate">Judge Controls</span>}
        </button>
      </div>
    </aside>
  );
};
