import React, { useRef } from "react";
import { SnapPoint } from "../../types";

interface BottomSheetProps {
  snapPoint: SnapPoint;
  onSnapChange: (point: SnapPoint) => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  snapPoint,
  onSnapChange,
  children
}) => {
  const dragStartY = useRef<number | null>(null);

  // Height configurations per snap point
  const heightClasses: Record<SnapPoint, string> = {
    collapsed: "h-[76px]",
    half: "h-[390px]",
    expanded: "h-[82vh]"
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;

    if (deltaY < -40) {
      // Swiped up
      if (snapPoint === "collapsed") onSnapChange("half");
      else if (snapPoint === "half") onSnapChange("expanded");
    } else if (deltaY > 40) {
      // Swiped down
      if (snapPoint === "expanded") onSnapChange("half");
      else if (snapPoint === "half") onSnapChange("collapsed");
    }
  };

  const cycleSnap = () => {
    if (snapPoint === "collapsed") onSnapChange("half");
    else if (snapPoint === "half") onSnapChange("expanded");
    else onSnapChange("collapsed");
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur-2xl border-t border-black/8 rounded-t-[28px] shadow-drawer transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${heightClasses[snapPoint]}`}
    >
      {/* Drag Handle Bar */}
      <div
        className="pt-2.5 pb-1.5 px-4 flex flex-col items-center cursor-pointer select-none"
        onClick={cycleSnap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 rounded-full bg-black/20 transition-colors hover:bg-black/30" />
      </div>

      {/* Sheet Content Container */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        {children}
      </div>
    </div>
  );
};
